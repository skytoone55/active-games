/**
 * iCount PayPages Module
 * Handles hosted payment pages for PCI-DSS compliance
 *
 * Documentation: ~/Desktop/claude/data/icount/PayPages-API.yaml
 */

import type { ICountClient } from './client'

export interface PayPageItem {
  description: string
  unitprice_incl?: number
  unitprice?: number
  quantity?: number
}

export interface GenerateSaleParams {
  paypage_id: number
  currency_id?: number
  currency_code?: string
  items?: PayPageItem[]
  sum?: number
  description?: string

  // Client info
  client_name?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string

  // Payment config
  max_payments?: number
  page_lang?: 'en' | 'he' | 'auto'

  // URLs
  success_url?: string
  failure_url?: string
  cancel_url?: string
  ipn_url: string // REQUIRED for webhooks

  // iframe mode
  is_iframe?: boolean

  // Metadata
  income_type_id?: number
  client_type_id?: number
}

export interface GenerateSaleResult {
  success: boolean
  data?: {
    paypage_id: string
    sale_uniqid: string // IMPORTANT: Use for idempotence
    sale_sid: string
    sale_url: string
  }
  error?: {
    message: string
    code?: string
  }
}

export class ICountPayPagesModule {
  constructor(private client: ICountClient) {}

  /**
   * Generate a sale URL for hosted payment
   * Sale URL expires after 2 hours
   */
  async generateSale(params: GenerateSaleParams): Promise<GenerateSaleResult> {
    try {
      const response = await this.client.request('paypage', 'generate_sale', params)

      if (!response.status) {
        return {
          success: false,
          error: {
            message: response.reason || 'Failed to generate sale',
            code: 'GENERATE_SALE_FAILED'
          }
        }
      }

      return {
        success: true,
        data: {
          paypage_id: response.paypage_id,
          sale_uniqid: response.sale_uniqid,
          sale_sid: response.sale_sid,
          sale_url: response.sale_url,
        }
      }
    } catch (error) {
      console.error('[iCount PayPages] Generate sale error:', error)
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'NETWORK_ERROR'
        }
      }
    }
  }
}

/**
 * Webhook payload from iCount PayPages
 * Sent to ipn_url after successful payment
 */
export interface PayPageWebhookPayload {
  // Sale identification
  sale_uniqid: string
  sale_sid: string
  paypage_id: number

  // Payment result
  status: 'completed' | 'failed' | 'cancelled'
  transaction_id?: string
  confirmation_code?: string

  // Document info
  doctype?: string
  docnum?: number
  doc_url?: string

  // Card info (masked)
  cc_last4?: string
  cc_type?: string

  // Amount
  amount: number
  currency: string

  // Client
  client_name?: string
  email?: string
  phone?: string

  // Timestamp
  timestamp: number
}
