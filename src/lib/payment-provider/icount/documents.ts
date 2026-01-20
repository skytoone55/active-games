/**
 * iCount Documents Module
 * Gestion des documents comptables (devis, factures, reçus)
 */

import { ICountClient } from './client'
import type { ProviderResult } from '../types'

// Types pour les documents iCount
export type ICountDocType = 'offer' | 'invoice' | 'receipt' | 'invrec' | 'deal' | 'order'

export interface ICountDocumentItem {
  description: string
  quantity: number
  unitprice?: number          // Prix HT (before VAT)
  unitprice_incvat?: number   // Prix TTC (including VAT) - préféré
  sku?: string
  inventory_item_id?: string
}

export interface CreateDocumentParams {
  doctype: ICountDocType
  client_id?: number              // iCount client ID
  custom_client_id?: string       // ActiveLaser UUID (contact.id)
  client_name?: string            // Nom du client (si pas de client_id)
  email?: string                  // Email client
  doc_date?: string               // YYYY-MM-DD (défaut: aujourd'hui)
  duedate?: string                // Date d'échéance (pour offer/order)
  currency_code?: string          // "ILS" par défaut
  items: ICountDocumentItem[]
  hwc?: string                    // Commentaires additionnels
  doc_title?: string              // Titre du document
  sanity_string?: string          // Pour éviter les doublons (max 30 chars)
  send_email?: boolean            // Envoyer par email
  doc_lang?: string               // Langue du document (he/en/fr)
}

export interface DocumentResult {
  doctype: string
  docnum: number
  doc_url?: string
  doc_copy_url?: string
  client_id?: number
  custom_client_id?: string
}

export interface DocumentInfo {
  doctype: string
  docnum: number
  client_id: number
  client_name: string
  doc_date: string
  currency_code: string
  totalsum: number
  totalwithvat: number
  status: number // 0=open, 1=closed, 2=partially closed
  items?: ICountDocumentItem[]
  doc_url?: string
  pdf_link?: string
}

interface ICountCreateResponse {
  status: boolean
  doctype?: string
  docnum?: number
  doc_url?: string
  doc_copy_url?: string
  client_id?: number
  custom_client_id?: string
  reason?: string
  error_description?: string
  [key: string]: unknown
}

interface ICountInfoResponse {
  status: boolean
  doctype?: string
  docnum?: number
  client_id?: number
  client_name?: string
  doc_date?: string
  currency_code?: string
  totalsum?: number
  totalwithvat?: number
  doc_status?: number
  items?: Array<{
    description: string
    unitprice: number
    quantity: number
  }>
  doc_url?: string
  pdf_link?: string
  reason?: string
  error_description?: string
  [key: string]: unknown
}

interface ICountCancelResponse {
  status: boolean
  reason?: string
  error_description?: string
  [key: string]: unknown
}

/**
 * Module de gestion des documents iCount
 */
export class ICountDocumentsModule {
  private client: ICountClient

  constructor(client: ICountClient) {
    this.client = client
  }

  /**
   * Créer un document (devis, facture, reçu, etc.)
   */
  async createDocument(params: CreateDocumentParams): Promise<ProviderResult<DocumentResult>> {
    const requestParams: Record<string, unknown> = {
      doctype: params.doctype,
      currency_code: params.currency_code || 'ILS',
      items: params.items.map(item => ({
        description: item.description,
        unitprice: item.unitprice,
        quantity: item.quantity,
        ...(item.unitprice_incvat && { unitprice_incvat: item.unitprice_incvat }),
        ...(item.sku && { sku: item.sku }),
      })),
    }

    // Client identification (order of priority)
    if (params.client_id) {
      requestParams.client_id = params.client_id
    } else if (params.custom_client_id) {
      requestParams.custom_client_id = params.custom_client_id
    }

    // Optional client info
    if (params.client_name) requestParams.client_name = params.client_name
    if (params.email) requestParams.email = params.email

    // Dates
    if (params.doc_date) requestParams.doc_date = params.doc_date
    if (params.duedate) requestParams.duedate = params.duedate

    // Metadata
    if (params.hwc) requestParams.hwc = params.hwc
    if (params.doc_title) requestParams.doc_title = params.doc_title
    if (params.sanity_string) requestParams.sanity_string = params.sanity_string.slice(0, 30)
    if (params.doc_lang) requestParams.doc_lang = params.doc_lang

    // Email
    if (params.send_email) {
      requestParams.send_email = true
      requestParams.email_to_client = true
    }

    console.log('[ICOUNT DOCS] Creating document:', params.doctype, 'sanity:', params.sanity_string)

    const result = await this.client.request<ICountCreateResponse>('doc', 'create', requestParams)

    if (result.success && result.data) {
      const data = result.data
      if (data.docnum) {
        console.log('[ICOUNT DOCS] Document created:', data.doctype, data.docnum)
        return {
          success: true,
          data: {
            doctype: data.doctype || params.doctype,
            docnum: data.docnum,
            doc_url: data.doc_url,
            doc_copy_url: data.doc_copy_url,
            client_id: data.client_id,
            custom_client_id: data.custom_client_id,
          },
        }
      }
    }

    // Handle duplicate sanity_string error (document already exists)
    if (result.data?.reason === 'doc_exists_based_on_sanity_string') {
      console.log('[ICOUNT DOCS] Document already exists (sanity_string duplicate)')
      return {
        success: true, // Consider it a success - document exists
        data: {
          doctype: result.data.doctype || params.doctype,
          docnum: result.data.docnum || 0,
          doc_url: result.data.doc_url,
          doc_copy_url: result.data.doc_copy_url,
          client_id: result.data.client_id,
          custom_client_id: result.data.custom_client_id,
        },
      }
    }

    console.error('[ICOUNT DOCS] Failed to create document:', result.error)
    return {
      success: false,
      error: result.error || {
        code: 'create_failed',
        message: 'Failed to create document',
      },
    }
  }

