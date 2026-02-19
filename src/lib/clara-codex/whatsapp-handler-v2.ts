import { getAgent } from './agents/index'
import { DEFAULT_AGENT_CONFIGS } from './agents/defaults'
import { routeMessage } from './router/index'
import { getAvailableHumanStatus, trackCodexEvent } from './tracking'
import { resolveLocalizedCodexText } from './config'
import type { AgentConfig, AgentContext, AgentId, AgentResponse, ConversationProfile } from './agents/types'
import type { ClaraCodexWhatsAppSettings } from './config'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

interface ConversationContext {
  id: string
  branch_id: string | null
  contact_name?: string | null
  contact_id?: string | null
  profile?: ConversationProfile
}

interface MultiAgentSettings extends ClaraCodexWhatsAppSettings {
  agents?: Partial<Record<AgentId, Partial<AgentConfig>>>
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
  return { isoDate, label: `${isoDate} ${hh}:${mm} (Asia/Jerusalem)` }
}

function resolveAgentConfig(agentId: AgentId, settings: MultiAgentSettings): AgentConfig {
  const defaults = DEFAULT_AGENT_CONFIGS[agentId]
  const overrides = settings.agents?.[agentId]
  if (!overrides) return { ...defaults }

  return {
    ...defaults,
    model: overrides.model || defaults.model,
    temperature: overrides.temperature ?? defaults.temperature,
    max_tokens: overrides.max_tokens ?? defaults.max_tokens,
    // Use DB prompt as-is (even empty string). No default fallback.
    prompt: typeof overrides.prompt === 'string' ? overrides.prompt : defaults.prompt,
    enabled: overrides.enabled ?? defaults.enabled,
  }
}

function normalizeLocale(input: string | null | undefined): string {
  const locale = (input || '').toLowerCase().trim()
  if (locale.startsWith('fr')) return 'fr'
  if (locale.startsWith('en')) return 'en'
  return 'he'
}

async function getBranchPhone(branchId: string | null): Promise<string | null> {
  if (!branchId) return null
  const { data } = await (createServiceRoleClient() as any)
    .from('branches').select('phone').eq('id', branchId).single()
  return data?.phone || null
}

async function buildNoAgentMessage(settings: ClaraCodexWhatsAppSettings, locale: string, branchId: string | null): Promise<string> {
  const base = resolveLocalizedCodexText(settings.fallback_no_agent_message, locale)
  const phone = await getBranchPhone(branchId)
  return phone ? `${base}\nPhone: ${phone}` : base
}

export async function sendCodexWhatsAppText(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || !text.trim()) return null

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } }),
  })

  const result = await response.json()
  return result.messages?.[0]?.id || null
}

async function storeOutboundMessage(supabase: any, conversationId: string, content: string, waMessageId: string | null) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    message_type: 'text',
    content,
    whatsapp_message_id: waMessageId,
    status: 'sent',
    sent_by: null,
  })
}

export async function handleClaraCodexWhatsAppResponseV2(
  supabase: any,
  conversation: ConversationContext,
  senderPhone: string,
  messageText: string,
  settings: MultiAgentSettings,
  locale: string
) {
  const now = getNowLabelIsrael()

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'conversation_turn_v2', {
    locale: normalizeLocale(locale),
  })

  // 1. Load recent history for router context
  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(120)

  const recentMessages = (history || [])
    .filter((m: any) => m.content?.trim())
    .slice(-6)
    .map((m: any) => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.content as string,
    }))

  // 2. Route the message
  const routerConfig = resolveAgentConfig('router', settings)
  const routing = await routeMessage({
    messageText,
    recentHistory: recentMessages,
    config: routerConfig,
  })

  // If router timed out, use the caller's locale instead of the router fallback
  const routerTimedOut = routing.summary?.includes('timeout')
  const detectedLocale = routerTimedOut ? normalizeLocale(locale) : (routing.locale || normalizeLocale(locale))

  // 2b. Merge conversation profile from router hints
  const currentProfile: ConversationProfile = conversation.profile || {}
  const updatedProfile = { ...currentProfile }
  let profileChanged = false
  if (routing.resa_type && !currentProfile.resa_type) {
    updatedProfile.resa_type = routing.resa_type
    profileChanged = true
  }
  if (routing.game_type && !currentProfile.game_type) {
    updatedProfile.game_type = routing.game_type
    profileChanged = true
  }
  if (profileChanged) {
    conversation.profile = updatedProfile
    await supabase.from('whatsapp_conversations')
      .update({ profile: updatedProfile })
      .eq('id', conversation.id)
  }

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'router_decision', {
    agent: routing.agent,
    locale: detectedLocale,
    summary: routing.summary,
    resa_type: routing.resa_type || null,
    game_type: routing.game_type || null,
  })

  // 3. Get the agent
  const agentId = routing.agent
  const agent = getAgent(agentId)
  const agentConfig = resolveAgentConfig(agentId, settings)

  if (!agent || !agentConfig.enabled) {
    // Fallback to info agent
    const fallbackAgent = getAgent('info')
    const fallbackConfig = resolveAgentConfig('info', settings)
    if (fallbackAgent) {
      return runAgentAndRespond({
        agent: fallbackAgent,
        config: fallbackConfig,
        context: buildContext(conversation, senderPhone, detectedLocale, now, routing.summary),
        history: (history || []) as Array<{ direction: 'inbound' | 'outbound'; content: string | null }>,
        messageText,
        settings,
        supabase,
        senderPhone,
        conversation,
      })
    }
  }

  // 4. Run the agent
  return runAgentAndRespond({
    agent: agent!,
    config: agentConfig,
    context: buildContext(conversation, senderPhone, detectedLocale, now, routing.summary),
    history: history || [],
    messageText,
    settings,
    supabase,
    senderPhone,
    conversation,
  })
}

