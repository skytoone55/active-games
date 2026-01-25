/**
 * Service Gemini pour Clara
 * Utilise le Vercel AI SDK avec Google Generative AI
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, generateText } from 'ai'
import type { ModelMessage, ToolSet } from 'ai'
import type { ClaraSettings } from '../supabase/types'

// Configuration par défaut
// Modèles disponibles: https://ai.google.dev/gemini-api/docs/models/gemini
// IMPORTANT: L'API Google requiert le préfixe "models/"
// gemini-2.5-flash-lite = le moins cher de la gamme 2.5
const DEFAULT_MODEL = 'models/gemini-2.5-flash-lite'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7

// Mapping des anciens noms de modèles vers les noms corrects avec préfixe
const MODEL_ALIASES: Record<string, string> = {
  // Tout redirige vers gemini-2.5-flash-lite (le moins cher)
  'gemini-1.5-flash': 'models/gemini-2.5-flash-lite',
  'gemini-1.5-flash-latest': 'models/gemini-2.5-flash-lite',
  'gemini-2.5-flash': 'models/gemini-2.5-flash-lite',
  'gemini-2.5-flash-lite': 'models/gemini-2.5-flash-lite',
  'gemini-2.0-flash': 'models/gemini-2.5-flash-lite', // 2.0 a quota 0
  'gemini-2.0-flash-exp': 'models/gemini-2.5-flash-lite',
  'gemini-1.5-pro': 'models/gemini-2.5-flash-lite',
  'gemini-1.5-pro-latest': 'models/gemini-2.5-flash-lite',
}

function resolveModelName(model: string): string {
  // Si déjà avec préfixe, retourner tel quel
  if (model.startsWith('models/')) return model
  // Sinon, chercher dans les alias ou ajouter le préfixe
  return MODEL_ALIASES[model] || `models/${model}`
}

// Créer le client Google AI
function createGoogleClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not configured')
  }
  return createGoogleGenerativeAI({ apiKey })
}

export interface GeminiStreamOptions {
  messages: ModelMessage[]
  systemPrompt: string
  settings?: Partial<ClaraSettings>
  tools?: ToolSet
  onToolCall?: (toolName: string, args: unknown) => void
}

export interface GeminiGenerateOptions {
  messages: ModelMessage[]
  systemPrompt: string
  settings?: Partial<ClaraSettings>
  tools?: ToolSet
}

/**
 * Stream une réponse de Gemini (pour l'effet human-like)
 * Retourne un stream qui peut être consommé par le frontend
 */
export async function streamGeminiResponse(options: GeminiStreamOptions) {
  const { messages, systemPrompt, settings, tools, onToolCall } = options

  const google = createGoogleClient()
  const rawModel = settings?.model || DEFAULT_MODEL
  const model = resolveModelName(rawModel)
  const maxOutputTokens = settings?.max_tokens || DEFAULT_MAX_TOKENS
  const temperature = settings?.temperature || DEFAULT_TEMPERATURE

  console.log('[Gemini] Using model:', model, '(from:', rawModel, ')')

  const result = streamText({
    model: google(model),
    system: systemPrompt,
    messages,
    maxOutputTokens,
    temperature,
    tools,
    onStepFinish: (step) => {
      // Log les appels d'outils pour le debugging
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
 * Utile pour les opérations en background ou les tests
 */
export async function generateGeminiResponse(options: GeminiGenerateOptions): Promise<{
  text: string
  toolCalls?: Array<{ toolName: string; args: unknown; result: unknown }>
  usage?: { promptTokens: number; completionTokens: number }
}> {
  const { messages, systemPrompt, settings, tools } = options

  const google = createGoogleClient()
  const rawModel = settings?.model || DEFAULT_MODEL
  const model = resolveModelName(rawModel)
  const maxOutputTokens = settings?.max_tokens || DEFAULT_MAX_TOKENS
  const temperature = settings?.temperature || DEFAULT_TEMPERATURE

  const result = await generateText({
    model: google(model),
    system: systemPrompt,
    messages,
    maxOutputTokens,
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
 * Vérifie que l'API Gemini est configurée et accessible
 */
export async function testGeminiConnection(): Promise<{ success: boolean; error?: string; model?: string }> {
  try {
    const google = createGoogleClient()
    const model = resolveModelName(DEFAULT_MODEL)

    const result = await generateText({
      model: google(model),
      prompt: 'Say "OK" if you can hear me.',
      maxOutputTokens: 10,
    })

    return { success: result.text.toLowerCase().includes('ok'), model }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      model: resolveModelName(DEFAULT_MODEL),
    }
  }
}

/**
 * Convertit les messages de notre format DB vers le format Vercel AI
 * Filtre les messages vides qui causent des erreurs avec certains providers (Anthropic)
 */
export function convertToAIMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): ModelMessage[] {
  return messages
    .filter(msg => msg.content && msg.content.trim().length > 0) // Filtrer les messages vides
    .map(msg => ({
      role: msg.role,
      content: msg.content.trim(),
    }))
}

/**
 * Estime le nombre de tokens dans un texte (approximation)
 * Utile pour le rate limiting et la gestion du contexte
 */
export function estimateTokens(text: string): number {
  // Approximation: ~4 caractères par token en moyenne
  return Math.ceil(text.length / 4)
}

/**
 * Tronque l'historique pour respecter la limite de tokens
 */
export function truncateHistory(
  messages: ModelMessage[],
  maxOutputTokens: number = 30000
): ModelMessage[] {
  let totalTokens = 0
  const result: ModelMessage[] = []

  // On garde les messages les plus récents
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    const tokens = estimateTokens(content)

    if (totalTokens + tokens > maxOutputTokens) {
      break
    }

    totalTokens += tokens
    result.unshift(msg)
  }

  return result
}
