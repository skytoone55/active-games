/**
 * Messenger Send API (Admin agent reply)
 * POST - Send a message to a messenger conversation as agent
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    const { conversationId, message } = await request.json()

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'conversationId and message required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('messenger_conversations')
      .select('id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Insert agent message into messenger_messages
    const { data: storedMessage, error: msgError } = await supabase
      .from('messenger_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: message,
        step_ref: null,
        metadata: { sent_by: 'agent' },
      })
      .select()
      .single()

    if (msgError) {
      console.error('[MS SEND] DB error:', msgError)
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 })
    }

    // Update conversation last activity + pause Clara (agent takeover)
    let autoResumeMinutes = 5
    try {
      const { data: msSettings } = await supabase
        .from('messenger_settings')
        .select('settings')
        .single()
      const claraTimeout = msSettings?.settings?.auto_resume_minutes
      if (claraTimeout && claraTimeout > 0) autoResumeMinutes = claraTimeout
    } catch { /* use default */ }

    const pausedUntil = new Date(Date.now() + autoResumeMinutes * 60 * 1000).toISOString()

    await supabase
      .from('messenger_conversations')
      .update({
        last_activity_at: new Date().toISOString(),
        last_message: message,
        last_message_role: 'assistant',
        clara_paused: true,
        clara_paused_until: pausedUntil,
      })
      .eq('id', conversationId)

    return NextResponse.json({
      success: true,
      message: storedMessage,
    })
  } catch (error) {
    console.error('[MS SEND] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
