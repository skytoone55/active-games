/**
 * LLM Provider Manager pour Clara
 * Gère les différents providers (Gemini, OpenAI, Anthropic) via Vercel AI SDK
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, generateText, stepCountIs } from 'ai'
import type { ModelMessage, ToolSet, LanguageModel } from 'ai'
import type { ClaraSettings } from '../supabase/types'

// Types
export type LLMProvider = 'gemini' | 'openai' | 'anthropic'

export interface LLMStreamOptions {
  messages: ModelMessage[]
  systemPrompt: string
  provider?: LLMProvider
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: ToolSet
  onToolCall?: (toolName: string, args: unknown) => void
}

export interface LLMGenerateOptions {
  messages: ModelMessage[]
  systemPrompt: string
  provider?: LLMProvider
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: ToolSet
}

// Defaults
const DEFAULT_PROVIDER: LLMProvider = 'gemini'
const DEFAULT_MAX_TOKENS = 20000
const DEFAULT_TEMPERATURE = 0.7

// Default models par provider
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  gemini: 'gemini-2.0-flash-lite',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
}

// Mapping modèles Gemini (préfixe models/ requis)
const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash-lite': 'models/gemini-2.0-flash-lite',
  'gemini-2.0-flash': 'models/gemini-2.0-flash',
  'gemini-1.5-flash': 'models/gemini-1.5-flash',
  'gemini-1.5-pro': 'models/gemini-1.5-pro',
  // Legacy mappings
  'gemini-2.5-flash-lite': 'models/gemini-2.0-flash-lite',
  'gemini-2.5-flash': 'models/gemini-2.0-flash',
}

/**
 * Crée un client pour le provider spécifié
 */
function createProviderClient(provider: LLMProvider) {
  switch (provider) {
    case 'gemini': {
      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY is not configured')
      }
      return createGoogleGenerativeAI({ apiKey })
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured')
      }
      return createOpenAI({ apiKey })
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured')
      }
      return createAnthropic({ apiKey })
    }

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Résout le nom du modèle pour le provider
 */
function resolveModelName(provider: LLMProvider, model: string): string {
  if (provider === 'gemini') {
    // Gemini nécessite le préfixe "models/"
    if (model.startsWith('models/')) return model
    return GEMINI_MODEL_MAP[model] || `models/${model}`
  }

  // OpenAI et Anthropic utilisent les noms directement
  return model
}

/**
 * Obtient le modèle LanguageModel pour le provider et le modèle spécifiés
 */
function getLanguageModel(provider: LLMProvider, model: string): LanguageModel {
  const client = createProviderClient(provider)
  const resolvedModel = resolveModelName(provider, model)

  console.log(`[LLM] Using ${provider}/${resolvedModel}`)

  return client(resolvedModel) as LanguageModel
}

/**
 * Stream une réponse LLM (pour l'effet human-like)
 */
export async function streamLLMResponse(options: LLMStreamOptions) {
  const {
    messages,
    systemPrompt,
    provider = DEFAULT_PROVIDER,
    model = DEFAULT_MODELS[provider],
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    tools,
    onToolCall,
  } = options

  const languageModel = getLanguageModel(provider, model)

  const result = streamText({
    model: languageModel,
    system: systemPrompt,
    messages,
    temperature,
    tools,
    stopWhen: stepCountIs(10), // Continue après les tool calls jusqu'à 10 steps
    onStepFinish: (step) => {
      console.log('[LLM] Step finished:', {
        hasText: !!step.text,
        textLength: step.text?.length || 0,
        toolCallsCount: step.toolCalls?.length || 0,
        toolCalls: step.toolCalls?.map(tc => 'toolName' in tc ? tc.toolName : 'unknown'),
      })
      if (step.toolCalls && onToolCall) {
        for (const toolCall of step.toolCalls) {
          if ('args' in toolCall) {
            onToolCall(toolCall.toolName, toolCall.args)
          }
        }
      }
    },
  })

  return result
}

/**
 * Génère une réponse complète (sans streaming)
 */
export async function generateLLMResponse(options: LLMGenerateOptions): Promise<{
  text: string
  toolCalls?: Array<{ toolName: string; args: unknown; result: unknown }>
  usage?: { promptTokens: number; completionTokens: number }
}> {
  const {
    messages,
    systemPrompt,
    provider = DEFAULT_PROVIDER,
    model = DEFAULT_MODELS[provider],
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    tools,
  } = options

  const languageModel = getLanguageModel(provider, model)

  const result = await generateText({
    model: languageModel,
    system: systemPrompt,
    messages,
    temperature,
    tools,
  })

  return {
    text: result.text,
    toolCalls: result.toolCalls?.filter(tc => 'args' in tc).map(tc => ({
      toolName: tc.toolName,
      args: 'args' in tc ? tc.args : undefined,
      result: 'result' in tc ? tc.result : undefined,
    })),
    usage: result.usage ? {
      promptTokens: result.usage.inputTokens || 0,
      completionTokens: result.usage.outputTokens || 0,
    } : undefined,
  }
}

/**
 * Vérifie que le provider est configuré et accessible
 */
export async function testLLMConnection(provider: LLMProvider, model?: string): Promise<{
  success: boolean
  error?: string
  provider: string
  model: string
}> {
  const modelToUse = model || DEFAULT_MODELS[provider]

  try {
    const languageModel = getLanguageModel(provider, modelToUse)

    const result = await generateText({
      model: languageModel,
      prompt: 'Say "OK" if you can hear me.',
    })

    return {
      success: result.text.toLowerCase().includes('ok'),
      provider,
      model: modelToUse,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
      model: modelToUse,
    }
  }
}

/**
 * Vérifie si un provider a sa clé API configurée
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  switch (provider) {
    case 'gemini':
      return !!process.env.GOOGLE_AI_API_KEY
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    default:
      return false
  }
}

/**
 * Helper: Crée les options LLM depuis les settings Clara
 */
export function createLLMOptionsFromSettings(settings: Partial<ClaraSettings>): {
  provider: LLMProvider
  model: string
  maxTokens: number
  temperature: number
} {
  const provider = (settings.provider as LLMProvider) || DEFAULT_PROVIDER
  const model = settings.model || DEFAULT_MODELS[provider]

  return {
    provider,
    model,
    maxTokens: settings.max_tokens || DEFAULT_MAX_TOKENS,
    temperature: settings.temperature || DEFAULT_TEMPERATURE,
  }
}

// Re-export des helpers depuis gemini.ts pour la rétro-compatibilité
export { convertToAIMessages, truncateHistory, estimateTokens } from './gemini'
