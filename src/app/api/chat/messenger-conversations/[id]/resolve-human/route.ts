/**
 * Resolve Human Escalation API for Messenger conversations
 * POST - Clear the needs_human flag
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('messenger_conversations')
      .update({
        needs_human: false,
        needs_human_reason: null,
      })
      .eq('id', conversationId)
      .select('id, needs_human, needs_human_reason')
      .single()

    if (error) {
      console.error('[MS RESOLVE HUMAN] Error:', error)
      return NextResponse.json({ error: 'Failed to resolve' }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: data })
  } catch (error) {
    console.error('[MS RESOLVE HUMAN] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
