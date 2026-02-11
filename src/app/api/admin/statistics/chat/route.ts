/**
 * API pour récupérer les statistiques de chat (WhatsApp + Messenger)
 * Permission requise : chat_stats.view
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

function getDateRange(range: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date()
  let end = new Date(now)
  end.setHours(23, 59, 59, 999)
  let start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (range === 'custom' && customStart && customEnd) {
    start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  switch (range) {
    case 'today': break
    case 'week': start.setDate(start.getDate() - start.getDay()); break
    case 'month': start.setDate(1); break
    case 'year': start.setMonth(0, 1); break
    case 'all': start = new Date('2020-01-01'); break
  }

  return { start, end }
}

export async function GET(request: NextRequest) {
  // Vérifier permission chat_stats.view
  const { success, user, errorResponse } = await verifyApiPermission('chat_stats', 'view')
  if (!success || !user) return errorResponse!

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || 'month'
  const branchFilter = searchParams.get('branch') || 'all'
  const customStart = searchParams.get('startDate') || undefined
  const customEnd = searchParams.get('endDate') || undefined

  const { start, end } = getDateRange(range, customStart, customEnd)
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  const supabase = createServiceRoleClient()

  try {
    // --- WHATSAPP ---

    // 1. Fetch all WhatsApp messages in date range (with branch filter)
    let waMessagesQuery = supabase
      .from('whatsapp_messages')
      .select('id, conversation_id, direction, sent_by, created_at, status')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: true })

    // If branch filter, get conversation IDs for that branch first
    let conversationIdsForBranch: string[] | null = null
    if (branchFilter !== 'all') {
      const { data: branchConvs } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('branch_id', branchFilter)
      conversationIdsForBranch = (branchConvs as { id: string }[] | null)?.map(c => c.id) || []
      if (conversationIdsForBranch.length === 0) {
        return NextResponse.json({ success: true, data: getEmptyStats() })
      }
      waMessagesQuery = waMessagesQuery.in('conversation_id', conversationIdsForBranch)
    }

    // Types for query results
    type WaMessage = { id: string; conversation_id: string; direction: string; sent_by: string | null; created_at: string; status: string }
    type WaConv = { id: string; phone: string; contact_name: string; branch_id: string; unread_count: number; status: string; last_message_at: string; created_at: string }
    type MsgConv = { id: string; branch_id: string; status: string; started_at: string; last_activity_at: string; completed_at: string | null }
    type MsgMessage = { id: string; conversation_id: string; role: string; created_at: string }
    type ProfileRow = { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

    const { data: waMessagesRaw, error: waError } = await waMessagesQuery
    if (waError) throw waError
    const waMessages = (waMessagesRaw || []) as WaMessage[]

    // 2. Fetch WhatsApp conversations
    let waConvsQuery = supabase
      .from('whatsapp_conversations')
      .select('id, phone, contact_name, branch_id, unread_count, status, last_message_at, created_at')
    if (branchFilter !== 'all') {
      waConvsQuery = waConvsQuery.eq('branch_id', branchFilter)
    }
    const { data: waConvsRaw } = await waConvsQuery
    const waConvs = (waConvsRaw || []) as WaConv[]

    // --- MESSENGER ---

    // 3. Fetch Messenger conversations in date range
    let msgConvsQuery = supabase
      .from('messenger_conversations')
      .select('id, branch_id, status, started_at, last_activity_at, completed_at')
      .gte('started_at', startISO)
      .lte('started_at', endISO)
    if (branchFilter !== 'all') {
      msgConvsQuery = msgConvsQuery.eq('branch_id', branchFilter)
    }
    const { data: msgConvsRaw } = await msgConvsQuery
    const msgConvs = (msgConvsRaw || []) as MsgConv[]

    // 4. Fetch Messenger messages in date range
    const messengerConvIds = msgConvs.map(c => c.id)
    let msgMessages: MsgMessage[] = []
    if (messengerConvIds.length > 0) {
      const { data } = await supabase
        .from('messenger_messages')
        .select('id, conversation_id, role, created_at')
        .in('conversation_id', messengerConvIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
      msgMessages = (data || []) as MsgMessage[]
    }

    // --- PROFILES for agent names ---
    const agentIds = new Set<string>()
    waMessages.forEach(m => { if (m.sent_by) agentIds.add(m.sent_by) })

    let agentProfiles: Record<string, string> = {}
    if (agentIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', Array.from(agentIds))
      const profileRows = (profiles || []) as ProfileRow[]
      profileRows.forEach(p => {
        agentProfiles[p.id] = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Inconnu'
      })
    }

    // --- COMPUTE STATS ---

    const msgs = waMessages

    // Group messages by conversation
    const msgsByConv: Record<string, typeof msgs> = {}
    msgs.forEach(m => {
      if (!msgsByConv[m.conversation_id]) msgsByConv[m.conversation_id] = []
      msgsByConv[m.conversation_id].push(m)
    })

    // Compute response times: for each inbound message, find the next outbound message
    const responseTimes: { seconds: number; agentId: string | null }[] = []
    Object.values(msgsByConv).forEach(convMsgs => {
      for (let i = 0; i < convMsgs.length; i++) {
        if (convMsgs[i].direction === 'inbound') {
          // Find next outbound message
          for (let j = i + 1; j < convMsgs.length; j++) {
            if (convMsgs[j].direction === 'outbound') {
              const inboundTime = new Date(convMsgs[i].created_at).getTime()
              const outboundTime = new Date(convMsgs[j].created_at).getTime()
              const diffSeconds = (outboundTime - inboundTime) / 1000
              // Only count reasonable response times (< 24h)
              if (diffSeconds > 0 && diffSeconds < 86400) {
                responseTimes.push({ seconds: diffSeconds, agentId: convMsgs[j].sent_by })
              }
              break // Only first response counts
            }
            // If another inbound comes before outbound, skip (unanswered)
            if (convMsgs[j].direction === 'inbound') break
          }
        }
      }
    })

    // Average response time
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, rt) => sum + rt.seconds, 0) / responseTimes.length
      : 0

    // Median response time
    const sortedTimes = responseTimes.map(rt => rt.seconds).sort((a, b) => a - b)
    const medianResponseTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0

    // Response time distribution
    const responseTimeDistribution = {
      under5min: responseTimes.filter(rt => rt.seconds < 300).length,
      under15min: responseTimes.filter(rt => rt.seconds >= 300 && rt.seconds < 900).length,
      under1h: responseTimes.filter(rt => rt.seconds >= 900 && rt.seconds < 3600).length,
      under4h: responseTimes.filter(rt => rt.seconds >= 3600 && rt.seconds < 14400).length,
      over4h: responseTimes.filter(rt => rt.seconds >= 14400).length,
    }

    const totalResponses = responseTimes.length
    const under5minPercent = totalResponses > 0
      ? Math.round((responseTimeDistribution.under5min / totalResponses) * 100)
      : 0

    // Messages by direction
    const inboundCount = msgs.filter(m => m.direction === 'inbound').length
    const outboundCount = msgs.filter(m => m.direction === 'outbound').length

    // WhatsApp conversations with activity in range
    const activeConvIds = new Set(msgs.map(m => m.conversation_id))
    const activeWaConversations = activeConvIds.size

    // Unread conversations
    const unreadConversations = waConvs?.filter(c => (c.unread_count || 0) > 0).length || 0

    // Messages by agent
    const agentStats: Record<string, { sent: number; responseTimes: number[] }> = {}
    msgs.filter(m => m.direction === 'outbound' && m.sent_by).forEach(m => {
      if (!agentStats[m.sent_by!]) agentStats[m.sent_by!] = { sent: 0, responseTimes: [] }
      agentStats[m.sent_by!].sent++
    })
    responseTimes.forEach(rt => {
      if (rt.agentId && agentStats[rt.agentId]) {
        agentStats[rt.agentId].responseTimes.push(rt.seconds)
      }
    })

    const agentPerformance = Object.entries(agentStats).map(([agentId, stats]) => {
      const avgRT = stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((s, t) => s + t, 0) / stats.responseTimes.length
        : 0
      const minRT = stats.responseTimes.length > 0 ? Math.min(...stats.responseTimes) : 0
      const maxRT = stats.responseTimes.length > 0 ? Math.max(...stats.responseTimes) : 0
      return {
        agentId,
        name: agentProfiles[agentId] || 'Inconnu',
        messagesSent: stats.sent,
        avgResponseTime: Math.round(avgRT),
        minResponseTime: Math.round(minRT),
        maxResponseTime: Math.round(maxRT),
      }
    }).sort((a, b) => a.avgResponseTime - b.avgResponseTime)

    // Activity by hour (0-23)
    const activityByHour: { hour: string; inbound: number; outbound: number }[] = []
    for (let h = 8; h <= 22; h++) {
      const hourStr = `${h}h`
      const hourMsgs = msgs.filter(m => new Date(m.created_at).getHours() === h)
      activityByHour.push({
        hour: hourStr,
        inbound: hourMsgs.filter(m => m.direction === 'inbound').length,
        outbound: hourMsgs.filter(m => m.direction === 'outbound').length,
      })
    }

    // Activity by day of week
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const activityByDay = dayNames.map((day, index) => ({
      day,
      count: msgs.filter(m => new Date(m.created_at).getDay() === index).length,
    }))

    // --- MESSENGER STATS ---
    const messengerStats = {
      totalConversations: msgConvs?.length || 0,
      byStatus: {
        active: msgConvs?.filter(c => c.status === 'active').length || 0,
        completed: msgConvs?.filter(c => c.status === 'completed').length || 0,
        abandoned: msgConvs?.filter(c => c.status === 'abandoned').length || 0,
      },
      totalMessages: msgMessages.length,
      userMessages: msgMessages.filter(m => m.role === 'user').length,
      assistantMessages: msgMessages.filter(m => m.role === 'assistant').length,
    }

    // Total conversations (WA + Messenger)
    const totalConversations = activeWaConversations + (messengerStats.totalConversations || 0)
    // Total messages (WA + Messenger)
    const totalMessages = msgs.length + msgMessages.length

    return NextResponse.json({
      success: true,
      data: {
        // KPIs
        avgResponseTime: Math.round(avgResponseTime),
        medianResponseTime: Math.round(medianResponseTime),
        totalConversations,
        totalMessages,
        under5minPercent,
        unreadConversations,
        // WhatsApp
        whatsapp: {
          inboundCount,
          outboundCount,
          activeConversations: activeWaConversations,
          totalConversations: waConvs?.length || 0,
        },
        // Messenger
        messenger: messengerStats,
        // Distribution
        responseTimeDistribution,
        totalResponses,
        // By time
        activityByHour,
        activityByDay,
        // Agents
        agentPerformance,
      }
    })
  } catch (error) {
    console.error('Error fetching chat statistics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chat statistics' },
      { status: 500 }
    )
  }
}

function getEmptyStats() {
  return {
    avgResponseTime: 0,
    medianResponseTime: 0,
    totalConversations: 0,
    totalMessages: 0,
    under5minPercent: 0,
    unreadConversations: 0,
    whatsapp: { inboundCount: 0, outboundCount: 0, activeConversations: 0, totalConversations: 0 },
    messenger: { totalConversations: 0, byStatus: { active: 0, completed: 0, abandoned: 0 }, totalMessages: 0, userMessages: 0, assistantMessages: 0 },
    responseTimeDistribution: { under5min: 0, under15min: 0, under1h: 0, under4h: 0, over4h: 0 },
    totalResponses: 0,
    activityByHour: Array.from({ length: 15 }, (_, i) => ({ hour: `${i + 8}h`, inbound: 0, outbound: 0 })),
    activityByDay: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => ({ day, count: 0 })),
    agentPerformance: [],
  }
}
