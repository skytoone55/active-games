/**
 * Messenger Conversations API (Site chat)
 * GET - List messenger conversations with last message preview
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const status = searchParams.get('status') // 'active', 'completed', 'abandoned' or null for all
    const branchId = searchParams.get('branchId')
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

    if (branchId === 'unassigned') {
      query = query.is('branch_id', null)
    } else if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId)
    }

    if (search) {
      // Search in collected_data (JSON) or session_id
      query = query.or(`session_id.ilike.%${search}%`)
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
