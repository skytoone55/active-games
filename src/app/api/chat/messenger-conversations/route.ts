/**
 * Messenger Conversations API (Site chat)
 * GET - List messenger conversations with last message preview
 * Only shows conversations that have collected NAME + NUMBER (complete intake)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const status = searchParams.get('status') // 'active', 'completed', 'abandoned' or null for all
    const branchId = searchParams.get('branchId')
    const allowedBranches = searchParams.get('allowedBranches') // comma-separated branch IDs
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const offset = (page - 1) * pageSize
    const countOnly = searchParams.get('countOnly') === 'true'
    const countFilter = searchParams.get('countFilter') // 'unread' or 'needs_human'

    // Helper: apply common filters (status, intake, branch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyCommonFilters = (q: any) => {
      // Status filter
      if (status === 'all') {
        // No status filter
      } else if (status) {
        q = q.eq('status', status)
      } else {
        q = q.eq('status', 'active')
      }

      // Intake filter
      q = q.not('collected_data->WELCOME', 'is', null)
      q = q.not('collected_data->NAME', 'is', null)
      q = q.not('collected_data->NUMBER', 'is', null)

      // Branch filter
      if (branchId === 'unassigned') {
        q = q.is('branch_id', null)
      } else if (branchId === 'all' && allowedBranches) {
        const branchIds = allowedBranches.split(',').filter(Boolean)
        const orParts = branchIds.map((id: string) => `branch_id.eq.${id}`)
        orParts.push('branch_id.is.null')
        q = q.or(orParts.join(','))
      } else if (branchId && branchId !== 'all') {
        q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      return q
    }

    // ─── countOnly mode: return only count (no data), much faster ───
    if (countOnly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let countQuery = (supabase as any)
        .from('messenger_conversations')
        .select('*', { count: 'exact', head: true })

      countQuery = applyCommonFilters(countQuery)

      if (countFilter === 'unread') {
        countQuery = countQuery.gt('unread_count', 0)
      } else if (countFilter === 'needs_human') {
        countQuery = countQuery.eq('needs_human', true)
      }

      const { count, error } = await countQuery
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ count: count || 0 })
    }

    // ─── Normal mode: return full data ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('messenger_conversations')
      .select('*, branch:branch_id(id, name, name_en), contacts:contact_id(id, first_name, last_name, phone, email)', { count: 'exact' })
      .order('last_activity_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    query = applyCommonFilters(query)

    if (search) {
      query = query.or(`session_id.ilike.%${search}%,collected_data->>NAME.ilike.%${search}%,collected_data->>NUMBER.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[MESSENGER API] Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For each conversation, batch-load last messages instead of N+1 queries
    const convIds = (data || []).map((c: Record<string, unknown>) => c.id)

    // Get last message for all conversations in one query using distinct on
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastMessages: Record<string, unknown>[] = []
    if (convIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allMsgs } = await (supabase as any)
        .from('messenger_messages')
        .select('conversation_id, content, role, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })

      lastMessages = allMsgs || []
    }

    // Get message counts for all conversations in one query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let msgCounts: Record<string, number> = {}
    if (convIds.length > 0) {
      // Group counts by conversation_id — use individual counts since Supabase doesn't support GROUP BY
      const countPromises = convIds.map(async (convId: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase as any)
          .from('messenger_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
        return { convId, count: count || 0 }
      })
      const counts = await Promise.all(countPromises)
      counts.forEach(({ convId, count: c }) => { msgCounts[convId] = c })
    }

    // Build a map of last message per conversation
    const lastMsgMap = new Map<string, Record<string, unknown>>()
    for (const msg of lastMessages) {
      const convId = msg.conversation_id as string
      if (!lastMsgMap.has(convId)) {
        lastMsgMap.set(convId, msg) // First one is the latest (ordered by created_at desc)
      }
    }

    const conversationsWithPreview = (data || []).map((conv: Record<string, unknown>) => {
      const lastMsg = lastMsgMap.get(conv.id as string)
      return {
        ...conv,
        last_message: (lastMsg?.content as string) || null,
        last_message_role: (lastMsg?.role as string) || null,
        message_count: msgCounts[conv.id as string] || 0,
      }
    })

    return NextResponse.json({
      conversations: conversationsWithPreview,
      total: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[MESSENGER API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
