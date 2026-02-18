import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { AgentConfig, AgentId, RouterResult } from '../agents/types'
import { getModelProvider } from '../config'

/** Max time the router is allowed to take before we abort and fallback to 'info' */
const ROUTER_TIMEOUT_MS = 25_000

function getModel(config: AgentConfig) {
  const provider = getModelProvider(config.model)
  const apiKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.GOOGLE_AI_API_KEY

  if (!apiKey) throw new Error(`API key not configured for ${provider}`)

  const modelId = provider === 'gemini' && !config.model.startsWith('models/')
    ? `models/${config.model}`
    : config.model

  if (provider === 'openai') return createOpenAI({ apiKey })(modelId)
  if (provider === 'anthropic') return createAnthropic({ apiKey })(modelId)
  return createGoogleGenerativeAI({ apiKey })(modelId)
}

export async function routeMessage(params: {
  messageText: string
  recentHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  config: AgentConfig
}): Promise<RouterResult> {
  const { messageText, recentHistory, config } = params

  const messages = [
    ...recentHistory.slice(-4).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: [{ type: 'text' as const, text: m.content }],
    })),
    {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: messageText }],
    },
  ]

  // Abort if router takes too long (prevents hanging second messages)
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), ROUTER_TIMEOUT_MS)

  try {
    const start = Date.now()
    const result = await generateText({
      model: getModel(config),
      system: config.prompt,
      messages,
      temperature: config.temperature,
      maxOutputTokens: config.max_tokens,
      abortSignal: abortController.signal,
    })
    const elapsed = Date.now() - start
    if (elapsed > 10_000) {
      console.warn(`[ROUTER] Slow response: ${elapsed}ms`)
    }

    const text = result.text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[ROUTER] No JSON found in response:', text)
      return { agent: 'info', locale: 'en', summary: 'Could not parse intent' }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const validAgents: AgentId[] = ['info', 'resa_game', 'resa_event', 'after_sale', 'escalation']
    const agent = validAgents.includes(parsed.agent) ? parsed.agent : 'info'
    const locale = ['he', 'en', 'fr'].includes(parsed.locale) ? parsed.locale : 'en'

    return {
      agent,
      locale,
      summary: parsed.summary || '',
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`[ROUTER] ${isAbort ? 'TIMEOUT' : 'Error'}: ${errMsg}`)
    return { agent: 'info', locale: 'en', summary: isAbort ? 'Router timeout, fallback to info' : 'Router error, fallback to info' }
  } finally {
    clearTimeout(timeout)
  }
}
