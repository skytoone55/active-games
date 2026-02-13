import { createCodexWhatsAppTools } from './tools'
import { buildClaraCodexPrompt } from './prompt'
import { streamCodexResponse, toModelMessagesFromWhatsApp } from './llm'
import { ClaraCodexWhatsAppSettings, getModelProvider, resolveLocalizedCodexText } from './config'
import { getAvailableHumanStatus, trackCodexEvent } from './tracking'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

interface ConversationContext {
  id: string
  branch_id: string | null
  contact_name?: string | null
}

function getNowLabelIsrael(): { isoDate: string; label: string } {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  const hh = String(local.getHours()).padStart(2, '0')
  const mm = String(local.getMinutes()).padStart(2, '0')
  const isoDate = `${y}-${m}-${d}`
  return {
    isoDate,
    label: `${isoDate} ${hh}:${mm} (Asia/Jerusalem)`,
  }
}

function isLikelyEventIntent(message: string, keywords: string[]): boolean {
  const normalized = message.toLowerCase()
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()))
}

function normalizeLocale(input: string | null | undefined): string {
  const locale = (input || '').toLowerCase().trim()
  if (!locale) return 'en'
  if (locale.startsWith('fr')) return 'fr'
  if (locale.startsWith('he')) return 'he'
  return 'en'
}

async function getBranchPhone(branchId: string | null | undefined): Promise<string | null> {
  if (!branchId) return null
  const { data } = await (createServiceRoleClient() as any)
    .from('branches')
    .select('phone')
    .eq('id', branchId)
    .single()

  return data?.phone || null
}

export async function sendCodexWhatsAppText(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || !text.trim()) return null

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  return result.messages?.[0]?.id || null
}

export async function storeCodexOutboundMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversationId: string,
  content: string,
  messageType: string,
  waMessageId: string | null
) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    message_type: messageType,
    content,
    whatsapp_message_id: waMessageId,
    status: 'sent',
    sent_by: null,
  })
}

async function buildNoAgentMessage(settings: ClaraCodexWhatsAppSettings, locale: string, branchId: string | null) {
  const base = resolveLocalizedCodexText(settings.fallback_no_agent_message, locale)
  const phone = await getBranchPhone(branchId)
  if (phone) {
    return `${base}\nPhone: ${phone}`
  }
  return base
}

export async function triggerCodexTechnicalFallback(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  conversation: ConversationContext
  senderPhone: string
  locale: string
  settings: ClaraCodexWhatsAppSettings
  metadata?: Record<string, unknown>
}) {
  const { supabase, conversation, senderPhone, locale, settings } = params
  const normalizedLocale = normalizeLocale(locale)
  const technicalMessage = resolveLocalizedCodexText(settings.fallback_tech_error_message, normalizedLocale)
  const availability = await getAvailableHumanStatus(conversation.branch_id)
  const tail = availability.available
    ? resolveLocalizedCodexText(settings.fallback_human_message, normalizedLocale)
    : await buildNoAgentMessage(settings, normalizedLocale, conversation.branch_id)

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

  const waId = await sendCodexWhatsAppText(senderPhone, fullMessage)
  await storeCodexOutboundMessage(supabase, conversation.id, fullMessage, 'text', waId)

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'technical_fallback', {
    humanAvailable: availability.available,
    connectedCount: availability.connectedCount,
    ...params.metadata,
  })
}

export async function handleClaraCodexWhatsAppResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  conversation: ConversationContext,
  senderPhone: string,
  messageText: string,
  settings: ClaraCodexWhatsAppSettings,
  locale: string
) {
  const normalizedLocale = normalizeLocale(locale)
  const now = getNowLabelIsrael()

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'conversation_turn', {
    locale: normalizedLocale,
  })

  if (isLikelyEventIntent(messageText, settings.event_keywords)) {
    await supabase
      .from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_reason: 'Event intent detected by Clara Codex',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'event_intent_detected', {
      sample: messageText.slice(0, 160),
    })
  }

  const [{ data: history }, { data: faqRows }] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('direction, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(120),
    settings.faq_enabled
      ? supabase
        .from('messenger_faq')
        .select('question, answer')
        .eq('is_active', true)
        .order('order_index')
      : Promise.resolve({ data: [] }),
  ])

  const humanStatus = await getAvailableHumanStatus(conversation.branch_id)
  const modelMessages = toModelMessagesFromWhatsApp(history || [], 80)
  const systemPrompt = buildClaraCodexPrompt({
    settings,
    faqRows: faqRows || [],
    todayISO: now.isoDate,
    nowLabel: now.label,
    humanAvailable: humanStatus.available,
  })

  if (!systemPrompt.trim()) {
    await triggerCodexTechnicalFallback({
      supabase,
      conversation,
      senderPhone,
      locale: normalizedLocale,
      settings,
      metadata: {
        reason: 'empty_primary_prompt',
      },
    })
    return {
      success: false,
      usedEscalationTool: true,
      toolErrors: 0,
    }
  }

  const provider = getModelProvider(settings.model)
  const tools = createCodexWhatsAppTools({
    conversationId: conversation.id,
    branchId: conversation.branch_id,
    senderPhone,
    contactName: conversation.contact_name || undefined,
  })

  const stream = await streamCodexResponse({
    systemPrompt,
    messages: modelMessages,
    provider,
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.max_tokens,
    tools,
  })

  let fullText = ''
  let usedEscalationTool = false
  let toolErrors = 0

  for await (const part of stream.fullStream) {
    if (part.type === 'text-delta') {
      const chunk = (part as { text?: string }).text
      if (chunk) fullText += chunk
      continue
    }

    if (part.type === 'tool-call') {
      const toolName = (part as { toolName?: string }).toolName || 'unknown'
      if (toolName === 'escalateToHuman') usedEscalationTool = true
      await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'tool_called', {
        toolName,
      })
      continue
    }

    if (part.type === 'tool-result') {
      const toolName = (part as { toolName?: string }).toolName || 'unknown'
      const result = (part as { result?: { error?: string; available?: boolean; success?: boolean } }).result
      if (result?.error) {
        toolErrors += 1
      } else {
        toolErrors = 0
      }

      await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'tool_result', {
        toolName,
        hasError: !!result?.error,
        available: result?.available,
        success: result?.success,
      })
    }
  }

  if (!fullText.trim()) {
    if (usedEscalationTool) {
      if (humanStatus.available) {
        fullText = resolveLocalizedCodexText(settings.fallback_human_message, normalizedLocale)
      } else {
        fullText = await buildNoAgentMessage(settings, normalizedLocale, conversation.branch_id)
      }
    } else {
      fullText = resolveLocalizedCodexText(settings.fallback_tech_error_message, normalizedLocale)
    }
  }

  if (usedEscalationTool && !humanStatus.available) {
    const noAgent = await buildNoAgentMessage(settings, normalizedLocale, conversation.branch_id)
    if (!fullText.includes(noAgent)) {
      fullText = `${fullText}\n\n${noAgent}`
    }
  }

  const waId = await sendCodexWhatsAppText(senderPhone, fullText)
  await storeCodexOutboundMessage(supabase, conversation.id, fullText, 'text', waId)

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'assistant_reply_sent', {
    textLength: fullText.length,
    usedEscalationTool,
    toolErrors,
    humanAvailable: humanStatus.available,
  })

  return {
    success: true,
    usedEscalationTool,
    toolErrors,
  }
}
