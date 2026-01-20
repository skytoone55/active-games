/**
 * iCount Inventory Module
 * Synchronisation des produits/items vers iCount via le module inventory
 *
 * API Endpoints (from Products-inventory-management.yaml):
 * - inventory/add_item : Créer un item (retourne inventory_item_id)
 * - inventory/update_item : Mettre à jour un item (requiert inventory_item_id)
 * - inventory/get_items : Rechercher des items par SKU
 * - inventory/get_item : Récupérer un item par inventory_item_id
 */

import type { ICountClient } from './client'
import type { ProviderResult } from '../types'

interface ICountInventoryResponse {
  status: boolean
  reason?: string
  error_description?: string
  error_details?: string[]
  // Réponse add_item
  inventory_item_id?: number
  // Réponse get_items
  items?: Array<{
    inventory_item_id: number
    sku: string
    description: string
    long_description?: string
    unitprice: number
    currency_id?: number
    tax_exempt?: boolean
    [key: string]: unknown
  }>
  // Réponse get_item (single)
  sku?: string
  description?: string
  long_description?: string
  unitprice?: number
  currency_id?: number
  tax_exempt?: boolean
  [key: string]: unknown
}

export interface ItemData {
  id: string                    // Notre UUID
  code: string                  // SKU / Code produit (ex: laser_1p)
  name: string                  // Nom principal (description iCount)
  nameHe?: string               // Nom hébreu
  nameEn?: string               // Nom anglais
  description?: string          // Description longue
  unitPrice: number             // Prix unitaire
  vatExempt?: boolean           // Exonéré de TVA
  active?: boolean              // Actif (not used by iCount directly)
}

export interface SyncItemResult {
  providerId: string            // inventory_item_id iCount
  itemCode?: string             // sku retourné par iCount
  action: 'created' | 'updated'
}

export class ICountItemsModule {
  constructor(private client: ICountClient) {}

  /**
   * Synchroniser un item vers iCount
   * - Si l'item existe (trouvé par SKU) → update_item
   * - Sinon → add_item
   */
  async syncItem(data: ItemData): Promise<ProviderResult<SyncItemResult>> {
    console.log('[ICOUNT INVENTORY] Syncing item:', data.code, data.name)

    // 1. Chercher si l'item existe déjà par SKU
    const existingItem = await this.findItemBySku(data.code)

    if (existingItem) {
      // Item existe → update
      console.log('[ICOUNT INVENTORY] Item exists, updating:', existingItem.inventory_item_id)
      return this.updateItem(existingItem.inventory_item_id, data)
    } else {
      // Item n'existe pas → create
      console.log('[ICOUNT INVENTORY] Item does not exist, creating...')
      return this.createItem(data)
    }
  }

