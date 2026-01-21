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

// Types de paiement iCount pour les documents (invrec, receipt)
export interface ICountCreditCardPayment {
  sum: number                    // Montant payé par CB
  card_type?: string             // VISA, MASTERCARD, AMEX, etc.
  card_number?: string           // 4 derniers chiffres (ex: "0000")
  confirmation_code?: string     // Code de confirmation de la transaction
  exp_year?: number              // Année d'expiration
  exp_month?: number             // Mois d'expiration
  holder_id?: string             // ID du titulaire (Teudat Zehut)
  holder_name?: string           // Nom du titulaire
  date?: string                  // Date de transaction (YYYY-MM-DD)
  num_of_payments?: number       // Nombre de paiements (1 si paiement unique)
  first_payment?: number         // Premier paiement si échelonné
}

export interface ICountCashPayment {
  sum: number                    // Montant en espèces
}

export interface ICountChequePayment {
  sum: number                    // Montant du chèque
  date: string                   // Date du chèque (YYYY-MM-DD)
  bank: number                   // Code banque
  branch: number                 // Code agence
  account: number                // Numéro de compte
  number: number                 // Numéro du chèque
}

export interface ICountBankTransferPayment {
  sum: number                    // Montant du virement
  date: string                   // Date du virement (YYYY-MM-DD)
  account?: number               // ID compte bancaire de destination dans iCount
}

export interface CreateDocumentParams {
  doctype: ICountDocType
  client_id?: number              // iCount client ID
  custom_client_id?: string       // ActiveLaser UUID (contact.id)
  client_name?: string            // Nom du client (si pas de client_id)
  email?: string                  // Email client
  phone?: string                  // Téléphone client
  doc_date?: string               // YYYY-MM-DD (défaut: aujourd'hui)
  duedate?: string                // Date d'échéance (pour offer/order)
  currency_code?: string          // "ILS" par défaut
  items: ICountDocumentItem[]
  hwc?: string                    // Commentaires additionnels
  doc_title?: string              // Titre du document
  sanity_string?: string          // Pour éviter les doublons (max 30 chars)
  send_email?: boolean            // Envoyer par email
  doc_lang?: string               // Langue du document (he/en/fr)
  // Paiements (pour invrec/receipt uniquement)
  cc?: ICountCreditCardPayment    // Paiement par carte de crédit
  cash?: ICountCashPayment        // Paiement en espèces
  cheques?: ICountChequePayment[] // Paiements par chèque(s)
  banktransfer?: ICountBankTransferPayment // Paiement par virement
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
    if (params.phone) requestParams.phone = params.phone

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

    // Paiements (pour invrec/receipt)
    if (params.cc) {
      requestParams.cc = {
        sum: params.cc.sum,
        ...(params.cc.card_type && { card_type: params.cc.card_type }),
        ...(params.cc.card_number && { card_number: params.cc.card_number }),
        ...(params.cc.confirmation_code && { confirmation_code: params.cc.confirmation_code }),
        ...(params.cc.exp_year && { exp_year: params.cc.exp_year }),
        ...(params.cc.exp_month && { exp_month: params.cc.exp_month }),
        ...(params.cc.holder_id && { holder_id: params.cc.holder_id }),
        ...(params.cc.holder_name && { holder_name: params.cc.holder_name }),
        ...(params.cc.date && { date: params.cc.date }),
        ...(params.cc.num_of_payments && { num_of_payments: params.cc.num_of_payments }),
        ...(params.cc.first_payment && { first_payment: params.cc.first_payment }),
      }
    }

    if (params.cash) {
      requestParams.cash = { sum: params.cash.sum }
    }

    if (params.cheques && params.cheques.length > 0) {
      requestParams.cheques = params.cheques.map(cheque => ({
        sum: cheque.sum,
        date: cheque.date,
        bank: cheque.bank,
        branch: cheque.branch,
        account: cheque.account,
        number: cheque.number,
      }))
    }

    if (params.banktransfer) {
      requestParams.banktransfer = {
        sum: params.banktransfer.sum,
        date: params.banktransfer.date,
        ...(params.banktransfer.account && { account: params.banktransfer.account }),
      }
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
    reason?: string,
    refundCreditCard?: boolean
  ): Promise<ProviderResult<void>> {
    console.log('[ICOUNT DOCS] Cancelling document:', doctype, docnum, refundCreditCard ? '(with CC refund)' : '')

    const result = await this.client.request<ICountCancelResponse>('doc', 'cancel', {
      doctype,
      docnum,
      reason: reason || 'Cancelled via ActiveLaser',
      ...(refundCreditCard && { refund_cc: true }),
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
   * Annuler un document ET rembourser la transaction CB associée
   */
  async cancelDocumentWithRefund(
    doctype: ICountDocType,
    docnum: number,
    reason?: string
  ): Promise<ProviderResult<void>> {
    return this.cancelDocument(doctype, docnum, reason, true)
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
