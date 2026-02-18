/**
 * WhatsApp Messaging Utilities
 *
 * Shared helpers for sending WhatsApp messages and storing outbound records.
 * Used by the webhook, auto-activate piggyback, and Clara handlers.
 */

/**
 * Send typing indicator ("..." in WhatsApp) + mark message as read.
 * The typing indicator disappears when a response is sent or after ~25s (Meta limit).
 * Call this periodically during long AI processing to keep the indicator visible.
 */
export async function sendTypingIndicator(messageId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || !messageId) return

  try {
    await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
          typing_indicator: { type: 'text' },
        }),
      }
    )
  } catch (err) {
    // Non-blocking — don't fail if typing indicator fails
    console.error('[WHATSAPP] Typing indicator error:', err)
  }
}

/**
 * Create a typing indicator loop that refreshes every intervalMs.
 * Returns a stop() function to cancel the loop.
 * WhatsApp typing indicators expire after ~25s, so refresh at ~20s.
 */
export function createTypingIndicatorLoop(messageId: string, intervalMs = 20_000): { stop: () => void } {
  if (!messageId) return { stop: () => {} }

  const timer = setInterval(() => {
    sendTypingIndicator(messageId).catch(() => {})
  }, intervalMs)

  return {
    stop: () => clearInterval(timer),
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || !text.trim()) return null

  const res = await fetch(
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
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  )
  const result = await res.json()
  return result.messages?.[0]?.id || null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function storeOutboundMessage(supabase: any, conversationId: string, content: string, msgType: string, waMessageId: string | null) {
  await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      direction: 'outbound',
      message_type: msgType,
      content,
      whatsapp_message_id: waMessageId,
      status: 'sent',
      sent_by: null, // null = automated message
    })
}

/**
 * Technical fallback: sends a localized error message + human availability info,
 * marks the conversation as needs_human + clara_paused, and tracks the event.
 */
export async function triggerCodexTechnicalFallback(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  conversation: { id: string; branch_id: string | null; contact_name?: string | null }
  senderPhone: string
  locale: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any
  metadata?: Record<string, unknown>
}) {
  const { resolveLocalizedCodexText } = await import('@/lib/clara-codex/config')
  const { getAvailableHumanStatus, trackCodexEvent } = await import('@/lib/clara-codex/tracking')
  const { createServiceRoleClient } = await import('@/lib/supabase/service-role')

  const { supabase, conversation, senderPhone, locale, settings } = params
  const normalizedLocale = normalizeLocale(locale)

  const technicalMessage = resolveLocalizedCodexText(settings.fallback_tech_error_message, normalizedLocale)
  const availability = await getAvailableHumanStatus(conversation.branch_id)

  let tail: string
  if (availability.available) {
    tail = resolveLocalizedCodexText(settings.fallback_human_message, normalizedLocale)
  } else {
    const base = resolveLocalizedCodexText(settings.fallback_no_agent_message, normalizedLocale)
    // Try to append branch phone
    let phone: string | null = null
    if (conversation.branch_id) {
      const supa = createServiceRoleClient()
      const { data } = await (supa as any).from('branches').select('phone').eq('id', conversation.branch_id).single()
      phone = data?.phone || null
    }
    tail = phone ? `${base}\nPhone: ${phone}` : base
  }

  const fullMessage = `${technicalMessage}\n\n${tail}`

  await supabase.from('whatsapp_conversations')
    .update({
      needs_human: true,
      needs_human_reason: 'Clara Codex technical fallback',
      clara_paused: true,
      clara_paused_until: new Date(Date.now() + settings.auto_resume_minutes * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  const waId = await sendWhatsAppText(senderPhone, fullMessage)
  await storeOutboundMessage(supabase, conversation.id, fullMessage, 'text', waId)

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'technical_fallback', {
    humanAvailable: availability.available,
    connectedCount: availability.connectedCount,
    ...params.metadata,
  })
}

function normalizeLocale(input: string | null | undefined): string {
  const locale = (input || '').toLowerCase().trim()
  if (!locale) return 'en'
  if (locale.startsWith('fr')) return 'fr'
  if (locale.startsWith('he')) return 'he'
  return 'en'
}
