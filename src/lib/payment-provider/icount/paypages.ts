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

export interface GenerateSaleParams extends Record<string, unknown> {
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
    sale_sid?: string
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
   * Get list of available PayPages
   */
  async getList(): Promise<{ success: boolean; data?: Array<{ paypage_id: number; name: string }>; error?: { message: string } }> {
    try {
      console.log('[PayPages] Calling get_list...')
      const result = await this.client.request('paypage', 'get_list', {})

      if (!result.success || !result.data) {
        console.error('[PayPages] get_list failed:', result.error)
        return {
          success: false,
          error: { message: result.error?.message || 'Failed to get PayPages list' }
        }
      }

      // The API response structure is: { status: true, paypages: { "5": { page_id: "5", page_name: "..." }, ... } }
      const data = result.data as unknown as { paypages?: Record<string, { page_id: string; page_name: string; [key: string]: unknown }> }

      if (!data.paypages || Object.keys(data.paypages).length === 0) {
        console.log('[PayPages] No paypages found in response')
        return {
          success: false,
          error: { message: 'No PayPages configured in iCount' }
        }
      }

      // Convert object to array
      const paypages = Object.values(data.paypages).map(pp => ({
        paypage_id: parseInt(pp.page_id),
        name: pp.page_name || 'PayPage'
      }))

      console.log('[PayPages] Extracted paypages:', JSON.stringify(paypages, null, 2))

      return {
        success: true,
        data: paypages
      }
    } catch (error) {
      console.error('[PayPages] get_list exception:', error)
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  /**
   * Generate a sale URL for hosted payment
   * Sale URL expires after 2 hours
   * If paypage_id is not provided, uses the first available PayPage
   */
  async generateSale(params: GenerateSaleParams): Promise<GenerateSaleResult> {
    // Auto-fetch PayPage ID if not provided
    if (!params.paypage_id) {
      const listResult = await this.getList()
      if (!listResult.success || !listResult.data || listResult.data.length === 0) {
        return {
          success: false,
          error: {
            message: 'No PayPages configured in iCount. Please create a PayPage first.',
            code: 'NO_PAYPAGE_FOUND'
          }
        }
      }
      params.paypage_id = listResult.data[0].paypage_id
    }
    try {
      const result = await this.client.request('paypage', 'generate_sale', params)

      if (!result.success || !result.data) {
        return {
          success: false,
          error: {
            message: result.error?.message || 'Failed to generate sale',
            code: 'GENERATE_SALE_FAILED'
          }
        }
      }

      const response = result.data as unknown as {
        paypage_id: string
        sale_uniqid: string
        sale_sid?: string
        sale_url: string
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
