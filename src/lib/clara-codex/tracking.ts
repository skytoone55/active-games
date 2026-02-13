import { createServiceRoleClient } from '@/lib/supabase/service-role'

const EVENTS_TABLE = 'clara_codex_whatsapp_events'
const PRESENCE_TABLE = 'clara_codex_agent_presence'

export async function trackCodexEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  branchId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from(EVENTS_TABLE).insert({
      conversation_id: conversationId,
      branch_id: branchId,
      event_type: eventType,
      metadata,
    })
  } catch (error) {
    console.error('[CLARA CODEX] Failed to track event:', eventType, error)
  }
}

export async function getAvailableHumanStatus(branchId: string | null | undefined): Promise<{
  available: boolean
  connectedCount: number
}> {
  const supabase = createServiceRoleClient() as any
  const now = Date.now()
  const thresholdISO = new Date(now - 2 * 60 * 1000).toISOString()

  let query = supabase
    .from(PRESENCE_TABLE)
    .select('user_id, role', { count: 'exact' })
    .gte('last_seen_at', thresholdISO)
    .neq('role', 'super_admin')

  if (branchId) {
    query = query.contains('branch_ids', [branchId])
  }

  const { count, error } = await query.limit(10)
  if (error) {
    console.error('[CLARA CODEX] Presence check failed:', error)
    return { available: false, connectedCount: 0 }
  }

  const connectedCount = count || 0
  return {
    available: connectedCount > 0,
    connectedCount,
  }
}

export async function upsertCodexAgentPresence(params: {
  userId: string
  role: string
  branchIds: string[]
}) {
  const supabase = createServiceRoleClient() as any
  const nowISO = new Date().toISOString()

  const { error } = await supabase
    .from(PRESENCE_TABLE)
    .upsert({
      user_id: params.userId,
      role: params.role,
      branch_ids: params.branchIds,
      last_seen_at: nowISO,
      updated_at: nowISO,
    }, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Failed to upsert presence: ${error.message}`)
  }
}
