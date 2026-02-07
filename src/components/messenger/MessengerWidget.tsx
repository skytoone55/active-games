'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send, ChevronDown, Plus, Minus, RefreshCw, ExternalLink } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  choices?: Array<{ id: string; label: string; value: string }>
}

interface MessengerWidgetProps {
  branchId?: string
  locale?: 'he' | 'en' | 'fr'
  primaryColor?: string
}

// Tailles de police disponibles (en pixels)
const FONT_SIZES = [14, 16, 18, 20, 22] as const
type FontSize = typeof FONT_SIZES[number]
const DEFAULT_FONT_SIZE: FontSize = 16
const FONT_SIZE_STORAGE_KEY = 'messenger_font_size'

// Récupérer la taille de police sauvegardée
function getSavedFontSize(): FontSize {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE
  const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
  if (saved) {
    const size = parseInt(saved, 10) as FontSize
    if (FONT_SIZES.includes(size)) return size
  }
  return DEFAULT_FONT_SIZE
}

// Générer un ID de session unique
function generateNewSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  const key = 'messenger_session_id'
  let sessionId = localStorage.getItem(key)

  if (!sessionId) {
    sessionId = generateNewSessionId()
    localStorage.setItem(key, sessionId)
  }

  return sessionId
}

// Crée et sauvegarde un nouveau sessionId (pour nouvelle conversation)
function createNewSessionId(): string {
  if (typeof window === 'undefined') return ''

  const key = 'messenger_session_id'
  const newSessionId = generateNewSessionId()
  localStorage.setItem(key, newSessionId)
  return newSessionId
}

// Placeholder par langue
const PLACEHOLDERS: Record<string, string> = {
  he: 'הקלד הודעה...',
  en: 'Type a message...',
  fr: 'Tapez un message...',
}

// Couleur principale - orange/rouge comme messenger
const MESSENGER_PRIMARY = '#FF6B35'

// Composant pour rendre le contenu du message avec des liens de réservation cliquables
interface MessageContentProps {
  content: string
  isStreaming?: boolean
  fontSize: number
  primaryColor: string
  locale: string
  onBookingLinkClick?: () => void
}

function MessageContent({ content, isStreaming, fontSize, primaryColor, locale, onBookingLinkClick }: MessageContentProps) {
  const router = useRouter()

  // Détecter les liens de réservation (format: /reservation?... OU [BTN:texte]URL)
  const bookingLinkRegex = /(\/reservation\?[^\s\n\)]+|\[BTN:[^\]]+\]https?:\/\/[^\s]+)/g

  // Si pas de lien de réservation, afficher le contenu normalement
  if (!bookingLinkRegex.test(content)) {
    return (
      <>
        {content}
        {isStreaming && (
          <span className="inline-flex items-center gap-0.5 ml-1">
            <span
              className="w-1 h-1 rounded-full animate-bounce"
              style={{
                backgroundColor: primaryColor,
                animationDelay: '0ms',
                animationDuration: '1s'
              }}
            />
            <span
              className="w-1 h-1 rounded-full animate-bounce"
              style={{
                backgroundColor: primaryColor,
                animationDelay: '150ms',
                animationDuration: '1s'
              }}
            />
            <span
              className="w-1 h-1 rounded-full animate-bounce"
              style={{
                backgroundColor: primaryColor,
                animationDelay: '300ms',
                animationDuration: '1s'
              }}
            />
          </span>
        )}
      </>
    )
  }

  // Réinitialiser le regex car .test() a avancé le curseur
  const splitRegex = /(\/reservation\?[^\s\n\)]+|\[BTN:[^\]]+\]https?:\/\/[^\s]+)/g

  // Séparer le texte et les liens
  const parts = content.split(splitRegex)

  // Texte du bouton selon la langue
  const buttonText = {
    he: 'לחץ כאן לסיום ההזמנה',
    fr: 'Cliquez ici pour finaliser',
    en: 'Click here to complete booking'
  }[locale] || 'Click here to complete booking'

  return (
    <>
      {parts.map((part, index) => {
        // Vérifier si cette partie est un lien de réservation
        if (part.startsWith('/reservation?')) {
          return (
            <button
              key={index}
              onClick={() => {
                // Naviguer vers la page de réservation dans le même onglet
                router.push(part)
                // Fermer le chat après 2 secondes pour laisser place à la page de réservation
                if (onBookingLinkClick) {
                  setTimeout(() => {
                    onBookingLinkClick()
                  }, 2000)
                }
              }}
              className="block w-full mt-3 mb-2 px-4 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{
                backgroundColor: primaryColor,
                fontSize: `${fontSize}px`
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                {buttonText}
              </span>
            </button>
          )
        }

        // Vérifier si cette partie est un lien avec texte personnalisé [BTN:texte]URL
        const btnMatch = part.match(/^\[BTN:([^\]]+)\](https?:\/\/.+)$/)
        if (btnMatch) {
          const [, customText, url] = btnMatch
          return (
            <button
              key={index}
              onClick={() => {
                // Naviguer vers l'URL
                if (url.includes('/reservation?')) {
                  router.push(url)
                  // Fermer le chat après 2 secondes
                  if (onBookingLinkClick) {
                    setTimeout(() => {
                      onBookingLinkClick()
                    }, 2000)
                  }
                } else {
                  window.open(url, '_blank')
                }
              }}
              className="block w-full mt-3 mb-2 px-4 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{
                backgroundColor: primaryColor,
                fontSize: `${fontSize}px`
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                {customText}
              </span>
            </button>
          )
        }

        // Sinon, afficher le texte normalement
        const cleanedPart = part.trim()
        if (!cleanedPart) return null
        return <span key={index}>{cleanedPart}</span>
      })}
      {isStreaming && (
        <span className="inline-flex items-center gap-0.5 ml-1">
          <span
            className="w-1 h-1 rounded-full animate-bounce"
            style={{
              backgroundColor: primaryColor,
              animationDelay: '0ms',
              animationDuration: '1s'
            }}
          />
          <span
            className="w-1 h-1 rounded-full animate-bounce"
            style={{
              backgroundColor: primaryColor,
              animationDelay: '150ms',
              animationDuration: '1s'
            }}
          />
          <span
            className="w-1 h-1 rounded-full animate-bounce"
            style={{
              backgroundColor: primaryColor,
              animationDelay: '300ms',
              animationDuration: '1s'
            }}
          />
        </span>
      )}
    </>
  )
}

