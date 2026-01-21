/**
 * Payment Provider Abstraction Layer - Main Exports
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ICountClient } from './icount/client'
import { ICountCreditCardModule } from './icount/credit-card'
import { ICountClientsModule } from './icount/clients'
import { ICountDocumentsModule } from './icount/documents'

// Types
export * from './types'

// iCount Client & Modules
export { ICountClient, ICountClientsModule, ICountDocumentsModule, ICountItemsModule, ICountCreditCardModule } from './icount'
export type {
  ICountDocType,
  ICountDocumentItem,
  CreateDocumentParams,
  DocumentResult,
  DocumentInfo,
  ItemData,
  SyncItemResult,
  CreditCardInfo,
  StoredCardInfo,
  J5PreapprovalResult,
  BillResult,
  StoreCardParams,
  J5PreapprovalParams,
  BillCardParams,
  GetTokenParams,
} from './icount'

/**
 * Unified Payment Provider with all modules
 */
export interface PaymentProviderModules {
  client: ICountClient
  creditCard: ICountCreditCardModule
  clients: ICountClientsModule
  documents: ICountDocumentsModule
}

// Cache for payment providers by branch
const providerCache = new Map<string, { provider: PaymentProviderModules; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Create a raw Supabase client for fetching credentials
 */
function createRawServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Get payment provider for a branch
 * Initializes iCount client with branch credentials and all modules
 */
export async function getPaymentProvider(branchId: string): Promise<PaymentProviderModules | null> {
  // Check cache
  const cached = providerCache.get(branchId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.provider
  }

  const supabase = createRawServiceClient()

  // Get credentials from database
  const { data, error } = await supabase
    .from('payment_credentials')
    .select('cid, username, password')
    .eq('branch_id', branchId)
    .eq('provider', 'icount')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error('No payment credentials found for branch:', branchId)
    return null
  }

  // Create iCount client
  const client = new ICountClient({
    cid: data.cid,
    user: data.username,
    pass: data.password,
  })

  // Create all modules
  const provider: PaymentProviderModules = {
    client,
    creditCard: new ICountCreditCardModule(client),
    clients: new ICountClientsModule(client),
    documents: new ICountDocumentsModule(client),
  }

  // Cache the provider
  providerCache.set(branchId, {
    provider,
    expiresAt: Date.now() + CACHE_TTL,
  })

  return provider
}

/**
 * Clear cached provider for a branch (e.g., when credentials are updated)
 */
export function clearPaymentProviderCache(branchId?: string): void {
  if (branchId) {
    providerCache.delete(branchId)
  } else {
    providerCache.clear()
  }
}
