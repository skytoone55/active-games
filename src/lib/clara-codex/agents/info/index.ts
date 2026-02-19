import { streamCodexResponse, toModelMessagesFromWhatsApp } from '../../llm'
import { getModelProvider } from '../../config'
import type { AgentHandler, AgentContext, AgentResponse } from '../types'
import { buildInfoPrompt } from './prompt'
import { loadRelevantFAQ } from '../shared-faq'

export const infoAgent: AgentHandler = {
  id: 'info',

  async run({ context, config, history, messageText, supabase }): Promise<AgentResponse> {
    // Load FAQ using shared module (vector search + keyword fallback)
    const faqRows = await loadRelevantFAQ({ supabase, messageText, context, routerSummary: context.routerSummary })

    // Build profile context label for the prompt
    const profileContext = buildProfileContextLabel(context)

    const systemPrompt = buildInfoPrompt({
      config,
      locale: context.locale,
      nowLabel: context.nowLabel,
      todayISO: context.nowISO,
      faqRows,
      profileContext,
    })

    const provider = getModelProvider(config.model)
    const modelMessages = toModelMessagesFromWhatsApp(history, 40)

    const stream = await streamCodexResponse({
      systemPrompt,
      messages: modelMessages,
      provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.max_tokens,
    })

    let fullText = ''
    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        const chunk = (part as { text?: string }).text
        if (chunk) fullText += chunk
      }
    }

    return {
      text: fullText.trim(),
      usedEscalationTool: false,
      toolErrors: 0,
      agentId: 'info',
    }
  },
}

// ── Profile context helper ───────────────────────────────────────────

function buildProfileContextLabel(context: AgentContext): string {
  const profile = context.profile
  if (!profile?.resa_type) {
    return 'No specific context. If the answer differs between games and events, provide both options. Default to "game" context if nothing specific is mentioned.'
  }

  const parts: string[] = []
  if (profile.resa_type === 'game') {
    const gameLabel = profile.game_type
      ? { laser: 'Laser Tag', active: 'Active Games', mix: 'Mix (Laser + Active)' }[profile.game_type] || profile.game_type
      : 'type not yet specified'
    parts.push(`User is asking about a GAME (${gameLabel})`)
  } else if (profile.resa_type === 'event') {
    parts.push('User is asking about an EVENT / birthday')
  }

  if (profile.participants) {
    parts.push(`${profile.participants} participants`)
  }

  return parts.join('. ') + '.'
}
