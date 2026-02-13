import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

interface CodexEvent {
  id: string
  conversation_id: string
  branch_id: string | null
  event_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

function getDateRange(range: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (range === 'custom' && customStart && customEnd) {
    const s = new Date(customStart)
    const e = new Date(customEnd)
    s.setHours(0, 0, 0, 0)
    e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }

  if (range === 'week') start.setDate(start.getDate() - start.getDay())
  if (range === 'month') start.setDate(1)
  if (range === 'year') start.setMonth(0, 1)
  if (range === 'all') start.setFullYear(2020, 0, 1)

  return { start, end }
}

export async function GET(request: NextRequest) {
  const { success, user, errorResponse } = await verifyApiPermission('chat_stats', 'view')
  if (!success || !user) return errorResponse!

  if (user.role !== 'super_admin') {
    return NextResponse.json(
      { success: false, error: 'Super admin only' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || 'month'
  const branchFilter = searchParams.get('branch') || 'all'
  const customStart = searchParams.get('startDate') || undefined
  const customEnd = searchParams.get('endDate') || undefined
  const { start, end } = getDateRange(range, customStart, customEnd)

  const supabase = createServiceRoleClient() as any
  let query = supabase
    .from('clara_codex_whatsapp_events')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (branchFilter !== 'all') {
    query = query.eq('branch_id', branchFilter)
  }

  const { data, error } = await query
  if (error) {
    console.error('[Clara Codex Stats API] fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch codex stats' },
      { status: 500 }
    )
  }

  const events = (data || []) as CodexEvent[]
  const uniqueConversations = new Set(events.map(e => e.conversation_id))

  const countByType = (type: string) => events.filter(e => e.event_type === type).length
  const turns = countByType('conversation_turn')
  const replies = countByType('assistant_reply_sent')
  const escalations = countByType('escalated_to_human')
  const eventIntents = countByType('event_intent_detected')
  const techFallbacks = countByType('technical_fallback')
  const toolsCalled = countByType('tool_called')
  const toolResults = events.filter(e => e.event_type === 'tool_result')
  const toolErrors = toolResults.filter(e => (e.metadata as { hasError?: boolean } | null)?.hasError === true).length

  const escalationNoAgent = events.filter(e => {
    if (e.event_type !== 'escalated_to_human') return false
    const meta = e.metadata as { humanAvailable?: boolean } | null
    return meta?.humanAvailable === false
  }).length

  const byDayMap: Record<string, { turns: number; replies: number; escalations: number; toolErrors: number }> = {}
  for (const event of events) {
    const day = event.created_at.slice(0, 10)
    if (!byDayMap[day]) {
      byDayMap[day] = { turns: 0, replies: 0, escalations: 0, toolErrors: 0 }
    }
    if (event.event_type === 'conversation_turn') byDayMap[day].turns += 1
    if (event.event_type === 'assistant_reply_sent') byDayMap[day].replies += 1
    if (event.event_type === 'escalated_to_human') byDayMap[day].escalations += 1
    if (event.event_type === 'tool_result' && (event.metadata as { hasError?: boolean } | null)?.hasError) {
      byDayMap[day].toolErrors += 1
    }
  }

  const byDay = Object.entries(byDayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }))

  const branchStatsMap: Record<string, { conversations: Set<string>; escalations: number; replies: number; errors: number }> = {}
  for (const event of events) {
    const key = event.branch_id || 'unassigned'
    if (!branchStatsMap[key]) {
      branchStatsMap[key] = {
        conversations: new Set(),
        escalations: 0,
        replies: 0,
        errors: 0,
      }
    }
    branchStatsMap[key].conversations.add(event.conversation_id)
    if (event.event_type === 'escalated_to_human') branchStatsMap[key].escalations += 1
    if (event.event_type === 'assistant_reply_sent') branchStatsMap[key].replies += 1
    if (event.event_type === 'tool_result' && (event.metadata as { hasError?: boolean } | null)?.hasError) {
      branchStatsMap[key].errors += 1
    }
  }

  const branchBreakdown = Object.entries(branchStatsMap).map(([branchId, stats]) => ({
    branchId,
    conversations: stats.conversations.size,
    escalations: stats.escalations,
    replies: stats.replies,
    errors: stats.errors,
  }))

  return NextResponse.json({
    success: true,
    data: {
      kpis: {
        conversations: uniqueConversations.size,
        turns,
        replies,
        escalations,
        eventIntents,
        toolsCalled,
        toolErrors,
        techFallbacks,
        escalationNoAgent,
      },
      rates: {
        replyRate: turns > 0 ? Math.round((replies / turns) * 100) : 0,
        escalationRate: uniqueConversations.size > 0 ? Math.round((escalations / uniqueConversations.size) * 100) : 0,
        toolErrorRate: toolResults.length > 0 ? Math.round((toolErrors / toolResults.length) * 100) : 0,
      },
      byDay,
      branchBreakdown,
      totalEvents: events.length,
    },
  })
}
