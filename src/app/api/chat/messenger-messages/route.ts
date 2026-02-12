/**
 * Messenger Messages API (Site chat)
 * GET - List messages for a messenger conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('chat', 'view')
    if (!success) return errorResponse!

    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[MESSENGER API] Error fetching messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      messages: data || [],
    })
  } catch (error) {
    console.error('[MESSENGER API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
