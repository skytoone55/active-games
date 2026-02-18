import { streamCodexResponse, toModelMessagesFromWhatsApp } from '../../llm'
import { getModelProvider } from '../../config'
import type { AgentHandler, AgentContext, AgentConfig, AgentResponse } from '../types'
import { buildInfoPrompt } from './prompt'

export const infoAgent: AgentHandler = {
  id: 'info',

  async run({ context, config, history, messageText, supabase }): Promise<AgentResponse> {
    const allFaq = await loadFAQ(supabase, context.locale)

    // Build search context from recent inbound messages (not just the last one)
    const recentInbound = (history || [])
      .filter((m) => m.direction === 'inbound' && m.content)
      .slice(-4)
      .map((m) => m.content!)
      .join(' ')
    const searchContext = `${recentInbound} ${messageText}`
    const faqRows = filterFAQByRelevance(allFaq, searchContext)

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

// ── FAQ relevance filter ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  // Hebrew
  'של', 'את', 'על', 'עם', 'זה', 'הוא', 'היא', 'אני', 'לא', 'כן', 'מה', 'איך', 'למה', 'מי',
  'יש', 'אין', 'גם', 'רק', 'או', 'אם', 'כי', 'אז', 'פה', 'שם', 'הם', 'לי', 'לך', 'לו', 'לה',
  'אנחנו', 'שלי', 'שלך', 'שלו', 'שלה', 'אפשר', 'צריך', 'רוצה', 'היי', 'שלום', 'בוקר', 'ערב',
  // French
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'je', 'tu', 'il', 'elle', 'on',
  'nous', 'vous', 'ils', 'est', 'sont', 'pour', 'pas', 'que', 'qui', 'dans', 'avec', 'sur', 'par',
  'ne', 'ce', 'se', 'en', 'au', 'aux', 'mais', 'donc', 'car',
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'have', 'has',
  'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'what', 'how',
  'when', 'where', 'who', 'which', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from',
  'and', 'or', 'but', 'not', 'no', 'yes',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[?!.,;:"""''()\-–—]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w))
}

function filterFAQByRelevance(
  allFaq: Array<{ question: string; answer: string }>,
  userMessage: string,
  maxResults = 8,
  minScore = 1
): Array<{ question: string; answer: string }> {
  const keywords = extractKeywords(userMessage)
  if (keywords.length === 0) return allFaq.slice(0, 5)

  const scored = allFaq.map(faq => {
    const faqText = `${faq.question} ${faq.answer}`.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (faqText.includes(kw)) score++
    }
    return { faq, score }
  })

  const relevant = scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.faq)

  // If nothing matched, return nothing — let the model answer freely
  return relevant
}
