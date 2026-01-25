/**
 * API Clara Chat - CRM (utilisateurs authentifiés)
 * Endpoint pour le chat IA dans le CRM
 *
 * POST /api/clara/chat
 * - Streaming SSE pour les réponses en temps réel
 * - Authentification requise (Bearer token ou cookie session)
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getClaraSettings,
  createCRMConversation,
  getCRMMessages,
  addCRMMessage,
  getChatInitData,
} from '@/lib/clara/service'
import { streamLLMResponse, convertToAIMessages, truncateHistory, createLLMOptionsFromSettings } from '@/lib/clara/llm-provider'
import { crmTools } from '@/lib/clara/tools'
import { CRM_SYSTEM_PROMPT } from '@/lib/clara/prompts'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Récupère l'utilisateur depuis le token Bearer ou les cookies de session
 */
async function getAuthenticatedUser(request: NextRequest) {
  // Essayer d'abord le header Authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) return user
  }

  // Sinon, essayer les cookies de session
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

/**
 * POST /api/clara/chat
 * Envoie un message et reçoit la réponse en streaming
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parser le body
    const body = await request.json()
    const { conversationId, message, branchId } = body

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Vérifier les settings Clara
    const settings = await getClaraSettings()
    if (!settings.enabled || !settings.crm_chat.enabled) {
      return new Response(JSON.stringify({ error: 'Clara is disabled' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Créer ou récupérer la conversation
    let convId = conversationId
    if (!convId) {
      const newConv = await createCRMConversation(user.id, branchId)
      if (!newConv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      convId = newConv.id
    }

    // Sauvegarder le message utilisateur
    await addCRMMessage(convId, 'user', message)

    // Récupérer l'historique
    const messages = await getCRMMessages(convId)
    const aiMessages = convertToAIMessages(messages)
    const truncatedMessages = truncateHistory(aiMessages)

    // Préparer les options LLM depuis les settings
    const llmOptions = createLLMOptionsFromSettings(settings)

    // Log pour debug
    console.log('[Clara CRM] Sending to LLM:', {
      messageCount: truncatedMessages.length,
      provider: llmOptions.provider,
      model: llmOptions.model,
    })

    // Streamer la réponse
    const result = await streamLLMResponse({
      messages: truncatedMessages,
      systemPrompt: CRM_SYSTEM_PROMPT,
      provider: llmOptions.provider,
      model: llmOptions.model,
      maxTokens: llmOptions.maxTokens,
      temperature: llmOptions.temperature,
      tools: crmTools,
    })

    // Créer un ReadableStream pour le SSE
    const encoder = new TextEncoder()
    let fullResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Envoyer l'ID de conversation en premier
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation', id: convId })}\n\n`))

          // Streamer le texte avec fullStream pour capturer le texte après les tool calls
          for await (const part of result.fullStream) {
            // Le type est 'text-delta' et la propriété est 'text' (pas textDelta)
            if (part.type === 'text-delta') {
              const textContent = (part as { text?: string }).text
              if (textContent) {
                fullResponse += textContent
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`))
              }
            } else if (part.type === 'tool-call') {
              console.log('[Clara CRM] Tool call:', (part as { toolName?: string }).toolName)
            } else if (part.type === 'tool-result') {
              console.log('[Clara CRM] Tool result received')
            }
          }

          // Sauvegarder la réponse complète
          if (fullResponse.trim()) {
            await addCRMMessage(convId, 'assistant', fullResponse)
          }

          // Envoyer le signal de fin
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('[Clara CRM] Stream error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('[Clara CRM] Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * GET /api/clara/chat
 * Récupère les infos d'initialisation du chat
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const initData = await getChatInitData('crm', 'fr')

    return new Response(JSON.stringify(initData), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Clara CRM] Init error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
