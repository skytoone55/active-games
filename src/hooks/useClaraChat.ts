/**
 * Hook pour le chat Clara avec streaming
 * Utilisé par le composant CRM et le widget public
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  metadata?: Record<string, unknown>
}

interface UseClaraChatOptions {
  context: 'crm' | 'public'
  sessionId?: string // Pour le contexte public
  branchId?: string
  locale?: string
  authToken?: string // Pour le contexte CRM
  onError?: (error: string) => void
}

interface UseClaraChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  conversationId: string | null
  sendMessage: (content: string) => Promise<void>
  resetChat: () => void
  rateLimitRemaining: number | null
}

// Clés localStorage pour persister l'historique du chat
const STORAGE_KEY_MESSAGES = 'clara_chat_messages'
const STORAGE_KEY_CONVERSATION_ID = 'clara_conversation_id'
const MAX_STORED_MESSAGES = 50 // Limite pour éviter de surcharger localStorage

// Simple détection de langue basée sur le texte
function detectLanguage(text: string): 'he' | 'fr' | 'en' {
  // Hébreu: caractères hébreux
  if (/[\u0590-\u05FF]/.test(text)) return 'he'
  // Français: mots français courants ou accents français
  if (/\b(bonjour|salut|merci|oui|non|je|tu|vous|nous|avoir|être|faire|comment|quand|pourquoi|combien)\b/i.test(text) ||
      /[àâäéèêëïîôùûüÿç]/i.test(text)) return 'fr'
  // Défaut: anglais
  return 'en'
}

export function useClaraChat(options: UseClaraChatOptions): UseClaraChatReturn {
  const { context, sessionId, branchId, locale = 'he', authToken, onError } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const messageIdCounter = useRef(0)

  // Restaurer l'historique depuis localStorage au montage (uniquement pour le contexte public)
  useEffect(() => {
    if (context === 'public' && typeof window !== 'undefined') {
      try {
        const storedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES)
        const storedConversationId = localStorage.getItem(STORAGE_KEY_CONVERSATION_ID)

        if (storedMessages) {
          const parsed = JSON.parse(storedMessages) as ChatMessage[]
          // Filtrer les messages en streaming (incomplets)
          const validMessages = parsed.filter(msg => !msg.isStreaming)
          if (validMessages.length > 0) {
            setMessages(validMessages)
            // Mettre à jour le compteur d'ID pour éviter les collisions
            messageIdCounter.current = validMessages.length
          }
        }

        if (storedConversationId) {
          setConversationId(storedConversationId)
        }
      } catch (e) {
        console.warn('[Clara] Failed to restore chat history:', e)
      }
    }
    setIsInitialized(true)
  }, [context])

  // Sauvegarder les messages dans localStorage à chaque changement (uniquement pour le contexte public)
  useEffect(() => {
    if (context === 'public' && isInitialized && typeof window !== 'undefined') {
      try {
        // Ne sauvegarder que les messages non en streaming et limiter le nombre
        const messagesToStore = messages
          .filter(msg => !msg.isStreaming)
          .slice(-MAX_STORED_MESSAGES)

        if (messagesToStore.length > 0) {
          localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messagesToStore))
        }
      } catch (e) {
        console.warn('[Clara] Failed to save chat history:', e)
      }
    }
  }, [messages, context, isInitialized])

  // Sauvegarder le conversationId dans localStorage
  useEffect(() => {
    if (context === 'public' && conversationId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CONVERSATION_ID, conversationId)
      } catch (e) {
        console.warn('[Clara] Failed to save conversation ID:', e)
      }
    }
  }, [conversationId, context])

  const generateId = () => {
    messageIdCounter.current += 1
    return `msg-${Date.now()}-${messageIdCounter.current}`
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    // Détecter la langue du message pour adapter les réponses d'erreur
    const detectedLocale = detectLanguage(content.trim())

    // Annuler une requête en cours si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
    }

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setIsLoading(true)

    // Utiliser la langue détectée pour les messages d'erreur
    const effectiveLocale = detectedLocale

    try {
      const endpoint = context === 'crm' ? '/api/clara/chat' : '/api/public/clara'

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (context === 'crm' && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Envoyer la locale détectée à l'API pour qu'elle puisse adapter la conversation
      const body = context === 'crm'
        ? { conversationId, message: content.trim(), branchId }
        : { sessionId, message: content.trim(), branchId, locale: detectedLocale }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Lire le stream SSE
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Garder la ligne incomplète

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.substring(6))

            switch (data.type) {
              case 'conversation':
              case 'init':
                setConversationId(data.id || data.conversationId)
                if (data.remaining !== undefined) {
                  setRateLimitRemaining(data.remaining)
                }
                break

              case 'text':
                // Mettre à jour le message assistant avec le nouveau texte
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ))
                break

              case 'done':
                // Marquer le streaming comme terminé
                // Si le message est vide, afficher un message d'erreur courtois avec numéro de téléphone
                setMessages(prev => prev.map(msg => {
                  if (msg.id === assistantMessage.id) {
                    const hasContent = msg.content.trim().length > 0
                    return {
                      ...msg,
                      content: hasContent ? msg.content : (
                        effectiveLocale === 'he'
                          ? 'מצטערת, לא הצלחתי לעבד את הבקשה שלך. צוות Active Laser ישמח לעזור לך בטלפון: 03-5512277'
                          : effectiveLocale === 'fr'
                            ? 'Je suis désolée, je n\'ai pas pu traiter votre demande. L\'équipe Active Laser sera ravie de vous aider par téléphone : 03-5512277'
                            : 'I\'m sorry, I couldn\'t process your request. The Active Laser team will be happy to help you by phone: 03-5512277'
                      ),
                      isStreaming: false,
                    }
                  }
                  return msg
                }))
                break

              case 'error':
                throw new Error(data.message || 'Stream error')
            }
          } catch (e) {
            // Ignorer les erreurs de parsing pour les lignes malformées
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

    } catch (error) {
      // Ne pas traiter les erreurs d'annulation
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'An error occurred'

      // Mettre à jour le message assistant avec l'erreur et le numéro de téléphone
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? {
            ...msg,
            content: context === 'crm'
              ? `Une erreur s'est produite. Veuillez réessayer ou contacter le support.`
              : effectiveLocale === 'he'
                ? `מצטערת, לא הצלחתי לעבד את הבקשה שלך. צוות Active Laser ישמח לעזור לך בטלפון: 03-5512277`
                : effectiveLocale === 'fr'
                  ? `Je suis désolée, je n'ai pas pu traiter votre demande. L'équipe Active Laser sera ravie de vous aider par téléphone : 03-5512277`
                  : `I'm sorry, I couldn't process your request. The Active Laser team will be happy to help you by phone: 03-5512277`,
            isStreaming: false,
          }
          : msg
      ))

      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [context, conversationId, sessionId, branchId, locale, authToken, isLoading, onError])

  const resetChat = useCallback(() => {
    // Annuler toute requête en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages([])
    setConversationId(null)
    setIsLoading(false)

    // Effacer aussi le localStorage (pour le contexte public)
    if (context === 'public' && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_MESSAGES)
        localStorage.removeItem(STORAGE_KEY_CONVERSATION_ID)
      } catch (e) {
        console.warn('[Clara] Failed to clear chat history:', e)
      }
    }
  }, [context])

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    resetChat,
    rateLimitRemaining,
  }
}
