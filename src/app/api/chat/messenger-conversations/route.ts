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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('messenger_conversations')
      .select('*, branch:branch_id(id, name, name_en), contacts:contact_id(id, first_name, last_name, phone, email)', { count: 'exact' })
      .order('last_activity_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Filter by status: 'active', 'completed', 'abandoned', 'all', or null (defaults to active)
    if (status === 'all') {
      // No status filter — show everything
    } else if (status) {
      query = query.eq('status', status)
    } else {
      // Default: show active only
      query = query.eq('status', 'active')
    }

    // Only show conversations that have completed intake (NAME + NUMBER collected)
    // collected_data is JSONB — filter where NAME and NUMBER keys exist and are not null
    query = query.not('collected_data->NAME', 'is', null)
    query = query.not('collected_data->NUMBER', 'is', null)

    // Branch filter
    if (branchId === 'unassigned') {
      query = query.is('branch_id', null)
    } else if (branchId === 'all' && allowedBranches) {
      // "All" but scoped to user's allowed branches
      const branchIds = allowedBranches.split(',').filter(Boolean)
      const orParts = branchIds.map(id => `branch_id.eq.${id}`)
      // Site visitors may not have a branch yet — include null
      orParts.push('branch_id.is.null')
      query = query.or(orParts.join(','))
    } else if (branchId && branchId !== 'all') {
      // Specific branch + include unassigned (site visitors often have no branch)
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    if (search) {
      // Search in collected_data name or session_id
      query = query.or(`session_id.ilike.%${search}%,collected_data->>NAME.ilike.%${search}%,collected_data->>NUMBER.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[MESSENGER API] Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For each conversation, get the last message for preview
    const conversationsWithPreview = await Promise.all(
      (data || []).map(async (conv: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lastMsg } = await (supabase as any)
          .from('messenger_messages')
          .select('content, role, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: msgCount } = await (supabase as any)
          .from('messenger_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)

        return {
          ...conv,
          last_message: lastMsg?.content || null,
          last_message_role: lastMsg?.role || null,
          message_count: msgCount || 0,
        }
      })
    )

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
