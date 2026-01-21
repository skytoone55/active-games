/**
 * iCount Credit Card Module
 * Gestion des paiements par carte de crédit, tokenisation et pré-autorisation
 */

import { ICountClient } from './client'
import type { ProviderResult } from '../types'

// Types pour les opérations de carte de crédit
export interface CreditCardInfo {
  cc_number: string      // Numéro de carte
  cc_validity: string    // Format MMYY ou YYYY-MM
  cc_cvv: string         // CVV (3-4 chiffres)
  cc_holder_id: string   // ID du titulaire (Teudat Zehut en Israël)
  cc_holder_name?: string // Nom du titulaire
}

export interface StoredCardInfo {
  token_id: number
  cc_last4: string
  cc_type: string
  cc_validity: string
  cc_holder_name?: string
}

export interface J5PreapprovalResult {
  confirmation_code: string
  transaction_id: string
  cc_last4: string
  cc_type: string
}

export interface BillResult {
  transaction_id: string
  confirmation_code: string
  cc_last4: string
  cc_type: string
  amount: number
  currency: string
}

export interface StoreCardParams {
  clientId?: number        // Client iCount ID
  customClientId?: string  // ID client externe (notre contact_id)
  email?: string
  clientName?: string
  cardInfo: CreditCardInfo
}

export interface J5PreapprovalParams {
  cardInfo: CreditCardInfo
  amount: number           // Montant à pré-autoriser (minimum 5₪)
  currencyCode?: string    // Default: ILS
}

export interface BillCardParams {
  // Identification client
  clientId?: number
  customClientId?: string
  email?: string
  clientName?: string
  // Carte (token OU données directes)
  tokenId?: number         // Utiliser un token stocké
  cardInfo?: CreditCardInfo // OU données carte directes
  // Montant
  amount: number
  currencyCode?: string    // Default: ILS
  // Options
  useJ5IfAvailable?: boolean // Utiliser une pré-autorisation existante
  numPayments?: number       // Nombre de paiements (pour paiements échelonnés)
  firstPayment?: number      // Montant du premier paiement
  description?: string       // Description du paiement
  isTest?: boolean           // Mode test (ne contacte pas le processeur)
}

export interface GetTokenParams {
  clientId?: number
  customClientId?: string
  email?: string
  tokenId?: number
}

// Interface pour les réponses iCount
interface ICountCCResponse {
  status: boolean
  reason?: string
  error_description?: string
  error_details?: string[]
  // Store card response
  cc_token_id?: number
  // J5 response
  confirmation_code?: string
  transaction_id?: string
  // Bill response
  cc_last4?: string
  cc_type?: string
  cc_validity?: string
  sum?: number
  currency?: string
  currency_code?: string
  // Token info response
  tokens?: Array<{
    cc_token_id: number
    cc_last4: string
    cc_type: string
    cc_validity: string
    cc_holder_name?: string
  }>
  // Index signature for compatibility with ICountApiResponse
  [key: string]: unknown
}

export class ICountCreditCardModule {
  constructor(private client: ICountClient) {}

  /**
   * Stocker les informations d'une carte de crédit (tokenisation)
   * Retourne un token réutilisable pour les paiements futurs
   */
  async storeCard(params: StoreCardParams): Promise<ProviderResult<StoredCardInfo>> {
    const result = await this.client.request<ICountCCResponse>('cc', 'store_card_info', {
      client_id: params.clientId,
      custom_client_id: params.customClientId,
      email: params.email,
      client_name: params.clientName,
      cc_number: params.cardInfo.cc_number,
      cc_validity: params.cardInfo.cc_validity,
      cc_cvv: params.cardInfo.cc_cvv,
      cc_holder_id: params.cardInfo.cc_holder_id,
      cc_holder_name: params.cardInfo.cc_holder_name,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || { code: 'store_failed', message: 'Failed to store card' },
      }
    }

    const data = result.data
    if (!data.cc_token_id) {
      return {
        success: false,
        error: { code: 'no_token', message: 'No token returned' },
      }
    }

    return {
      success: true,
      data: {
        token_id: data.cc_token_id,
        cc_last4: data.cc_last4 || params.cardInfo.cc_number.slice(-4),
        cc_type: data.cc_type || 'unknown',
        cc_validity: data.cc_validity || params.cardInfo.cc_validity,
        cc_holder_name: params.cardInfo.cc_holder_name,
      },
    }
  }

  /**
   * Créer une pré-autorisation J5 (empreinte carte)
   * La carte est vérifiée et le montant est "réservé" sans être débité
   */
  async createJ5Preapproval(params: J5PreapprovalParams): Promise<ProviderResult<J5PreapprovalResult>> {
    if (params.amount < 5) {
      return {
        success: false,
        error: { code: 'amount_too_low', message: 'Minimum amount for J5 is 5 ILS' },
      }
    }

    // Format cc_validity: même format que pour bill (MMYY)
    // Note: L'API J5 retourne "bad_cc_validity" - à investiguer avec le support iCount
    const formattedValidity = params.cardInfo.cc_validity.replace('/', '')

    console.log('[ICOUNT J5] Validity:', formattedValidity)

    const result = await this.client.request<ICountCCResponse>('cc', 'j5', {
      cc_number: params.cardInfo.cc_number,
      cc_validity: formattedValidity,
      cc_cvv: params.cardInfo.cc_cvv,
      cc_holder_id: params.cardInfo.cc_holder_id,
      sum: params.amount,
      currency_code: params.currencyCode || 'ILS',
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || { code: 'j5_failed', message: 'J5 preapproval failed' },
      }
    }

    const data = result.data
    if (!data.confirmation_code) {
      return {
        success: false,
        error: { code: 'no_confirmation', message: 'No confirmation code returned' },
      }
    }

    return {
      success: true,
      data: {
        confirmation_code: data.confirmation_code,
        transaction_id: data.transaction_id || '',
        cc_last4: data.cc_last4 || params.cardInfo.cc_number.slice(-4),
        cc_type: data.cc_type || 'unknown',
      },
    }
  }

