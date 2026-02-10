/**
 * WhatsApp Business API Webhook Handler v1.0
 *
 * GET  - Webhook verification (Meta sends a challenge to verify the endpoint)
 * POST - Receive incoming messages and status updates from WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// GET - Webhook Verification
// Meta sends this when you configure the webhook URL
// ============================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('[WHATSAPP WEBHOOK] Verification request:', { mode, token: token ? '***' : 'missing' })

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WHATSAPP WEBHOOK] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('[WHATSAPP WEBHOOK] Verification failed - invalid token')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ============================================================
// POST - Receive messages and status updates
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[WHATSAPP WEBHOOK] Received event:', JSON.stringify(body, null, 2))

    // WhatsApp webhook payload structure
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      console.log('[WHATSAPP WEBHOOK] No value in payload, acknowledging')
      return NextResponse.json({ received: true })
    }

    // ---- Status updates (sent, delivered, read) ----
    if (value.statuses) {
      for (const status of value.statuses) {
        console.log('[WHATSAPP WEBHOOK] Status update:', {
          messageId: status.id,
          status: status.status,
          recipientPhone: status.recipient_id,
          timestamp: status.timestamp,
        })
      }
      return NextResponse.json({ received: true })
    }

    // ---- Incoming messages ----
    if (value.messages) {
      for (const message of value.messages) {
        const senderPhone = message.from // format: 972XXXXXXXXX
        const messageId = message.id
        const timestamp = message.timestamp
        const messageType = message.type // text, image, document, interactive, button, etc.

        let messageText = ''

        switch (messageType) {
          case 'text':
            messageText = message.text?.body || ''
            break
          case 'interactive':
            // Button reply or list reply
            messageText = message.interactive?.button_reply?.title
              || message.interactive?.list_reply?.title
              || ''
            break
          case 'button':
            messageText = message.button?.text || ''
            break
          default:
            messageText = `[${messageType}]`
        }

        // Contact info from WhatsApp
        const contactName = value.contacts?.[0]?.profile?.name || ''

        console.log('[WHATSAPP WEBHOOK] Incoming message:', {
          from: senderPhone,
          name: contactName,
          type: messageType,
          text: messageText,
          messageId,
          timestamp,
        })

        // TODO Phase 2: Route to messenger engine
        // await processWhatsAppMessage({ senderPhone, contactName, messageText, messageId, messageType })

        // For now: send a simple echo response to confirm API works
        await sendWhatsAppMessage(
          senderPhone,
          `[Test] Message recu: "${messageText}"`
        )
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[WHATSAPP WEBHOOK] Error:', error)
    // Always return 200 to prevent Meta from retrying
    return NextResponse.json({ received: true, error: 'Internal error' })
  }
}

// ============================================================
// Send a simple text message via WhatsApp Business API
// ============================================================
async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      console.error('[WHATSAPP] Missing env variables')
      return false
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[WHATSAPP] Send failed:', result)
      return false
    }

    console.log('[WHATSAPP] Message sent to', to, '- ID:', result.messages?.[0]?.id)
    return true

  } catch (error) {
    console.error('[WHATSAPP] Send error:', error)
    return false
  }
}
