import { streamCodexResponse, toModelMessagesFromWhatsApp } from '../../llm'
import { getModelProvider } from '../../config'
import type { AgentHandler, AgentContext, AgentConfig, AgentResponse } from '../types'
import { buildInfoPrompt } from './prompt'

export const infoAgent: AgentHandler = {
  id: 'info',

  async run({ context, config, history, supabase }): Promise<AgentResponse> {
    const faqRows = await loadFAQ(supabase, context.locale)

    const systemPrompt = buildInfoPrompt({
      config,
      locale: context.locale,
      nowLabel: context.nowLabel,
      todayISO: context.nowISO,
      faqRows,
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

async function loadFAQ(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  locale: string
): Promise<Array<{ question: string; answer: string }>> {
  const { data } = await supabase
    .from('messenger_faq')
    .select('question, answer')
    .eq('is_active', true)
    .order('order_index')

  if (!data || data.length === 0) return []

  return data.map((row: { question: Record<string, string> | string | null; answer: Record<string, string> | string | null }) => {
    const q = pickLocalized(row.question, locale)
    const a = pickLocalized(row.answer, locale)
    return { question: q, answer: a }
  }).filter((r: { question: string; answer: string }) => r.question && r.answer)
}

function pickLocalized(value: Record<string, string> | string | null, locale: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value[locale] || value.en || value.fr || value.he || ''
}
