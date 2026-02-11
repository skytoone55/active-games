/**
 * WhatsApp Business API Webhook Handler v3.0
 *
 * GET  - Webhook verification (Meta sends a challenge to verify the endpoint)
 * POST - Receive incoming messages and status updates from WhatsApp
 *        Stores conversations and messages in Supabase
 *        Auto-links contacts by phone number
 *        Interactive onboarding flow (activity + branch selection)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Normalize phone: 972XXXXXXXXX -> 0XXXXXXXXX (Israeli format)
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  if (cleaned.startsWith('972')) return '0' + cleaned.substring(3)
  if (cleaned.startsWith('05')) return cleaned
  return cleaned
}

// ============================================================
// WhatsApp API Helpers
// ============================================================

async function sendTextMessage(to: string, text: string): Promise<string | null> {
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

async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || buttons.length === 0) return null

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
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title.substring(0, 20) }
            }))
          }
        }
      }),
    }
  )
  const result = await res.json()
  return result.messages?.[0]?.id || null
}

// Store an outbound message in DB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeOutboundMessage(supabase: any, conversationId: string, content: string, msgType: string, waMessageId: string | null) {
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

// Get multilingual text by language key
function getLocalizedText(multilingual: Record<string, string> | string | undefined, language: string): string {
  if (!multilingual) return ''
  if (typeof multilingual === 'string') return multilingual
  return multilingual[language] || multilingual.he || multilingual.fr || multilingual.en || ''
}

// ============================================================
// GET - Webhook Verification
// ============================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WHATSAPP WEBHOOK] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ============================================================
// POST - Receive messages and status updates
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ received: true })
    }

    const supabase = createServiceRoleClient()

    // ---- Status updates (sent, delivered, read) ----
    if (value.statuses) {
      for (const status of value.statuses) {
        if (status.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_messages')
            .update({ status: status.status })
            .eq('whatsapp_message_id', status.id)
        }
      }
      return NextResponse.json({ received: true })
    }

    // ---- Load onboarding config once ----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msSettings } = await (supabase as any)
      .from('messenger_settings')
      .select('settings')
      .single()

    const onboardingConfig = msSettings?.settings?.whatsapp_onboarding
    const isOnboardingEnabled = onboardingConfig?.enabled === true
    const onboardingLang = onboardingConfig?.language || 'he'

    // Legacy auto-reply fallback
    const legacyAutoReply = msSettings?.settings?.whatsapp_auto_reply

    // ---- Incoming messages ----
    if (value.messages) {
      for (const message of value.messages) {
        const senderPhone = message.from
        const messageId = message.id
        const messageType = message.type

        let messageText = ''
        let buttonReplyId: string | null = null

        switch (messageType) {
          case 'text':
            messageText = message.text?.body || ''
            break
          case 'interactive':
            messageText = message.interactive?.button_reply?.title
              || message.interactive?.list_reply?.title || ''
            buttonReplyId = message.interactive?.button_reply?.id
              || message.interactive?.list_reply?.id || null
            break
          case 'button':
            messageText = message.button?.text || ''
            break
          default:
            messageText = `[${messageType}]`
        }

        const contactName = value.contacts?.[0]?.profile?.name || ''
        const normalizedPhone = normalizePhone(senderPhone)

        console.log('[WHATSAPP] Message from', senderPhone, ':', messageText)

        // 1. Find or create conversation
        let isNewConversation = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let { data: conversation } = await (supabase as any)
          .from('whatsapp_conversations')
          .select('id, contact_id, onboarding_status, activity, branch_id')
          .eq('phone', senderPhone)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!conversation) {
          // Auto-link contact by phone
          let contactId: string | null = null
          let branchId: string | null = null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: contacts } = await (supabase as any)
            .from('contacts')
            .select('id, branch_id_main')
            .or(`phone.eq.${normalizedPhone},phone.eq.${senderPhone}`)

          if (contacts && contacts.length === 1) {
            contactId = contacts[0].id
            branchId = contacts[0].branch_id_main
          } else if (contacts && contacts.length > 1) {
            console.log(`[WHATSAPP] Multiple contacts found for ${senderPhone} (${contacts.length}), skipping auto-link`)
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newConv } = await (supabase as any)
            .from('whatsapp_conversations')
            .insert({
              phone: senderPhone,
              contact_name: contactName || null,
              contact_id: contactId,
              branch_id: branchId,
              status: 'active',
              unread_count: 1,
              last_message_at: new Date().toISOString(),
              onboarding_status: isOnboardingEnabled ? 'waiting_activity' : null,
            })
            .select('id, contact_id, onboarding_status, activity, branch_id')
            .single()

          conversation = newConv
          isNewConversation = true
        } else {
          // Update existing conversation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_conversations')
            .update({
              last_message_at: new Date().toISOString(),
              unread_count: (conversation.unread_count || 0) + 1,
              contact_name: contactName || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
        }

        if (!conversation) {
          console.error('[WHATSAPP] Failed to create/find conversation')
          continue
        }

        // 2. Store the inbound message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation.id,
            direction: 'inbound',
            message_type: messageType,
            content: messageText,
            whatsapp_message_id: messageId,
            status: 'delivered',
          })

        // 3. Onboarding flow / auto-reply
        try {
          if (isOnboardingEnabled && onboardingConfig.activities?.length > 0) {
            await handleOnboarding(
              supabase, conversation, senderPhone, isNewConversation,
              messageText, buttonReplyId, onboardingConfig, onboardingLang
            )
          } else if (isNewConversation && legacyAutoReply?.enabled && legacyAutoReply?.message) {
            // Legacy auto-reply fallback (plain text)
            let replyText = ''
            if (typeof legacyAutoReply.message === 'string') {
              replyText = legacyAutoReply.message
            } else {
              replyText = legacyAutoReply.message.fr || legacyAutoReply.message.he || legacyAutoReply.message.en || ''
            }
            if (replyText.trim()) {
              const waId = await sendTextMessage(senderPhone, replyText)
              await storeOutboundMessage(supabase, conversation.id, replyText, 'text', waId)
              console.log('[WHATSAPP] Legacy auto-reply sent to', senderPhone)
            }
          }
        } catch (onboardingError) {
          console.error('[WHATSAPP] Onboarding/auto-reply error:', onboardingError)
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[WHATSAPP WEBHOOK] Error:', error)
    return NextResponse.json({ received: true, error: 'Internal error' })
  }
}

// ============================================================
// Onboarding State Machine
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleOnboarding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversation: any,
  senderPhone: string,
  isNewConversation: boolean,
  messageText: string,
  buttonReplyId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  language: string
) {
  const status = conversation.onboarding_status

  // --- NEW CONVERSATION: send activity buttons ---
  if (isNewConversation && status === 'waiting_activity') {
    const promptText = getLocalizedText(config.activity_prompt, language)
    const buttons = config.activities.map((a: { id: string; label: Record<string, string>; emoji?: string }) => ({
      id: a.id,
      title: `${a.emoji || ''} ${getLocalizedText(a.label, language)}`.trim()
    }))

    if (promptText && buttons.length > 0) {
      const waId = await sendInteractiveButtons(senderPhone, promptText, buttons)
      await storeOutboundMessage(supabase, conversation.id, promptText, 'interactive', waId)
      console.log('[WHATSAPP] Onboarding: activity buttons sent to', senderPhone)
    }
    return
  }

  // --- WAITING FOR ACTIVITY SELECTION ---
  if (status === 'waiting_activity') {
    const activities = config.activities || []
    const matched = activities.find((a: { id: string; label: Record<string, string> }) => {
      if (buttonReplyId && buttonReplyId === a.id) return true
      // Fallback: match by label text in any language
      const labels = Object.values(a.label || {}) as string[]
      return labels.some(l => l && messageText.toLowerCase().includes(l.toLowerCase()))
    })

    if (matched) {
      // Save activity, advance to branch selection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('whatsapp_conversations')
        .update({ activity: matched.id, onboarding_status: 'waiting_branch' })
        .eq('id', conversation.id)

      // Send branch buttons
      const branchPrompt = getLocalizedText(config.branch_prompt, language)
      const branchButtons = (config.branches || []).map((b: { branch_id: string; label: Record<string, string>; emoji?: string }) => ({
        id: b.branch_id,
        title: `${b.emoji || ''} ${getLocalizedText(b.label, language)}`.trim()
      }))

      if (branchPrompt && branchButtons.length > 0) {
        const waId = await sendInteractiveButtons(senderPhone, branchPrompt, branchButtons)
        await storeOutboundMessage(supabase, conversation.id, branchPrompt, 'interactive', waId)
        console.log('[WHATSAPP] Onboarding: branch buttons sent to', senderPhone)
      }
    } else {
      // No match: resend activity buttons
      const promptText = getLocalizedText(config.activity_prompt, language)
      const buttons = activities.map((a: { id: string; label: Record<string, string>; emoji?: string }) => ({
        id: a.id,
        title: `${a.emoji || ''} ${getLocalizedText(a.label, language)}`.trim()
      }))
      if (promptText && buttons.length > 0) {
        const waId = await sendInteractiveButtons(senderPhone, promptText, buttons)
        await storeOutboundMessage(supabase, conversation.id, promptText, 'interactive', waId)
        console.log('[WHATSAPP] Onboarding: resent activity buttons to', senderPhone)
      }
    }
    return
  }

  // --- WAITING FOR BRANCH SELECTION ---
  if (status === 'waiting_branch') {
    const branches = config.branches || []
    const matched = branches.find((b: { branch_id: string; label: Record<string, string> }) => {
      if (buttonReplyId && buttonReplyId === b.branch_id) return true
      const labels = Object.values(b.label || {}) as string[]
      return labels.some(l => l && messageText.toLowerCase().includes(l.toLowerCase()))
    })

    if (matched) {
      // Save branch, mark onboarding complete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('whatsapp_conversations')
        .update({ branch_id: matched.branch_id, onboarding_status: 'completed' })
        .eq('id', conversation.id)

      console.log('[WHATSAPP] Onboarding completed for', senderPhone, '- activity:', conversation.activity, 'branch:', matched.branch_id)

      // Send welcome message if enabled
      if (config.welcome_message_enabled && config.welcome_message) {
        const welcomeText = getLocalizedText(config.welcome_message, language)
        if (welcomeText.trim()) {
          const waId = await sendTextMessage(senderPhone, welcomeText)
          await storeOutboundMessage(supabase, conversation.id, welcomeText, 'text', waId)
          console.log('[WHATSAPP] Welcome message sent to', senderPhone)
        }
      }
    } else {
      // No match: resend branch buttons
      const branchPrompt = getLocalizedText(config.branch_prompt, language)
      const branchButtons = branches.map((b: { branch_id: string; label: Record<string, string>; emoji?: string }) => ({
        id: b.branch_id,
        title: `${b.emoji || ''} ${getLocalizedText(b.label, language)}`.trim()
      }))
      if (branchPrompt && branchButtons.length > 0) {
        const waId = await sendInteractiveButtons(senderPhone, branchPrompt, branchButtons)
        await storeOutboundMessage(supabase, conversation.id, branchPrompt, 'interactive', waId)
        console.log('[WHATSAPP] Onboarding: resent branch buttons to', senderPhone)
      }
    }
    return
  }

  // --- COMPLETED or NULL: normal behavior, no onboarding action ---
}
