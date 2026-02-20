import type { AgentContext } from './types'
import { getRelevantCategories } from './info/faq-categories'
import { trackCodexEvent } from '../tracking'

/** Internal FAQ row with optional relevance score */
interface FAQRow {
  question: string
  answer: string
  similarity?: number
}

// ── Vector similarity search ──────────────────────────────────────────

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

export async function searchFAQByEmbedding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  query: string,
  locale: string,
  matchCount = 5,
  matchThreshold = 0.3,
  filterCategories: string[] | null = null
): Promise<FAQRow[]> {
  const embedding = await getEmbedding(query)
  if (!embedding) return []

  const rpcParams: Record<string, unknown> = {
    query_embedding: JSON.stringify(embedding),
    match_threshold: matchThreshold,
    match_count: matchCount,
  }
  if (filterCategories) {
    rpcParams.filter_categories = filterCategories
  }

  const { data, error } = await supabase.rpc('match_faq', rpcParams)

  if (error || !data || data.length === 0) return []

  return data.map((row: { question: Record<string, string> | string | null; answer: Record<string, string> | string | null; similarity?: number }) => {
    const q = pickLocalized(row.question, locale)
    const a = pickLocalized(row.answer, locale)
    return { question: q, answer: a, similarity: row.similarity ?? undefined }
  }).filter((r: FAQRow) => r.question && r.answer)
}

// ── Keyword search ──────────────────────────────────────────────────

export async function loadFAQ(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  locale: string
): Promise<Array<{ question: string; answer: string }>> {
  const { data } = await supabase
    .from('clara_whatsapp_faq')
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

const STOP_WORDS = new Set([
  'של', 'את', 'על', 'עם', 'זה', 'הוא', 'היא', 'אני', 'לא', 'כן', 'מה', 'איך', 'למה', 'מי',
  'יש', 'אין', 'גם', 'רק', 'או', 'אם', 'כי', 'אז', 'פה', 'שם', 'הם', 'לי', 'לך', 'לו', 'לה',
  'אנחנו', 'שלי', 'שלך', 'שלו', 'שלה', 'אפשר', 'צריך', 'רוצה', 'היי', 'שלום', 'בוקר', 'ערב',
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'je', 'tu', 'il', 'elle', 'on',
  'nous', 'vous', 'ils', 'est', 'sont', 'pour', 'pas', 'que', 'qui', 'dans', 'avec', 'sur', 'par',
  'ne', 'ce', 'se', 'en', 'au', 'aux', 'mais', 'donc', 'car',
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

function fuzzyMatch(keyword: string, faqText: string): boolean {
  if (faqText.includes(keyword)) return true
  const faqWords = faqText.split(/\s+/)
  for (const fw of faqWords) {
    if (fw.length < 3 || keyword.length < 3) continue
    if (fw.includes(keyword) || keyword.includes(fw)) return true
    let common = 0
    for (let i = 0; i < Math.min(fw.length, keyword.length); i++) {
      if (fw[i] === keyword[i]) common++
      else break
    }
    if (common >= 3) return true
  }
  return false
}

export function filterFAQByKeywords(
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
      if (fuzzyMatch(kw, faqText)) score++
    }
    return { faq, score }
  })

  const relevant = scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.faq)

  return relevant
}

// ── High-level FAQ loader (used by all agents) ────────────────────────

/** Minimum vector similarity to consider a result relevant */
const MIN_SIMILARITY = 0.35

/**
 * Load relevant FAQ rows for any agent.
 * Uses HYBRID search: vector + keyword in parallel, merges & deduplicates.
 * Runs TWO vector searches (user message + router summary) to handle cross-language.
 * Filters out low-similarity vector results to avoid injecting irrelevant FAQ.
 */
export async function loadRelevantFAQ(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  messageText: string
  context: AgentContext
  routerSummary?: string
}): Promise<Array<{ question: string; answer: string }>> {
  const { supabase, messageText, context, routerSummary } = params

  const hasRouterSummary = routerSummary && !routerSummary.includes('timeout') && !routerSummary.includes('fallback')

  const categories = getRelevantCategories(context.profile)

  // ── Hybrid: vector (user msg + router summary) + keyword, all in parallel ──
  const [vectorFromMessage, vectorFromRouter, allFaq] = await Promise.all([
    // Always search with user's original message (same language as FAQ = better scores)
    searchFAQByEmbedding(supabase, messageText, context.locale, 5, 0.3, categories),
    // Also search with router summary if available (English, may catch different intent)
    hasRouterSummary
      ? searchFAQByEmbedding(supabase, routerSummary!, context.locale, 5, 0.3, categories)
      : Promise.resolve([] as FAQRow[]),
    loadFAQ(supabase, context.locale),
  ])

  // Merge both vector results, keep best score per question
  const vectorMap = new Map<string, FAQRow>()
  for (const r of [...vectorFromMessage, ...vectorFromRouter]) {
    const key = r.question.toLowerCase().trim()
    const existing = vectorMap.get(key)
    if (!existing || (r.similarity ?? 0) > (existing.similarity ?? 0)) {
      vectorMap.set(key, r)
    }
  }
  const vectorResults = Array.from(vectorMap.values())

  // Filter vector results: keep only those with high enough similarity
  const goodVectorResults = vectorResults.filter(r => (r.similarity ?? 0) >= MIN_SIMILARITY)
  const weakVectorResults = vectorResults.filter(r => (r.similarity ?? 0) < MIN_SIMILARITY)

  // Keyword search on original user message (not router summary — closer to actual words)
  const keywordResults = filterFAQByKeywords(allFaq, messageText)

  // ── Merge & deduplicate (vector first, then keyword extras) ──
  const seen = new Set<string>()
  const merged: Array<{ question: string; answer: string }> = []

  for (const row of goodVectorResults) {
    const key = row.question.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      merged.push({ question: row.question, answer: row.answer })
    }
  }

  for (const row of keywordResults) {
    const key = row.question.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(row)
    }
  }

  // Cap at 8 results max to keep prompt reasonable
  const faqRows = merged.slice(0, 8)

  // Track FAQ results (fire-and-forget, non-blocking)
  trackCodexEvent(supabase, context.conversationId, context.branchId, 'faq_loaded', {
    searchMethod: 'hybrid',
    searchContext: messageText,
    routerSummary: hasRouterSummary ? routerSummary : undefined,
    categories,
    locale: context.locale,
    resultCount: faqRows.length,
    vectorCount: goodVectorResults.length,
    vectorDropped: weakVectorResults.length,
    vectorScores: vectorResults.map(r => ({ q: r.question.slice(0, 60), s: Math.round((r.similarity ?? 0) * 100) / 100 })),
    keywordCount: keywordResults.length,
    questions: faqRows.map(r => r.question.slice(0, 80)),
  }).catch(() => {})

  return faqRows
}

/**
 * Format FAQ rows into a text block for prompt injection.
 */
export function formatFAQBlock(faqRows: Array<{ question: string; answer: string }>): string {
  if (faqRows.length === 0) return 'No FAQ available for this question. Do NOT invent an answer — say you are not sure and suggest contacting the branch directly.'
  return faqRows
    .map(row => `Q: ${row.question}\nA: ${row.answer}`)
    .join('\n\n')
}
