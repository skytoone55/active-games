/**
 * API pour les statistiques funnel Clara WhatsApp
 * Permission requise : chat_stats.view
 *
 * Funnel: conversation_started → simulate_booking_called → generate_link_called → escalated_to_human
 * Breakdown par branche disponible
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

interface ClaraEvent {
  id: string
  conversation_id: string
  branch_id: string | null
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

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

  try {
    const supabase = createServiceRoleClient()

    // Fetch all Clara events in range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase
      .from('clara_whatsapp_events')
      .select('*')
      .gte('created_at', startISO)
      .lte('created_at', endISO)

    if (branchFilter && branchFilter !== 'all') {
      query = query.eq('branch_id', branchFilter)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('[CLARA STATS] Error fetching events:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch Clara stats' }, { status: 500 })
    }

    const allEvents = (events || []) as ClaraEvent[]

    // Count unique conversations per event type
    const conversationsByType: Record<string, Set<string>> = {
      conversation_started: new Set(),
      simulate_booking_called: new Set(),
      simulate_booking_success: new Set(),
      simulate_booking_error: new Set(),
      generate_link_called: new Set(),
      generate_link_success: new Set(),
      escalated_to_human: new Set(),
      tool_error: new Set(),
    }

    // Count per branch
    const branchStats: Record<string, Record<string, Set<string>>> = {}

    // Escalade reasons
    const escaladeReasons: Record<string, number> = {}

    for (const event of allEvents) {
      const type = event.event_type
      const convId = event.conversation_id
      const branchId = event.branch_id || 'unassigned'

      if (conversationsByType[type]) {
        conversationsByType[type].add(convId)
      }

      // Branch breakdown
      if (!branchStats[branchId]) {
        branchStats[branchId] = {
          conversation_started: new Set(),
          simulate_booking_called: new Set(),
          simulate_booking_success: new Set(),
          generate_link_called: new Set(),
          generate_link_success: new Set(),
          escalated_to_human: new Set(),
        }
      }
      if (branchStats[branchId][type]) {
        branchStats[branchId][type].add(convId)
      }

      // Escalade reasons
      if (type === 'escalated_to_human') {
        const meta = event.metadata as { reason?: string } | null
        const reason = meta?.reason || 'unknown'
        escaladeReasons[reason] = (escaladeReasons[reason] || 0) + 1
      }
    }

    // Funnel data (unique conversations)
    const funnel = {
      conversations: conversationsByType.conversation_started.size,
      simulateCalled: conversationsByType.simulate_booking_called.size,
      simulateSuccess: conversationsByType.simulate_booking_success.size,
      simulateError: conversationsByType.simulate_booking_error.size,
      linkGenerated: conversationsByType.generate_link_called.size,
      linkSuccess: conversationsByType.generate_link_success.size,
      escalated: conversationsByType.escalated_to_human.size,
    }

    // Conversion rates
    const rates = {
      simulateRate: funnel.conversations > 0
        ? Math.round((funnel.simulateCalled / funnel.conversations) * 100) : 0,
      simulateSuccessRate: funnel.simulateCalled > 0
        ? Math.round((funnel.simulateSuccess / funnel.simulateCalled) * 100) : 0,
      linkRate: funnel.simulateSuccess > 0
        ? Math.round((funnel.linkGenerated / funnel.simulateSuccess) * 100) : 0,
      escalateRate: funnel.conversations > 0
        ? Math.round((funnel.escalated / funnel.conversations) * 100) : 0,
    }

    // Branch breakdown (serialize Sets to counts)
    const branchBreakdown = Object.entries(branchStats).map(([branchId, stats]) => ({
      branchId,
      conversations: stats.conversation_started.size,
      simulateCalled: stats.simulate_booking_called.size,
      simulateSuccess: stats.simulate_booking_success.size,
      linkGenerated: stats.generate_link_called.size,
      linkSuccess: stats.generate_link_success.size,
      escalated: stats.escalated_to_human.size,
    }))

    // Daily trend (group events by day)
    const dailyMap: Record<string, { conversations: Set<string>; simulations: number; links: number; escalations: number }> = {}
    for (const event of allEvents) {
      const day = event.created_at.slice(0, 10)
      if (!dailyMap[day]) {
        dailyMap[day] = { conversations: new Set(), simulations: 0, links: 0, escalations: 0 }
      }
      if (event.event_type === 'conversation_started') {
        dailyMap[day].conversations.add(event.conversation_id)
      } else if (event.event_type === 'simulate_booking_called') {
        dailyMap[day].simulations++
      } else if (event.event_type === 'generate_link_called') {
        dailyMap[day].links++
      } else if (event.event_type === 'escalated_to_human') {
        dailyMap[day].escalations++
      }
    }

    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        conversations: data.conversations.size,
        simulations: data.simulations,
        links: data.links,
        escalations: data.escalations,
      }))

    return NextResponse.json({
      success: true,
      data: {
        funnel,
        rates,
        branchBreakdown,
        dailyTrend,
        escaladeReasons,
        totalEvents: allEvents.length,
      }
    })
  } catch (error) {
    console.error('[CLARA STATS] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch Clara stats' }, { status: 500 })
  }
}