  /**
   * Créer un nouvel item sur iCount
   */
  private async createItem(data: ItemData): Promise<ProviderResult<SyncItemResult>> {
    const params: Record<string, unknown> = {
      sku: data.code,
      description: data.nameHe || data.name,  // Nom principal (hébreu de préférence)
      unitprice: data.unitPrice,
      unit_price_includes_vat: true, // Prix TTC - iCount ne rajoutera pas la TVA
    }

    // Description longue (nom FR + EN si disponibles)
    const longDesc = [data.name]
    if (data.nameEn) longDesc.push(data.nameEn)
    if (data.description) longDesc.push(data.description)
    if (longDesc.length > 1 || data.description) {
      params.long_description = longDesc.join(' | ')
    }

    if (data.vatExempt !== undefined) params.tax_exempt = data.vatExempt

    const result = await this.client.request<ICountInventoryResponse>(
      'inventory',
      'add_item',
      params
    )

    if (result.success && result.data?.inventory_item_id) {
      console.log('[ICOUNT INVENTORY] Item created:', result.data.inventory_item_id)
      return {
        success: true,
        data: {
          providerId: result.data.inventory_item_id.toString(),
          itemCode: data.code,
          action: 'created',
        },
      }
    }

    console.error('[ICOUNT INVENTORY] Create failed:', result.error)
    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Mettre à jour un item existant sur iCount
   */
  private async updateItem(inventoryItemId: number, data: ItemData): Promise<ProviderResult<SyncItemResult>> {
    const params: Record<string, unknown> = {
      inventory_item_id: inventoryItemId,
      sku: data.code,
      description: data.nameHe || data.name,
      unitprice: data.unitPrice,
      unit_price_includes_vat: true, // Prix TTC - iCount ne rajoutera pas la TVA
    }

    // Description longue
    const longDesc = [data.name]
    if (data.nameEn) longDesc.push(data.nameEn)
    if (data.description) longDesc.push(data.description)
    if (longDesc.length > 1 || data.description) {
      params.long_description = longDesc.join(' | ')
    }

    if (data.vatExempt !== undefined) params.tax_exempt = data.vatExempt

    const result = await this.client.request<ICountInventoryResponse>(
      'inventory',
      'update_item',
      params
    )

    if (result.success) {
      console.log('[ICOUNT INVENTORY] Item updated:', inventoryItemId)
      return {
        success: true,
        data: {
          providerId: inventoryItemId.toString(),
          itemCode: data.code,
          action: 'updated',
        },
      }
    }

    console.error('[ICOUNT INVENTORY] Update failed:', result.error)
    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Rechercher un item par SKU
   */
  private async findItemBySku(sku: string): Promise<{ inventory_item_id: number; sku: string } | null> {
    const result = await this.client.request<ICountInventoryResponse>(
      'inventory',
      'get_items',
      {
        sku: sku,  // Recherche exacte
        limit: 1,
      }
    )

    if (result.success && result.data?.items) {
      // Note: iCount returns an OBJECT with numeric keys, not an array
      // Example: { "17": { inventory_item_id: "17", sku: "laser_4", ... } }
      const items = result.data.items
      type ItemType = { inventory_item_id: number | string; sku: string }
      const itemsArray: ItemType[] = Array.isArray(items)
        ? items
        : Object.values(items) as ItemType[]
      if (itemsArray.length > 0) {
        const item = itemsArray[0]
        // Vérifier que le SKU correspond exactement (au cas où iCount fait un wildcard)
        if (item.sku === sku) {
          return {
            inventory_item_id: typeof item.inventory_item_id === 'string'
              ? parseInt(item.inventory_item_id, 10)
              : item.inventory_item_id,
            sku: item.sku,
          }
        }
      }
    }

    return null
  }

  /**
   * Récupérer un item par son inventory_item_id
   */
  async getItem(inventoryItemId: number): Promise<ProviderResult<ItemData & { providerId: string }>> {
    const result = await this.client.request<ICountInventoryResponse>(
      'inventory',
      'get_item',
      {
        inventory_item_id: inventoryItemId,
      }
    )

    if (result.success && result.data) {
      const data = result.data
      return {
        success: true,
        data: {
          id: '',
          providerId: inventoryItemId.toString(),
          code: data.sku || '',
          name: data.description || '',
          description: data.long_description,
          unitPrice: data.unitprice || 0,
          vatExempt: data.tax_exempt,
        },
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Lister tous les items
   */
  async listItems(): Promise<ProviderResult<Array<ItemData & { providerId: string }>>> {
    const result = await this.client.request<ICountInventoryResponse>(
      'inventory',
      'get_items',
      {
        limit: 0,  // 0 = unlimited
      }
    )

    if (result.success && result.data) {
      // Note: iCount returns an OBJECT with numeric keys, not an array
      const items = result.data.items
      type ListItemType = {
        inventory_item_id: number | string
        sku: string
        description: string
        long_description?: string
        unitprice?: number
        tax_exempt?: boolean
      }
      const itemsArray: ListItemType[] = Array.isArray(items)
        ? items
        : Object.values(items || {}) as ListItemType[]

      const itemsList = itemsArray.map((item) => ({
        id: '',
        providerId: item.inventory_item_id.toString(),
        code: item.sku,
        name: item.description,
        description: item.long_description,
        unitPrice: item.unitprice || 0,
        vatExempt: item.tax_exempt,
      }))

      return {
        success: true,
        data: itemsList,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Supprimer plusieurs items par leurs IDs
   */
  async deleteItems(inventoryItemIds: number[]): Promise<ProviderResult<{ deleted: number[] }>> {
    if (inventoryItemIds.length === 0) {
      return { success: true, data: { deleted: [] } }
    }

    console.log('[ICOUNT INVENTORY] Deleting items:', inventoryItemIds)

    const result = await this.client.request<ICountInventoryResponse & { delete_status?: Record<string, boolean> }>(
      'inventory',
      'delete_items',
      {
        inventory_item_ids: inventoryItemIds,
      }
    )

    if (result.success && result.data?.delete_status) {
      const deleted = Object.entries(result.data.delete_status)
        .filter(([, success]) => success)
        .map(([id]) => parseInt(id, 10))

      console.log('[ICOUNT INVENTORY] Deleted items:', deleted)
      return {
        success: true,
        data: { deleted },
      }
    }

    console.error('[ICOUNT INVENTORY] Delete failed:', result.error)
    return {
      success: false,
      error: result.error,
    }
  }
}
