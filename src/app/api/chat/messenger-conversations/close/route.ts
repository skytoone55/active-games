/**
 * Close/Archive a messenger conversation
 * POST /api/chat/messenger-conversations/close
 * Body: { conversationId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const body = await request.json()
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('messenger_conversations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single()

    if (error) {
      console.error('[MESSENGER API] Error closing conversation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: data })
  } catch (error) {
    console.error('[MESSENGER API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
