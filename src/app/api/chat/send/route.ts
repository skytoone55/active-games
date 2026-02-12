/**
 * Chat Send API
 * POST - Send a WhatsApp message from admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    const { conversationId, message, userId } = await request.json()

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'conversationId and message required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get conversation to find the phone number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversation, error: convError } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('id, phone')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Send via WhatsApp API
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 })
    }

    const waResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: conversation.phone,
          type: 'text',
          text: { body: message },
        }),
      }
    )

    const waResult = await waResponse.json()

    if (!waResponse.ok) {
      console.error('[CHAT SEND] WhatsApp API error:', waResult)
      return NextResponse.json({ error: 'Failed to send message', details: waResult }, { status: 500 })
    }

    const waMessageId = waResult.messages?.[0]?.id || null

    // Store outbound message in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storedMessage, error: msgError } = await (supabase as any)
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        message_type: 'text',
        content: message,
        whatsapp_message_id: waMessageId,
        status: 'sent',
        sent_by: userId || null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('[CHAT SEND] DB error:', msgError)
    }

    // Update conversation last_message_at + auto-pause Clara (human takeover)
    // Get Clara auto-resume timeout from settings
    let autoResumeMinutes = 5 // default 5 minutes
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: msSettings } = await (supabase as any)
        .from('messenger_settings')
        .select('settings')
        .single()
      const claraTimeout = msSettings?.settings?.whatsapp_clara?.auto_resume_minutes
      if (claraTimeout && claraTimeout > 0) autoResumeMinutes = claraTimeout
    } catch { /* use default */ }

    const pausedUntil = new Date(Date.now() + autoResumeMinutes * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        clara_paused: true,
        clara_paused_until: pausedUntil,
      })
      .eq('id', conversationId)

    return NextResponse.json({
      success: true,
      message: storedMessage,
      whatsappMessageId: waMessageId,
    })

  } catch (error) {
    console.error('[CHAT SEND] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
