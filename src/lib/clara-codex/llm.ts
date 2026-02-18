import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { ModelMessage, ToolSet, streamText, stepCountIs } from 'ai'

export type CodexProvider = 'gemini' | 'openai' | 'anthropic'

/** Max time an agent stream is allowed to run before abort */
const AGENT_STREAM_TIMEOUT_MS = 55_000

export interface CodexStreamOptions {
  systemPrompt: string
  messages: ModelMessage[]
  provider: CodexProvider
  model: string
  temperature: number
  maxTokens: number
  tools?: ToolSet
  abortSignal?: AbortSignal
}

function resolveModel(provider: CodexProvider, model: string): string {
  if (provider !== 'gemini') return model
  if (model.startsWith('models/')) return model
  return `models/${model}`
}

function getLanguageModel(provider: CodexProvider, model: string) {
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
    return createOpenAI({ apiKey })(model)
  }
  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
    return createAnthropic({ apiKey })(model)
  }
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not configured')
  return createGoogleGenerativeAI({ apiKey })(model)
}

export async function streamCodexResponse(options: CodexStreamOptions) {
  const resolvedModel = resolveModel(options.provider, options.model)
  const model = getLanguageModel(options.provider, resolvedModel)

  // Use provided abort signal or create a default timeout
  let abortSignal = options.abortSignal
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  if (!abortSignal) {
    const controller = new AbortController()
    abortSignal = controller.signal
    timeoutHandle = setTimeout(() => controller.abort(), AGENT_STREAM_TIMEOUT_MS)
  }

  const stream = streamText({
    model,
    system: options.systemPrompt,
    messages: options.messages,
    tools: options.tools,
    temperature: options.temperature,
    maxOutputTokens: options.maxTokens,
    stopWhen: stepCountIs(12),
    abortSignal,
  })

  // Clear the safety timeout once the stream finishes (success or error)
  if (timeoutHandle) {
    const handle = timeoutHandle
    // Wrap PromiseLike in a real Promise for proper .catch() support
    Promise.resolve(stream.text).then(() => clearTimeout(handle), () => clearTimeout(handle))
  }

  return stream
}

export interface WhatsAppHistoryMessage {
  direction: 'inbound' | 'outbound'
  content: string | null
}

export function toModelMessagesFromWhatsApp(
  history: WhatsAppHistoryMessage[],
  maxMessages = 60
): ModelMessage[] {
  const sanitized = history
    .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
    .slice(-maxMessages)

  return sanitized.map((message) => ({
    role: message.direction === 'inbound' ? 'user' : 'assistant',
    content: [{ type: 'text', text: message.content as string }],
  }))
}
