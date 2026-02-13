/**
 * Chat Send API
 * POST - Send a WhatsApp message from admin (text or media)
 *
 * Text:  JSON body { conversationId, message, userId }
 * Media: FormData { conversationId, userId, file, caption? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { uploadAndSendMedia, getWhatsAppMediaType } from '@/lib/whatsapp/media'
import { getClaraCodexSettings } from '@/lib/clara-codex'

export async function POST(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('chat', 'create')
    if (!success) return errorResponse!

    const contentType = request.headers.get('content-type') || ''
    const isFormData = contentType.includes('multipart/form-data')

    let conversationId: string
    let userId: string | null
    let messageText: string
    let file: File | null = null
    let caption: string | undefined

    if (isFormData) {
      // Media upload
      const formData = await request.formData()
      conversationId = formData.get('conversationId') as string
      userId = (formData.get('userId') as string) || null
      caption = (formData.get('caption') as string) || undefined
      messageText = caption || ''
      file = formData.get('file') as File | null

      if (!conversationId || !file) {
        return NextResponse.json({ error: 'conversationId and file required' }, { status: 400 })
      }
    } else {
      // Text message
      const body = await request.json()
      conversationId = body.conversationId
      userId = body.userId || null
      messageText = body.message || ''

      if (!conversationId || !messageText) {
        return NextResponse.json({ error: 'conversationId and message required' }, { status: 400 })
      }
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

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 })
    }

    let waMessageId: string | null = null
    let mediaUrl: string | null = null
    let mediaType: string | null = null
    let mediaMimeType: string | null = null
    let mediaFilename: string | null = null
    let msgType = 'text'

    if (file) {
      // ---- Media send ----
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const mimeType = file.type || 'application/octet-stream'
      const filename = file.name || 'file'

      console.log('[CHAT SEND] Media send:', { mimeType, filename, phone: conversation.phone, fileSize: fileBuffer.length })

      const result = await uploadAndSendMedia(
        fileBuffer, mimeType, filename, conversation.phone, caption
      )

      if (!result) {
        console.error('[CHAT SEND] uploadAndSendMedia returned null for', { mimeType, filename })
        return NextResponse.json({ error: 'Failed to send media — check server logs' }, { status: 500 })
      }

      waMessageId = result.waMessageId
      mediaUrl = result.stored.publicUrl
      mediaType = getWhatsAppMediaType(mimeType)
      mediaMimeType = mimeType
      mediaFilename = filename
      msgType = mediaType
      if (!messageText) messageText = `[${mediaType}]`
    } else {
      // ---- Text send ----
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
            text: { body: messageText },
          }),
        }
      )

      const waResult = await waResponse.json()

      if (!waResponse.ok) {
        console.error('[CHAT SEND] WhatsApp API error:', waResult)
        return NextResponse.json({ error: 'Failed to send message', details: waResult }, { status: 500 })
      }

      waMessageId = waResult.messages?.[0]?.id || null
    }

    // Store outbound message in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storedMessage, error: msgError } = await (supabase as any)
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        message_type: msgType,
        content: messageText,
        whatsapp_message_id: waMessageId,
        status: 'sent',
        sent_by: userId || null,
        media_url: mediaUrl,
        media_type: mediaType,
        media_mime_type: mediaMimeType,
        media_filename: mediaFilename,
      })
      .select()
      .single()

    if (msgError) {
      console.error('[CHAT SEND] DB error:', msgError)
    }

    // Update conversation last_message_at + auto-pause Clara (human takeover)
    let autoResumeMinutes = 5
    try {
      const codex = await getClaraCodexSettings()
      const codexEnabled = codex.is_active && codex.settings.enabled
      if (codexEnabled && codex.settings.auto_resume_minutes > 0) {
        autoResumeMinutes = codex.settings.auto_resume_minutes
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: msSettings } = await (supabase as any)
          .from('messenger_settings')
          .select('settings')
          .single()
        const legacyTimeout = msSettings?.settings?.whatsapp_clara?.auto_resume_minutes
        if (legacyTimeout && legacyTimeout > 0) autoResumeMinutes = legacyTimeout
      }
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
        clara_auto_activate_at: null,
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