  /**
   * Débiter une carte de crédit
   * Peut utiliser un token stocké ou les données carte directes
   * Peut utiliser une pré-autorisation J5 existante
   */
  async billCard(params: BillCardParams): Promise<ProviderResult<BillResult>> {
    if (!params.tokenId && !params.cardInfo) {
      return {
        success: false,
        error: { code: 'missing_card', message: 'Either tokenId or cardInfo is required' },
      }
    }

    const requestParams: Record<string, unknown> = {
      sum: params.amount,
      currency_code: params.currencyCode || 'ILS',
      payment_description: params.description,
      is_test: params.isTest,
    }

    // Identification client
    if (params.clientId) requestParams.client_id = params.clientId
    if (params.customClientId) requestParams.custom_client_id = params.customClientId
    if (params.email) requestParams.email = params.email
    if (params.clientName) requestParams.client_name = params.clientName

    // Carte
    if (params.tokenId) {
      requestParams.cc_token_id = params.tokenId
    } else if (params.cardInfo) {
      requestParams.cc_number = params.cardInfo.cc_number
      requestParams.cc_validity = params.cardInfo.cc_validity
      requestParams.cc_cvv = params.cardInfo.cc_cvv
      requestParams.cc_holder_id = params.cardInfo.cc_holder_id
      requestParams.cc_holder_name = params.cardInfo.cc_holder_name
    }

    // Options
    if (params.useJ5IfAvailable) {
      requestParams.use_j5_if_available = true
    }
    if (params.numPayments && params.numPayments > 1) {
      requestParams.num_of_payments = params.numPayments
      if (params.firstPayment) {
        requestParams.first_payment = params.firstPayment
      }
    }

    const result = await this.client.request<ICountCCResponse>('cc', 'bill', requestParams)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || { code: 'bill_failed', message: 'Card billing failed' },
      }
    }

    const data = result.data
    if (!data.confirmation_code) {
      return {
        success: false,
        error: { code: 'no_confirmation', message: 'No confirmation code returned' },
      }
    }

    return {
      success: true,
      data: {
        transaction_id: data.transaction_id || '',
        confirmation_code: data.confirmation_code,
        cc_last4: data.cc_last4 || '',
        cc_type: data.cc_type || 'unknown',
        amount: data.sum || params.amount,
        currency: data.currency_code || params.currencyCode || 'ILS',
      },
    }
  }

  /**
   * Récupérer les informations d'un token de carte stockée
   */
  async getTokenInfo(params: GetTokenParams): Promise<ProviderResult<StoredCardInfo[]>> {
    const result = await this.client.request<ICountCCResponse>('cc', 'get_token_info', {
      client_id: params.clientId,
      custom_client_id: params.customClientId,
      email: params.email,
      cc_token_id: params.tokenId,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || { code: 'get_token_failed', message: 'Failed to get token info' },
      }
    }

    const data = result.data
    const tokens = data.tokens || []

    return {
      success: true,
      data: tokens.map(t => ({
        token_id: t.cc_token_id,
        cc_last4: t.cc_last4,
        cc_type: t.cc_type,
        cc_validity: t.cc_validity,
        cc_holder_name: t.cc_holder_name,
      })),
    }
  }

  /**
   * Valider une carte (vérifie que les infos sont correctes sans débiter)
   */
  async validateCard(cardInfo: CreditCardInfo): Promise<ProviderResult<{ valid: boolean; cc_type?: string }>> {
    const result = await this.client.request<ICountCCResponse>('cc', 'validate_card_cvv', {
      cc_number: cardInfo.cc_number,
      cc_validity: cardInfo.cc_validity,
      cc_cvv: cardInfo.cc_cvv,
      cc_holder_id: cardInfo.cc_holder_id,
    })

    if (!result.success) {
      return {
        success: true,
        data: { valid: false },
      }
    }

    return {
      success: true,
      data: {
        valid: true,
        cc_type: result.data?.cc_type,
      },
    }
  }

  /**
   * Détecter le type de carte à partir du numéro
   */
  async detectCardType(ccNumber: string): Promise<ProviderResult<{ cc_type: string }>> {
    const result = await this.client.request<ICountCCResponse>('cc', 'detect_cc_type', {
      cc_number: ccNumber,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || { code: 'detect_failed', message: 'Failed to detect card type' },
      }
    }

    return {
      success: true,
      data: {
        cc_type: result.data.cc_type || 'unknown',
      },
    }
  }
}
