/**
 * Shared WhatsApp Clara Handler
 *
 * Extracted from the webhook route so the cron job (clara-auto-activate)
 * can also trigger a Clara response without duplicating the logic.
 */

import {
  getClaraSettings,
  getOrCreatePublicConversation,
  getPublicMessages,
  addPublicMessage,
  getPublicSystemPrompt,
} from '@/lib/clara/service'
import { streamLLMResponse, convertToAIMessages, truncateHistory } from '@/lib/clara/llm-provider'
import { createWhatsAppTools } from '@/lib/clara/tools'

// ============================================================
// WhatsApp API Helpers
// ============================================================

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

// ============================================================
// DB Helpers
// ============================================================

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

export async function trackClaraEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  branchId: string | null,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from('clara_whatsapp_events').insert({
      conversation_id: conversationId,
      branch_id: branchId,
      event_type: eventType,
      metadata,
    })
  } catch (err) {
    console.error('[CLARA TRACKING] Error tracking event:', eventType, err)
  }
}

// ============================================================
// Clara WhatsApp Response Handler
// ============================================================

export async function handleClaraWhatsAppResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversation: { id: string; branch_id: string | null; contact_name?: string },
  senderPhone: string,
  messageText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claraConfig: any,
  language: string
): Promise<{ sent: boolean; usedFallback?: boolean }> {
  console.log('[WHATSAPP CLARA] Processing message from', senderPhone, ':', messageText.substring(0, 100))

  // Get Clara settings (global)
  const globalSettings = await getClaraSettings()
  if (!globalSettings.enabled) {
    console.log('[WHATSAPP CLARA] Clara globally disabled, skipping')
    return { sent: false }
  }

  // Track conversation started (only once per conversation — use upsert-like check)
  await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'conversation_started', {
    phone: senderPhone,
    language,
  })

  // Use WhatsApp-specific model/temperature if set, otherwise global
  const model = claraConfig.model || globalSettings.model
  const temperature = claraConfig.temperature ?? globalSettings.temperature
  const provider = model.startsWith('gpt') ? 'openai' : model.startsWith('claude') ? 'anthropic' : 'gemini'

  // Get or create Clara conversation for this WhatsApp thread
  // Use whatsapp conversation ID as session to keep context
  const claraConv = await getOrCreatePublicConversation(
    `whatsapp:${conversation.id}`,
    conversation.branch_id || undefined,
    { locale: language }
  )

  // Save user message to Clara conversation
  await addPublicMessage(claraConv.id, 'user', messageText)

  // Get conversation history
  const messages = await getPublicMessages(claraConv.id, 150)
  const aiMessages = convertToAIMessages(messages)
  const truncatedMessages = truncateHistory(aiMessages, 50000)

  // Build system prompt
  let systemPrompt = ''
  if (claraConfig.prompt && claraConfig.prompt.trim()) {
    // Custom WhatsApp prompt — inject current date/time
    const now = new Date()
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const y = israelTime.getFullYear()
    const m = String(israelTime.getMonth() + 1).padStart(2, '0')
    const d = String(israelTime.getDate()).padStart(2, '0')
    const h = String(israelTime.getHours()).padStart(2, '0')
    const min = String(israelTime.getMinutes()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    const dayName = dayNames[israelTime.getDay()]

    systemPrompt = claraConfig.prompt
    systemPrompt += `\n\n## CURRENT DATE & TIME (Israel)\nToday: ${dayName} ${d}/${m}/${y} (${dateStr}), ${h}:${min}\nUse this to convert relative dates: "tomorrow" = day after ${dateStr}, etc.`
  } else {
    // Default Clara public prompt (already includes date + knowledge)
    systemPrompt = await getPublicSystemPrompt()
  }

  // Add WhatsApp technical context
  systemPrompt += `\n\n## WHATSAPP CONTEXT
- This is a WhatsApp conversation.
- LANGUAGE: Detect the language of each user message and ALWAYS respond in that SAME language. Never say you can only respond in one language.
- LINKS: When sending a booking link, paste the FULL URL as plain text. Never use markdown link format like [text](url) — WhatsApp does not render it.`

  // Load FAQ if enabled
  if (claraConfig.faq_enabled) {
    try {
      const { data: faqs } = await supabase
        .from('messenger_faq')
        .select('question, answer')
        .eq('is_active', true)
        .order('order_index')

      if (faqs && faqs.length > 0) {
        systemPrompt += '\n\n## FAQ (translate answers to match user language)\n'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        faqs.forEach((faq: any) => {
          // Load Hebrew first (primary), fallback to other languages
          const q = faq.question?.he || faq.question?.fr || faq.question?.en || ''
          const a = faq.answer?.he || faq.answer?.fr || faq.answer?.en || ''
          if (q && a) {
            systemPrompt += `Q: ${q}\nA: ${a}\n\n`
          }
        })
      }
    } catch (faqErr) {
      console.error('[WHATSAPP CLARA] FAQ load error (non-blocking):', faqErr)
    }
  }

  // Call LLM
  const result = await streamLLMResponse({
    messages: truncatedMessages,
    systemPrompt,
    provider: provider as 'gemini' | 'openai' | 'anthropic',
    model,
    maxTokens: globalSettings.max_tokens || 4096,
    temperature,
    tools: createWhatsAppTools(conversation.id, senderPhone, conversation.contact_name),
  })

  // Collect full response + track tool calls for funnel analytics
  let fullResponse = ''
  let consecutiveToolErrors = 0

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      const textContent = (part as { text?: string }).text
      if (textContent) {
        fullResponse += textContent
      }
    } else if (part.type === 'tool-call') {
      const toolName = (part as { toolName?: string }).toolName
      console.log('[WHATSAPP CLARA] Tool call:', toolName)

      // Track tool calls for funnel
      if (toolName === 'simulateBooking') {
        await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'simulate_booking_called', {
          args: (part as { args?: unknown }).args,
        })
      } else if (toolName === 'generateBookingLink') {
        await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'generate_link_called', {
          args: (part as { args?: unknown }).args,
        })
      } else if (toolName === 'escalateToHuman') {
        await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'escalated_to_human', {
          reason: 'user_requested',
        })
      }
    } else if (part.type === 'tool-result') {
      const toolResult = part as { toolName?: string; result?: unknown }
      const toolResultData = toolResult.result as { error?: string; available?: boolean; url?: string } | undefined

      // Track tool results for funnel
      if (toolResult.toolName === 'simulateBooking') {
        if (toolResultData?.error) {
          await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'simulate_booking_error', {
            error: toolResultData.error,
          })
          consecutiveToolErrors++
        } else {
          await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'simulate_booking_success', {
            available: toolResultData?.available,
          })
          consecutiveToolErrors = 0
        }
      } else if (toolResult.toolName === 'generateBookingLink') {
        if (toolResultData?.url) {
          await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'generate_link_success', {
            url: toolResultData.url,
          })
          consecutiveToolErrors = 0
        } else if (toolResultData?.error) {
          await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'tool_error', {
            tool: 'generateBookingLink',
            error: toolResultData.error,
          })
          consecutiveToolErrors++
        }
      }

      // Auto-escalate after 2 consecutive tool errors
      if (consecutiveToolErrors >= 2) {
        console.warn('[WHATSAPP CLARA] Auto-escalating after', consecutiveToolErrors, 'consecutive tool errors')
        await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'escalated_to_human', {
          reason: 'auto_tool_errors',
          consecutiveErrors: consecutiveToolErrors,
        })
        // Set needs_human flag
        await supabase
          .from('whatsapp_conversations')
          .update({ needs_human: true })
          .eq('id', conversation.id)
        // Reset counter
        consecutiveToolErrors = 0
      }
    }
  }

  if (fullResponse.trim()) {
    // Save assistant response to Clara conversation
    await addPublicMessage(claraConv.id, 'assistant', fullResponse)

    // Send via WhatsApp
    const waId = await sendWhatsAppText(senderPhone, fullResponse)
    await storeOutboundMessage(supabase, conversation.id, fullResponse, 'text', waId)
    console.log('[WHATSAPP CLARA] Reply sent to', senderPhone, ':', fullResponse.substring(0, 100))
    return { sent: true, usedFallback: false }
  } else {
    console.warn('[WHATSAPP CLARA] Empty response from LLM for message:', messageText)

    const normalizedLang = (language || '').toLowerCase()
    const fallbackText = normalizedLang.startsWith('fr')
      ? 'Je rencontre un souci technique. Un conseiller va reprendre votre demande rapidement.'
      : normalizedLang.startsWith('he')
        ? 'יש לי תקלה טכנית כרגע. נציג יחזור אליך בהקדם.'
        : 'I am facing a technical issue right now. A human advisor will follow up shortly.'

    await supabase
      .from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_reason: 'Legacy Clara empty response',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    const waId = await sendWhatsAppText(senderPhone, fallbackText)
    await storeOutboundMessage(supabase, conversation.id, fallbackText, 'text', waId)
    await trackClaraEvent(supabase, conversation.id, conversation.branch_id, 'technical_fallback', {
      reason: 'legacy_empty_response',
    })

    return { sent: true, usedFallback: true }
  }
}
