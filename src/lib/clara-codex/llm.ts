import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { ModelMessage, ToolSet, streamText, stepCountIs } from 'ai'

export type CodexProvider = 'gemini' | 'openai' | 'anthropic'

export interface CodexStreamOptions {
  systemPrompt: string
  messages: ModelMessage[]
  provider: CodexProvider
  model: string
  temperature: number
  maxTokens: number
  tools?: ToolSet
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

  return streamText({
    model,
    system: options.systemPrompt,
    messages: options.messages,
    tools: options.tools,
    temperature: options.temperature,
    maxOutputTokens: options.maxTokens,
    stopWhen: stepCountIs(12),
  })
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