function buildContext(
  conversation: ConversationContext,
  senderPhone: string,
  locale: string,
  now: { isoDate: string; label: string },
  routerSummary?: string
): AgentContext {
  return {
    conversationId: conversation.id,
    branchId: conversation.branch_id,
    senderPhone,
    contactName: conversation.contact_name || null,
    contactId: conversation.contact_id || null,
    locale,
    nowISO: now.isoDate,
    nowLabel: now.label,
    humanAvailable: false, // Will be resolved below
    routerSummary,
    profile: conversation.profile || undefined,
  }
}

async function runAgentAndRespond(params: {
  agent: { id: AgentId; run: Function }
  config: AgentConfig
  context: AgentContext
  history: Array<{ direction: 'inbound' | 'outbound'; content: string | null }>
  messageText: string
  settings: MultiAgentSettings
  supabase: any
  senderPhone: string
  conversation: ConversationContext
}) {
  const { agent, config, context, history, messageText, settings, supabase, senderPhone, conversation } = params

  // Resolve human availability
  const humanStatus = await getAvailableHumanStatus(conversation.branch_id)
  context.humanAvailable = humanStatus.available

  let response: AgentResponse

  try {
    response = await agent.run({
      context,
      config,
      history,
      messageText,
      supabase,
    })
  } catch (error) {
    console.error(`[CLARA V2] Agent ${agent.id} error:`, error)
    // Technical fallback
    const techMessage = resolveLocalizedCodexText(settings.fallback_tech_error_message, context.locale)
    const tail = humanStatus.available
      ? resolveLocalizedCodexText(settings.fallback_human_message, context.locale)
      : await buildNoAgentMessage(settings, context.locale, conversation.branch_id)

    const fullMessage = `${techMessage}\n\n${tail}`
    const waId = await sendCodexWhatsAppText(senderPhone, fullMessage)
    await storeOutboundMessage(supabase, conversation.id, fullMessage, waId)

    await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'agent_error', {
      agentId: agent.id, error: String(error),
    })

    return { success: false, usedEscalationTool: true, toolErrors: 1 }
  }

  // Handle empty response
  let fullText = response.text
  let isTechFallback = false
  if (!fullText.trim()) {
    if (response.usedEscalationTool) {
      fullText = humanStatus.available
        ? resolveLocalizedCodexText(settings.fallback_human_message, context.locale)
        : await buildNoAgentMessage(settings, context.locale, conversation.branch_id)
    } else {
      fullText = resolveLocalizedCodexText(settings.fallback_tech_error_message, context.locale)
      isTechFallback = true
    }
  }

  // When agent returns empty (tech fallback) or escalates → mark needs_human + pause Clara
  if (isTechFallback || response.usedEscalationTool) {
    const autoResumeMinutes = Number((settings as any)?.auto_resume_minutes) || 30
    await supabase.from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_reason: isTechFallback
          ? 'Clara empty response — technical fallback'
          : 'Clara escalation to human',
        clara_paused: true,
        clara_paused_until: new Date(Date.now() + autoResumeMinutes * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)

    console.log(`[CLARA V2] Marked needs_human for ${conversation.id} (${isTechFallback ? 'tech_fallback' : 'escalation'})`)
  }

  // Append no-agent message if escalated but no humans
  if (response.usedEscalationTool && !humanStatus.available) {
    const noAgent = await buildNoAgentMessage(settings, context.locale, conversation.branch_id)
    if (!fullText.includes(noAgent)) {
      fullText = `${fullText}\n\n${noAgent}`
    }
  }

  // Send response
  const waId = await sendCodexWhatsAppText(senderPhone, fullText)
  await storeOutboundMessage(supabase, conversation.id, fullText, waId)

  await trackCodexEvent(supabase, conversation.id, conversation.branch_id, 'assistant_reply_sent_v2', {
    textLength: fullText.length,
    agentId: response.agentId,
    usedEscalationTool: response.usedEscalationTool,
    toolErrors: response.toolErrors,
    humanAvailable: humanStatus.available,
    routedTo: response.agentId,
    isTechFallback,
  })

  return {
    success: true,
    usedEscalationTool: response.usedEscalationTool || isTechFallback,
    toolErrors: response.toolErrors,
  }
}
