/**
 * iCount Sync Service
 * Synchronise les contacts ActiveLaser vers iCount
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ICountClient, ICountClientsModule, ICountItemsModule } from '@/lib/payment-provider'
import type { Contact } from '@/lib/supabase/types'

interface ICountCredentials {
  cid: string
  user: string
  pass: string
}

// Create a raw Supabase client for fetching credentials
function createRawServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Get iCount credentials for a branch
 */
async function getICountCredentials(branchId: string): Promise<ICountCredentials | null> {
  const supabase = createRawServiceClient()

  const { data, error } = await supabase
    .from('payment_credentials')
    .select('cid, username, password')
    .eq('branch_id', branchId)
    .eq('provider', 'icount')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return {
    cid: data.cid,
    user: data.username,
    pass: data.password
  }
}

/**
 * Build client name for iCount
 * - For companies: use company_name
 * - For individuals: use first_name + last_name
 */
function buildClientName(contact: Contact): string {
  if (contact.client_type === 'company' && contact.company_name) {
    return contact.company_name
  }
  return `${contact.first_name} ${contact.last_name || ''}`.trim()
}

/**
 * Log iCount sync result to activity_logs
 */
async function logICountSync(
  contact: Contact,
  branchId: string,
  success: boolean,
  icountClientId?: number,
  action?: 'created' | 'updated',
  error?: string
): Promise<void> {
  console.log('[ICOUNT SYNC LOG] Logging to activity_logs:', {
    contactId: contact.id,
    branchId,
    success,
    icountClientId,
    action,
    error
  })

  const supabase = createRawServiceClient()

  const { error: insertError } = await supabase.from('activity_logs').insert({
    user_id: null, // System action
    user_role: 'system',
    user_name: 'iCount Sync',
    action_type: 'contact_synced_icount',
    target_type: 'contact',
    target_id: contact.id,
    target_name: `${contact.first_name} ${contact.last_name || ''}`.trim(),
    branch_id: branchId,
    details: {
      success,
      icount_client_id: icountClientId || null,
      action: action || null,
      error: error || null,
      contact_name: buildClientName(contact),
      client_type: contact.client_type
    }
  })

  if (insertError) {
    console.error('[ICOUNT SYNC LOG] Failed to insert activity log:', insertError)
  } else {
    console.log('[ICOUNT SYNC LOG] Activity log inserted successfully')
  }
}

/**
 * Sync a contact to iCount
 * Returns the iCount client_id if successful
 */
