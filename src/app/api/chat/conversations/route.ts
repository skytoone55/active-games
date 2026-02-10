/**
 * Chat Conversations API
 * GET - List WhatsApp conversations with last message preview
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const status = searchParams.get('status') || 'active'
    const branchId = searchParams.get('branchId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const offset = (page - 1) * pageSize

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('whatsapp_conversations')
      .select('*, contacts:contact_id(id, first_name, last_name, phone, email)', { count: 'exact' })
      .eq('status', status)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    if (search) {
      query = query.or(`phone.ilike.%${search}%,contact_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[CHAT API] Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      conversations: data || [],
      total: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
