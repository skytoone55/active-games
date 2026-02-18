/**
 * FAQ Embedding utilities
 * Generates OpenAI embeddings for FAQ entries and stores them in Supabase
 */

const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Generate an embedding vector for a text string */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[FAQ Embeddings] OPENAI_API_KEY not configured')
    return null
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    })
    if (!res.ok) {
      console.error('[FAQ Embeddings] OpenAI API error:', res.status, await res.text())
      return null
    }
    const json = await res.json()
    return json.data?.[0]?.embedding || null
  } catch (error) {
    console.error('[FAQ Embeddings] Error generating embedding:', error)
    return null
  }
}

/** Build the text to embed from a FAQ row's question and answer (all languages) */
export function buildFAQEmbeddingText(
  question: Record<string, string> | string,
  answer: Record<string, string> | string
): string {
  const qParts = typeof question === 'string' ? [question] : Object.values(question).filter(Boolean)
  const aParts = typeof answer === 'string' ? [answer] : Object.values(answer).filter(Boolean)
  return [...qParts, ...aParts].join(' ').trim()
}

/** Generate and store an embedding for a single FAQ entry */
export async function syncFAQEmbedding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  faqId: string,
  question: Record<string, string> | string,
  answer: Record<string, string> | string
): Promise<boolean> {
  const text = buildFAQEmbeddingText(question, answer)
  if (!text) return false

  const embedding = await generateEmbedding(text)
  if (!embedding) return false

  const { error } = await supabase
    .from('messenger_faq')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', faqId)

  if (error) {
    console.error(`[FAQ Embeddings] Failed to store embedding for FAQ ${faqId}:`, error)
    return false
  }

  return true
}

/** Sync embeddings for all active FAQ entries. Returns { synced, failed } counts */
export async function syncAllFAQEmbeddings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ synced: number; failed: number; total: number }> {
  const { data: faqs, error } = await supabase
    .from('messenger_faq')
    .select('id, question, answer')
    .eq('is_active', true)
    .order('order_index')

  if (error || !faqs) {
    console.error('[FAQ Embeddings] Failed to load FAQs:', error)
    return { synced: 0, failed: 0, total: 0 }
  }

  let synced = 0
  let failed = 0

  for (const faq of faqs) {
    const success = await syncFAQEmbedding(supabase, faq.id, faq.question, faq.answer)
    if (success) synced++
    else failed++
  }

  console.log(`[FAQ Embeddings] Synced ${synced}/${faqs.length} embeddings (${failed} failed)`)
  return { synced, failed, total: faqs.length }
}