  /**
   * Récupérer les informations d'un document
   */
  async getDocument(doctype: ICountDocType, docnum: number): Promise<ProviderResult<DocumentInfo>> {
    const result = await this.client.request<ICountInfoResponse>('doc', 'info', {
      doctype,
      docnum,
      get_items: true,
      get_pdf_link: true,
    })

    if (result.success && result.data) {
      const data = result.data
      return {
        success: true,
        data: {
          doctype: data.doctype || doctype,
          docnum: data.docnum || docnum,
          client_id: data.client_id || 0,
          client_name: data.client_name || '',
          doc_date: data.doc_date || '',
          currency_code: data.currency_code || 'ILS',
          totalsum: data.totalsum || 0,
          totalwithvat: data.totalwithvat || 0,
          status: data.doc_status || 0,
          items: data.items,
          doc_url: data.doc_url,
          pdf_link: data.pdf_link,
        },
      }
    }

    return {
      success: false,
      error: result.error || {
        code: 'get_failed',
        message: 'Failed to get document info',
      },
    }
  }

  /**
   * Annuler un document
   */
  async cancelDocument(
    doctype: ICountDocType,
    docnum: number,
    reason?: string
  ): Promise<ProviderResult<void>> {
    console.log('[ICOUNT DOCS] Cancelling document:', doctype, docnum)

    const result = await this.client.request<ICountCancelResponse>('doc', 'cancel', {
      doctype,
      docnum,
      reason: reason || 'Cancelled via ActiveLaser',
    })

    if (result.success) {
      console.log('[ICOUNT DOCS] Document cancelled:', doctype, docnum)
      return { success: true }
    }

    console.error('[ICOUNT DOCS] Failed to cancel document:', result.error)
    return {
      success: false,
      error: result.error || {
        code: 'cancel_failed',
        message: 'Failed to cancel document',
      },
    }
  }

  /**
   * Créer un devis (offer)
   * Raccourci pour createDocument avec doctype='offer'
   */
  async createOffer(
    params: Omit<CreateDocumentParams, 'doctype'>
  ): Promise<ProviderResult<DocumentResult>> {
    return this.createDocument({ ...params, doctype: 'offer' })
  }

  /**
   * Créer une facture+reçu combiné (invrec / חשבונית מס קבלה)
   * Raccourci pour createDocument avec doctype='invrec'
   */
  async createInvoiceReceipt(
    params: Omit<CreateDocumentParams, 'doctype'>
  ): Promise<ProviderResult<DocumentResult>> {
    return this.createDocument({ ...params, doctype: 'invrec' })
  }

  /**
   * Convertir un devis en facture+reçu (basé sur le devis)
   * Utile quand un paiement est reçu après un devis
   */
  async convertOfferToInvoiceReceipt(
    offerDocnum: number,
    additionalParams?: Partial<CreateDocumentParams>
  ): Promise<ProviderResult<DocumentResult>> {
    const params: CreateDocumentParams = {
      doctype: 'invrec',
      items: additionalParams?.items || [],
      ...additionalParams,
    }

    // Ajouter la référence au document de base
    const requestParams: Record<string, unknown> = {
      doctype: 'invrec',
      based_on: [{ doctype: 'offer', docnum: offerDocnum }],
      currency_code: params.currency_code || 'ILS',
    }

    if (params.client_id) requestParams.client_id = params.client_id
    if (params.custom_client_id) requestParams.custom_client_id = params.custom_client_id
    if (params.items && params.items.length > 0) {
      requestParams.items = params.items.map(item => ({
        description: item.description,
        unitprice: item.unitprice,
        quantity: item.quantity,
      }))
    }
    if (params.sanity_string) requestParams.sanity_string = params.sanity_string.slice(0, 30)

    console.log('[ICOUNT DOCS] Converting offer to invrec, offer:', offerDocnum)

    const result = await this.client.request<ICountCreateResponse>('doc', 'create', requestParams)

    if (result.success && result.data?.docnum) {
      console.log('[ICOUNT DOCS] InvRec created:', result.data.docnum)
      return {
        success: true,
        data: {
          doctype: result.data.doctype || 'invrec',
          docnum: result.data.docnum,
          doc_url: result.data.doc_url,
          doc_copy_url: result.data.doc_copy_url,
          client_id: result.data.client_id,
          custom_client_id: result.data.custom_client_id,
        },
      }
    }

    return {
      success: false,
      error: result.error || {
        code: 'convert_failed',
        message: 'Failed to convert offer to invoice/receipt',
      },
    }
  }
}
