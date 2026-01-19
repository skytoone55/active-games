/**
 * iCount Sync Service
 * Synchronise les contacts ActiveLaser vers iCount
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ICountClient, ICountClientsModule } from '@/lib/payment-provider'
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