export function MessengerWidget({
  branchId,
  locale = 'he',
  primaryColor = MESSENGER_PRIMARY
}: MessengerWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialiser le session ID et la taille de police côté client
  useEffect(() => {
    setSessionId(getOrCreateSessionId())
    setFontSize(getSavedFontSize())
  }, [])

  // Fonction pour changer la taille de police
  const changeFontSize = useCallback((direction: 'increase' | 'decrease') => {
    setFontSize(current => {
      const currentIndex = FONT_SIZES.indexOf(current)
      let newIndex: number
      if (direction === 'increase') {
        newIndex = Math.min(currentIndex + 1, FONT_SIZES.length - 1)
      } else {
        newIndex = Math.max(currentIndex - 1, 0)
      }
      const newSize = FONT_SIZES[newIndex]
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(newSize))
      return newSize
    })
  }, [])

  // Démarrer la conversation avec le workflow
  const startConversation = useCallback(async () => {
    console.log('[Messenger] startConversation called', { conversationId, sessionId })
    if (conversationId) {
      console.log('[Messenger] Conversation already exists, skipping')
      return
    }

    setIsLoading(true)
    try {
      console.log('[Messenger] Fetching /api/messenger/start...')
      const res = await fetch('/api/messenger/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          branchId,
          contactId: null,
          locale
        })
      })

      const data = await res.json()
      console.log('[Messenger] API response:', data)
      if (data.success) {
        setConversationId(data.conversationId)
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: data.firstMessage,
            isStreaming: false,
            choices: data.choices
          }
        ])
        console.log('[Messenger] First message set:', data.firstMessage)
      } else {
        console.error('[Messenger] API returned error:', data.error)
      }
    } catch (error) {
      console.error('[Messenger] Error starting conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, branchId, conversationId, locale])

  // Envoyer un message
  const sendMessage = useCallback(async (userMessage: string) => {
    if (!conversationId || isLoading) return

    // Ajouter le message utilisateur
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userMessage,
      isStreaming: false
    }
    setMessages((prev) => [...prev, userMsg])

    setIsLoading(true)
    try {
      const res = await fetch('/api/messenger/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: userMessage
        })
      })

      const data = await res.json()
      // Afficher le message ou les choix (au moins l'un des deux doit exister)
      if (data.message || data.choices) {
        const assistantMsg: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: data.message || '',
          isStreaming: false,
          choices: data.choices
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Si autoExecute est true (message_text_auto), continuer automatiquement
        if (data.autoExecute) {
          // Capturer conversationId dans une variable locale
          const currentConversationId = conversationId
          const delay = data.moduleType === 'message_text_auto' ? 0 : 500
          setTimeout(async () => {
            try {
              const nextRes = await fetch('/api/messenger/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  conversationId: currentConversationId,
                  message: ''
                })
              })

              const nextData = await nextRes.json()
              console.log('[Messenger] Next step response:', nextData)
              if (nextData.message || nextData.choices) {
                const nextMsg: ChatMessage = {
                  id: `assistant_${Date.now()}`,
                  role: 'assistant',
                  content: nextData.message || '',
                  isStreaming: false,
                  choices: nextData.choices
                }
                setMessages((prev) => [...prev, nextMsg])
              }
            } catch (error) {
              console.error('[Messenger] Error auto-executing next step:', error)
            } finally {
              setIsLoading(false)
            }
          }, delay)
          return // Ne pas mettre isLoading à false tout de suite
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, isLoading])

  // Réinitialiser la conversation
  const resetChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setShowQuickReplies(true)
  }, [])

  // Démarrer la conversation quand le widget s'ouvre
  useEffect(() => {
    console.log('[Messenger] useEffect triggered', { isOpen, sessionId, conversationId })
    if (isOpen && sessionId && !conversationId) {
      console.log('[Messenger] Starting conversation...')
      startConversation()
    }
  }, [isOpen, sessionId, conversationId, startConversation])

  // Direction RTL pour l'hébreu
  const isRTL = locale === 'he'

  // Auto-scroll vers le bas
  useEffect(() => {
    if (isOpen && chatContainerRef.current) {
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        }
      })
    }
  }, [messages, isOpen])

  // Focus sur l'input quand on ouvre
  useEffect(() => {
    if (isOpen && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isLoading])

  // Cacher les quick replies après le premier message
  useEffect(() => {
    if (messages.length > 0) {
      setShowQuickReplies(false)
    }
  }, [messages.length])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return

    const userInput = input.trim()
    setInput('')

    sendMessage(userInput)
  }, [input, isLoading, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize du textarea (max 4 lignes)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInput(textarea.value)

    // Auto-resize: reset puis recalculer
    textarea.style.height = 'auto'
    const lineHeight = fontSize * 1.5
    const maxHeight = lineHeight * 4
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  }, [fontSize])

  // Démarrer une nouvelle conversation
  const handleNewConversation = useCallback(() => {
    const newSessionId = createNewSessionId()
    setSessionId(newSessionId)
    resetChat()
    setShowQuickReplies(true)
    setInput('')
  }, [resetChat])

  return (
    <>
      {/* Bouton flottant - toujours à gauche */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{ backgroundColor: primaryColor }}
          aria-label="Open messenger"
        >
          {/* Icône de chat style messenger */}
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            <path d="M7 9h10v2H7zm0-3h10v2H7z" opacity="0.5"/>
          </svg>
        </button>
      )}

      {/* Widget de chat - toujours à gauche */}
      {isOpen && (
        <div
          className="fixed bottom-4 left-4 z-50 w-[480px] max-w-[calc(100vw-32px)] h-[750px] max-h-[calc(100vh-40px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              {/* Logo Messenger */}
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Messenger</h3>
                <p className="text-xs text-white/90">
                  Active Games • 03-5512277
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Boutons zoom */}
              <button
                onClick={() => changeFontSize('decrease')}
                disabled={fontSize === FONT_SIZES[0]}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40"
                aria-label="Decrease font size"
                title={locale === 'he' ? 'הקטן טקסט' : locale === 'fr' ? 'Réduire le texte' : 'Smaller text'}
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
              <span className="text-xs text-white/80 min-w-[24px] text-center">{fontSize}</span>
              <button
                onClick={() => changeFontSize('increase')}
                disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40"
                aria-label="Increase font size"
                title={locale === 'he' ? 'הגדל טקסט' : locale === 'fr' ? 'Agrandir le texte' : 'Larger text'}
              >
                <Plus className="w-4 h-4 text-white" />
              </button>

              {/* Séparateur */}
              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Bouton nouvelle conversation */}
              <button
                onClick={handleNewConversation}
                disabled={messages.length === 0 || isLoading}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40 text-xs font-medium text-white"
                aria-label="New conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{locale === 'he' ? 'שיחה חדשה' : locale === 'fr' ? 'Nouveau' : 'New'}</span>
              </button>

              {/* Séparateur */}
              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Bouton minimiser */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Zone de chat */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {/* Messages */}
            {messages.map((msg) => {
              if (msg.role === 'assistant' && !msg.content && !msg.isStreaming && (!msg.choices || msg.choices.length === 0)) {
                return null
              }
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'text-white'
                        : 'bg-white shadow-sm border border-gray-100 text-gray-800'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                  >
                    {msg.content && (
                      <p className="whitespace-pre-wrap" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
                        <MessageContent
                          content={msg.content}
                          isStreaming={msg.isStreaming}
                          fontSize={fontSize}
                          primaryColor={primaryColor}
                          locale={locale}
                          onBookingLinkClick={() => setIsOpen(false)}
                        />
                      </p>
                    )}
                    {/* Choix multiples sous forme de boutons */}
                    {msg.choices && msg.choices.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.choices.map((choice) => (
                          <button
                            key={choice.id}
                            onClick={() => {
                              sendMessage(choice.label)
                            }}
                            className="px-4 py-2 rounded-lg transition-colors hover:opacity-90 flex-shrink-0"
                            style={{
                              backgroundColor: primaryColor,
                              color: 'white',
                              fontSize: `${fontSize}px`
                            }}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Indicateur de chargement - 3 points animés */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: primaryColor,
                      animationDelay: '0ms',
                      animationDuration: '1s'
                    }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: primaryColor,
                      animationDelay: '150ms',
                      animationDuration: '1s'
                    }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      backgroundColor: primaryColor,
                      animationDelay: '300ms',
                      animationDuration: '1s'
                    }}
                  />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Zone de saisie */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDERS[locale]}
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 text-gray-900 placeholder-gray-400 bg-white overflow-hidden"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 p-3 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primaryColor }}
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