export async function syncContactToICount(
  contact: Contact,
  branchId: string
): Promise<{ success: boolean; icountClientId?: number; error?: string }> {
  console.log('[ICOUNT SYNC] === START syncContactToICount ===')
  console.log('[ICOUNT SYNC] Contact:', contact.id, contact.first_name, contact.last_name)
  console.log('[ICOUNT SYNC] Branch:', branchId)

  try {
    // Get credentials for this branch
    const credentials = await getICountCredentials(branchId)
    console.log('[ICOUNT SYNC] Credentials found:', !!credentials)

    if (!credentials) {
      // No iCount configured for this branch - not an error, just skip
      console.log('[ICOUNT SYNC] No credentials for branch, skipping sync')
      return { success: true }
    }

    // Create iCount client and module
    const icountClient = new ICountClient(credentials)
    const clientsModule = new ICountClientsModule(icountClient)

    // Build data for iCount
    const clientData = {
      id: contact.id, // UUID ActiveLaser as custom_client_id
      name: buildClientName(contact),
      firstName: contact.first_name,
      lastName: contact.last_name || undefined,
      email: contact.email || undefined,
      phone: contact.phone,
      vatId: contact.vat_id || undefined,
    }

    // Sync to iCount (create_or_update)
    console.log('[ICOUNT SYNC] Calling iCount API...')
    const result = await clientsModule.syncClient(clientData)
    console.log('[ICOUNT SYNC] iCount API result:', JSON.stringify(result, null, 2))

    if (result.success && result.data?.providerId) {
      const icountClientId = parseInt(result.data.providerId, 10)
      const action = result.data.action as 'created' | 'updated'

      // Update contact with icount_client_id
      const supabase = createRawServiceClient()
      await supabase
        .from('contacts')
        .update({ icount_client_id: icountClientId })
        .eq('id', contact.id)

      // Log success
      await logICountSync(contact, branchId, true, icountClientId, action)

      return { success: true, icountClientId }
    }

    const errorMsg = result.error?.message || 'iCount sync failed'

    // Log failure
    await logICountSync(contact, branchId, false, undefined, undefined, errorMsg)

    return {
      success: false,
      error: errorMsg
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    // Log error
    await logICountSync(contact, branchId, false, undefined, undefined, errorMsg)

    return {
      success: false,
      error: errorMsg
    }
  }
}

/**
 * Sync contact to iCount in background (non-blocking)
 * Use this when you don't want to wait for the sync
 */
export function syncContactToICountBackground(contact: Contact, branchId: string): void {
  console.log('[ICOUNT SYNC BG] Starting background sync for contact:', contact.id)
  // Fire and forget - don't await
  syncContactToICount(contact, branchId)
    .then((result) => {
      console.log('[ICOUNT SYNC BG] Background sync completed:', result)
    })
    .catch((err) => {
      console.error('[ICOUNT SYNC BG] Background sync error:', err)
    })
}

// ============================================
// PRODUCTS SYNC
// ============================================

interface ProductToSync {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  unit_price: number
  is_active: boolean
}

/**
 * Sync a product to iCount
 * Creates or updates the item on iCount and stores the icount_item_id
 */
export async function syncProductToICount(product: ProductToSync): Promise<{
  success: boolean
  icount_item_id?: number
  icount_itemcode?: string
  error?: string
}> {
  console.log('[ICOUNT SYNC] Syncing product:', product.code, product.name)

  try {
    // Get credentials for this branch
    const credentials = await getICountCredentials(product.branch_id)

    if (!credentials) {
      console.log('[ICOUNT SYNC] No iCount credentials for branch, skipping sync')
      return { success: true } // Not an error, just no iCount configured
    }

    // Create iCount client and items module
    const icountClient = new ICountClient(credentials)
    const itemsModule = new ICountItemsModule(icountClient)

    // Sync the item
    const result = await itemsModule.syncItem({
      id: product.id,
      code: product.code,
      name: product.name,
      nameHe: product.name_he || undefined,
      nameEn: product.name_en || undefined,
      unitPrice: product.unit_price,
      active: product.is_active,
    })

    if (result.success && result.data) {
      console.log('[ICOUNT SYNC] Product synced:', result.data.providerId, result.data.action)

      // Update product with iCount IDs
      const supabase = createRawServiceClient()
      const { error: updateError } = await supabase
        .from('icount_products')
        .update({
          icount_item_id: parseInt(result.data.providerId),
          icount_itemcode: result.data.itemCode || product.code,
          icount_synced_at: new Date().toISOString(),
        })
        .eq('id', product.id)

      if (updateError) {
        console.warn('[ICOUNT SYNC] Failed to update product with iCount IDs:', updateError)
      }

      return {
        success: true,
        icount_item_id: parseInt(result.data.providerId),
        icount_itemcode: result.data.itemCode || product.code,
      }
    }

    const errorMsg = result.error?.message || 'Failed to sync item to iCount'
    console.error('[ICOUNT SYNC] Sync failed:', errorMsg)

    return {
      success: false,
      error: errorMsg,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT SYNC] Exception:', errorMsg)
    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Sync a product in background (non-blocking)
 */
export function syncProductToICountBackground(product: ProductToSync): void {
  console.log('[ICOUNT SYNC BG] Starting background sync for product:', product.code)
  syncProductToICount(product)
    .then((result) => {
      console.log('[ICOUNT SYNC BG] Background sync completed:', result)
    })
    .catch((err) => {
      console.error('[ICOUNT SYNC BG] Background sync error:', err)
    })
}

/**
 * Sync all products for a branch to iCount
 * - Creates new products on iCount
 * - Updates existing products
 * - Deletes products that no longer exist in Supabase (admin is source of truth)
 */
export async function syncAllProductsToICount(branchId: string): Promise<{
  success: boolean
  synced: number
  deleted: number
  failed: number
  errors: string[]
}> {
  console.log('[ICOUNT SYNC] Syncing all products for branch:', branchId)

  const supabase = createRawServiceClient()
  const errors: string[] = []
  let synced = 0
  let deleted = 0
  let failed = 0

  // Get credentials for this branch
  const credentials = await getICountCredentials(branchId)
  if (!credentials) {
    console.log('[ICOUNT SYNC] No iCount credentials for branch, skipping sync')
    return { success: true, synced: 0, deleted: 0, failed: 0, errors: [] }
  }

  // Get all active products for this branch from Supabase (source of truth)
  const { data: products, error } = await supabase
    .from('icount_products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error || !products) {
    return {
      success: false,
      synced: 0,
      deleted: 0,
      failed: 0,
      errors: [error?.message || 'Failed to fetch products'],
    }
  }

  // Create set of active product codes from Supabase
  const activeProductCodes = new Set(products.map(p => p.code))

  // Sync each product to iCount (create/update)
  for (const product of products) {
    const result = await syncProductToICount(product as ProductToSync)
    if (result.success && result.icount_item_id) {
      synced++
    } else if (result.error) {
      failed++
      errors.push(`${product.code}: ${result.error}`)
    }
  }

  // Get all products from iCount
  const icountClient = new ICountClient(credentials)
  const itemsModule = new ICountItemsModule(icountClient)
  const icountItemsResult = await itemsModule.listItems()

  if (icountItemsResult.success && icountItemsResult.data) {
    // Find items on iCount that don't exist in Supabase
    const itemsToDelete = icountItemsResult.data.filter(
      item => !activeProductCodes.has(item.code)
    )

    if (itemsToDelete.length > 0) {
      console.log('[ICOUNT SYNC] Found orphan items to delete:', itemsToDelete.map(i => i.code))

      const idsToDelete = itemsToDelete.map(item => parseInt(item.providerId, 10))
      const deleteResult = await itemsModule.deleteItems(idsToDelete)

      if (deleteResult.success && deleteResult.data) {
        deleted = deleteResult.data.deleted.length
        console.log('[ICOUNT SYNC] Deleted orphan items:', deleted)
      } else {
        errors.push(`Delete failed: ${deleteResult.error?.message || 'Unknown error'}`)
      }
    }
  }

  console.log('[ICOUNT SYNC] Sync complete:', { synced, deleted, failed })

  return {
    success: failed === 0,
    synced,
    deleted,
    failed,
    errors,
  }
}

// ============================================
// EVENT FORMULA PRODUCT MANAGEMENT
// ============================================

interface EventFormulaForProduct {
  id: string
  branch_id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
}

/**
 * Generate a stable product code for an event formula
 * Format: event_{game_type}_{min}_{max}
 * Example: event_laser_5_15, event_active_16_30
 */
export function generateEventProductCode(formula: EventFormulaForProduct): string {
  return `event_${formula.game_type.toLowerCase()}_${formula.min_participants}_${formula.max_participants}`
}

/**
 * Ensure a product exists for an event formula
 * - Creates product if it doesn't exist
 * - Updates price if formula.price_per_person changed
 * - Syncs to iCount
 * Returns the product_id to link to the formula
 */
export async function ensureEventProductForFormula(
  formula: EventFormulaForProduct
): Promise<{
  success: boolean
  productId?: string
  productCode?: string
  created?: boolean
  error?: string
}> {
  console.log('[ICOUNT SYNC] ensureEventProductForFormula:', formula.name, formula.game_type)

  const supabase = createRawServiceClient()
  const productCode = generateEventProductCode(formula)

  try {
    // 1. Check if product already exists for this branch + code
    const { data: existingProduct, error: findError } = await supabase
      .from('icount_products')
      .select('*')
      .eq('branch_id', formula.branch_id)
      .eq('code', productCode)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 = not found, other errors are real
      console.error('[ICOUNT SYNC] Error finding product:', findError)
      return { success: false, error: findError.message }
    }

    if (existingProduct) {
      console.log('[ICOUNT SYNC] Found existing product:', existingProduct.id, productCode)

      // Check if price needs updating
      if (existingProduct.unit_price !== formula.price_per_person) {
        console.log('[ICOUNT SYNC] Updating product price:', existingProduct.unit_price, '->', formula.price_per_person)

        const { error: updateError } = await supabase
          .from('icount_products')
          .update({
            unit_price: formula.price_per_person,
            name: formula.name,
            name_he: formula.name,
          })
          .eq('id', existingProduct.id)

        if (updateError) {
          console.error('[ICOUNT SYNC] Error updating product:', updateError)
          return { success: false, error: updateError.message }
        }

        // Sync updated product to iCount
        syncProductToICountBackground({
          ...existingProduct,
          unit_price: formula.price_per_person,
          name: formula.name,
          name_he: formula.name,
        } as ProductToSync)
      }

      return {
        success: true,
        productId: existingProduct.id,
        productCode,
        created: false,
      }
    }

    // 2. Create new product
    console.log('[ICOUNT SYNC] Creating new product:', productCode)

    const { data: newProduct, error: createError } = await supabase
      .from('icount_products')
      .insert({
        branch_id: formula.branch_id,
        code: productCode,
        name: formula.name,
        name_he: formula.name,
        name_en: formula.name,
        unit_price: formula.price_per_person,
        is_active: true,
        sort_order: 100, // Default sort order for event products
      })
      .select()
      .single()

    if (createError || !newProduct) {
      console.error('[ICOUNT SYNC] Error creating product:', createError)
      return { success: false, error: createError?.message || 'Failed to create product' }
    }

    console.log('[ICOUNT SYNC] Created new product:', newProduct.id, productCode)

    // Sync new product to iCount in background
    syncProductToICountBackground(newProduct as ProductToSync)

    return {
      success: true,
      productId: newProduct.id,
      productCode,
      created: true,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT SYNC] Exception in ensureEventProductForFormula:', errorMsg)
    return { success: false, error: errorMsg }
  }
}

/**
 * Update the price of a product linked to a formula
 * Called when price_per_person changes on a formula
 */
export async function updateEventProductPrice(
  productId: string,
  newPrice: number,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[ICOUNT SYNC] updateEventProductPrice:', productId, newPrice)

  const supabase = createRawServiceClient()

  try {
    // Get the product
    const { data: product, error: findError } = await supabase
      .from('icount_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (findError || !product) {
      return { success: false, error: findError?.message || 'Product not found' }
    }

    // Update price
    const { error: updateError } = await supabase
      .from('icount_products')
      .update({ unit_price: newPrice })
      .eq('id', productId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Sync to iCount in background
    syncProductToICountBackground({
      ...product,
      unit_price: newPrice,
    } as ProductToSync)

    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMsg }
  }
}

/**
 * Delete a product linked to a formula
 * Called when a formula is deleted/deactivated
 * - Deactivates product in Supabase
 * - iCount sync will delete it when next sync runs
 */
export async function deleteEventProduct(
  productId: string,
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[ICOUNT SYNC] deleteEventProduct:', productId)

  const supabase = createRawServiceClient()

  try {
    // Get the product to check it's an EVENT product
    const { data: product, error: findError } = await supabase
      .from('icount_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (findError || !product) {
      return { success: false, error: findError?.message || 'Product not found' }
    }

    // Safety check: only delete products that start with 'event_'
    if (!product.code.startsWith('event_')) {
      console.warn('[ICOUNT SYNC] Refusing to delete non-event product:', product.code)
      return { success: false, error: 'Can only delete EVENT products' }
    }

    // Deactivate the product (soft delete)
    const { error: updateError } = await supabase
      .from('icount_products')
      .update({ is_active: false })
      .eq('id', productId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    console.log('[ICOUNT SYNC] Product deactivated:', product.code)
    console.log('[ICOUNT SYNC] Note: Product will be deleted from iCount on next sync')

    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMsg }
  }
}
