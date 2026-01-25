/**
 * API Clara Chat - PUBLIC (visiteurs du site)
 * Endpoint pour le widget chat sur le site public
 *
 * POST /api/public/clara
 * - Streaming SSE pour les réponses en temps réel
 * - Rate limiting par IP/session
 * - Pas d'authentification requise
 */

import { NextRequest } from 'next/server'
import {
  getClaraSettings,
  getOrCreatePublicConversation,
  getPublicMessages,
  addPublicMessage,
  checkRateLimit,
  getChatInitData,
  getPublicSystemPrompt,
} from '@/lib/clara/service'
import { streamLLMResponse, convertToAIMessages, truncateHistory, createLLMOptionsFromSettings } from '@/lib/clara/llm-provider'
import { publicTools } from '@/lib/clara/tools'

/**
 * Récupère l'IP du client
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return 'unknown'
}

/**
 * POST /api/public/clara
 * Envoie un message et reçoit la réponse en streaming
 */
export async function POST(request: NextRequest) {
  try {
    // Parser le body
    const body = await request.json()
    const { sessionId, message, branchId, locale } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Limite de longueur du message
    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Message too long (max 1000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Vérifier les settings Clara
    const settings = await getClaraSettings()
    if (!settings.enabled || !settings.public_chat.enabled) {
      return new Response(JSON.stringify({ error: 'Chat is currently unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Rate limiting
    const clientIp = getClientIp(request)
    const identifier = `${clientIp}:${sessionId}`
    const rateLimit = await checkRateLimit(identifier)

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Too many requests. Please wait a moment.',
        retryAfter: 60,
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      })
    }

    // Récupérer ou créer la conversation
    const conversation = await getOrCreatePublicConversation(sessionId, branchId, {
      ip: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
      locale: locale || 'he',
    })

    // Sauvegarder le message utilisateur
    await addPublicMessage(conversation.id, 'user', message)

    // Récupérer l'historique complet (toute la session)
    const messages = await getPublicMessages(conversation.id, 50)
    const aiMessages = convertToAIMessages(messages)
    const truncatedMessages = truncateHistory(aiMessages, 50000) // Limite de sécurité très haute

    // Récupérer le prompt système (personnalisé ou par défaut)
    const systemPrompt = await getPublicSystemPrompt()

    // Préparer les options LLM depuis les settings
    const llmOptions = createLLMOptionsFromSettings(settings)

    // Log pour debug - DÉTAILLÉ
    console.log('[Clara Public] ====== DEBUG START ======')
    console.log('[Clara Public] Provider:', llmOptions.provider)
    console.log('[Clara Public] Model:', llmOptions.model)
    console.log('[Clara Public] Temperature:', llmOptions.temperature)
    console.log('[Clara Public] System Prompt (first 500 chars):', systemPrompt.substring(0, 500))
    console.log('[Clara Public] Message count:', truncatedMessages.length)
    console.log('[Clara Public] Messages:', JSON.stringify(truncatedMessages, null, 2))
    console.log('[Clara Public] ====== DEBUG END ======')

    // Streamer la réponse
    const result = await streamLLMResponse({
      messages: truncatedMessages,
      systemPrompt,
      provider: llmOptions.provider,
      model: llmOptions.model,
      maxTokens: llmOptions.maxTokens,
      temperature: llmOptions.temperature,
      tools: publicTools,
    })

    // Créer un ReadableStream pour le SSE
    const encoder = new TextEncoder()
    let fullResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Envoyer l'ID de conversation en premier
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'init',
            conversationId: conversation.id,
            remaining: rateLimit.remaining,
          })}\n\n`))

          // Streamer le texte avec fullStream pour capturer le texte après les tool calls
          let chunkCount = 0
          for await (const part of result.fullStream) {
            // Le type est 'text-delta' et la propriété est 'text' (confirmé par les logs)
            if (part.type === 'text-delta') {
              const textContent = (part as { text?: string }).text
              if (textContent) {
                fullResponse += textContent
                chunkCount++
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`))
              }
            } else if (part.type === 'tool-call') {
              console.log('[Clara Public] Tool call:', (part as { toolName?: string }).toolName)
            } else if (part.type === 'tool-result') {
              console.log('[Clara Public] Tool result received')
            } else if (part.type === 'error') {
              console.error('[Clara Public] Stream error part:', part)
            }
          }

          console.log('[Clara Public] Stream completed:', {
            chunkCount,
            responseLength: fullResponse.length,
            preview: fullResponse.substring(0, 100)
          })

          // Sauvegarder la réponse complète (si non vide)
          if (fullResponse.trim()) {
            await addPublicMessage(conversation.id, 'assistant', fullResponse)
          } else {
            console.warn('[Clara Public] Empty response from LLM for message:', message)
          }

          // Envoyer le signal de fin
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('[Clara Public] Stream error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'An error occurred. Please try again.',
          })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })

  } catch (error) {
    console.error('[Clara Public] Error:', error)
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * GET /api/public/clara
 * Récupère les infos d'initialisation du chat ET l'historique si sessionId fourni
 */
export async function GET(request: NextRequest) {
  try {
    const locale = request.nextUrl.searchParams.get('locale') || 'he'
    const sessionId = request.nextUrl.searchParams.get('sessionId')

    const initData = await getChatInitData('public', locale)

    // Si sessionId fourni, récupérer l'historique existant
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let conversationId: string | null = null

    if (sessionId) {
      const conversation = await getOrCreatePublicConversation(sessionId)
      if (conversation) {
        conversationId = conversation.id
        const messages = await getPublicMessages(conversation.id, 50)
        history = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
      }
    }

    return new Response(JSON.stringify({
      ...initData,
      conversationId,
      history,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache', // Pas de cache car données personnalisées
      },
    })

  } catch (error) {
    console.error('[Clara Public] Init error:', error)
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
