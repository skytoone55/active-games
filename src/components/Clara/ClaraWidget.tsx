'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send, Loader2, ChevronDown, Plus, Minus, RefreshCw, ExternalLink } from 'lucide-react'
import { useClaraChat, ChatMessage } from '@/hooks/useClaraChat'

interface ClaraWidgetProps {
  branchId?: string
  locale?: 'he' | 'en' | 'fr'
  primaryColor?: string
}

// Tailles de police disponibles (en pixels)
const FONT_SIZES = [14, 16, 18, 20, 22] as const
type FontSize = typeof FONT_SIZES[number]
const DEFAULT_FONT_SIZE: FontSize = 16
const FONT_SIZE_STORAGE_KEY = 'clara_font_size'

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

  const key = 'clara_session_id'
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

  const key = 'clara_session_id'
  const newSessionId = generateNewSessionId()
  localStorage.setItem(key, newSessionId)
  return newSessionId
}

// Messages de bienvenue par langue
const WELCOME_MESSAGES: Record<string, string> = {
  he: 'שלום! 👋 אני קלרה, העוזרת הווירטואלית של Active Games. איך אני יכולה לעזור לך?',
  en: 'Hello! 👋 I\'m Clara, the virtual assistant of Active Games. How can I help you?',
  fr: 'Bonjour ! 👋 Je suis Clara, l\'assistante virtuelle d\'Active Games. Comment puis-je vous aider ?',
}

// Quick replies par langue
const QUICK_REPLIES: Record<string, string[]> = {
  he: [
    'מה שעות הפעילות?',
    'כמה עולה משחק?',
    'אני רוצה להזמין',
  ],
  en: [
    'What are the opening hours?',
    'How much does a game cost?',
    'I want to book',
  ],
  fr: [
    'Quels sont les horaires ?',
    'Combien coûte une partie ?',
    'Je veux réserver',
  ],
}

// Placeholder par langue
const PLACEHOLDERS: Record<string, string> = {
  he: 'הקלד הודעה...',
  en: 'Type a message...',
  fr: 'Tapez un message...',
}

// Couleur principale - violet/bleu comme le logo
const CLARA_PRIMARY = '#6366F1' // Indigo-500

// Composant pour rendre le contenu du message avec des liens de réservation cliquables
interface MessageContentProps {
  content: string
  isStreaming?: boolean
  fontSize: number
  primaryColor: string
  locale: string
}

function MessageContent({ content, isStreaming, fontSize, primaryColor, locale }: MessageContentProps) {
  const router = useRouter()

  // Pré-traiter le contenu pour normaliser les liens de réservation
  let normalizedContent = content

  // Convertir les URLs absolues de réservation en URLs relatives
  normalizedContent = normalizedContent.replace(
    /https?:\/\/[^\s\/\)]+\/reservation\?([^\s\n\)]+)/gi,
    '/reservation?$1'
  )

  // Supprimer le format markdown [texte](url) et garder juste l'URL
  // Ex: [Réserver maintenant](/reservation?...) → /reservation?...
  normalizedContent = normalizedContent.replace(
    /\[([^\]]*)\]\((\/reservation\?[^\)]+)\)/gi,
    '$2'
  )

  // Supprimer les textes résiduels du style "Click here to complete booking" ou similaires
  // (avec variantes: retours à la ligne, espaces multiples, etc.)
  normalizedContent = normalizedContent.replace(
    /\s*Click\s+here\s+to\s+complete\s+booking\s*/gi,
    ' '
  )
  normalizedContent = normalizedContent.replace(
    /\s*Cliquez\s+ici\s+pour\s+finaliser\s*/gi,
    ' '
  )
  normalizedContent = normalizedContent.replace(
    /\s*לחץ\s+כאן\s+לסיום\s+ההזמנה\s*/gi,
    ' '
  )
  // Supprimer aussi "Complete booking" seul
  normalizedContent = normalizedContent.replace(
    /\s*Complete\s+booking\s*/gi,
    ' '
  )

  // Détecter les liens de réservation (format: /reservation?...)
  const bookingLinkRegex = /(\/reservation\?[^\s\n\)]+)/g

  // Si pas de lien de réservation, afficher le contenu normalement
  if (!bookingLinkRegex.test(normalizedContent)) {
    return (
      <>
        {normalizedContent}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
        )}
      </>
    )
  }

  // Réinitialiser le regex car .test() a avancé le curseur
  const splitRegex = /(\/reservation\?[^\s\n\)]+)/g

  // Séparer le texte et les liens
  const parts = normalizedContent.split(splitRegex)

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

        // Sinon, afficher le texte normalement (en nettoyant les 👉 et lignes vides)
        const cleanedPart = part.replace(/👉\s*/g, '').trim()
        if (!cleanedPart) return null
        return <span key={index}>{cleanedPart}</span>
      })}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
      )}
    </>
  )
}

export function ClaraWidget({
  branchId,
  locale = 'he',
  primaryColor = CLARA_PRIMARY
}: ClaraWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE)

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

  const { messages, isLoading, sendMessage, resetChat } = useClaraChat({
    context: 'public',
    sessionId,
    branchId,
    locale,
  })

  // Direction RTL pour l'hébreu
  const isRTL = locale === 'he'

  // Auto-scroll vers le bas
  useEffect(() => {
    if (isOpen && chatContainerRef.current) {
      // Utiliser requestAnimationFrame pour ne pas bloquer le thread principal
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

    // Envoyer au LLM - c'est tout !
    sendMessage(userInput)
  }, [input, isLoading, sendMessage])

  const handleQuickReply = useCallback((reply: string) => {
    sendMessage(reply)
    setShowQuickReplies(false)
  }, [sendMessage])

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
      {/* Bouton flottant - toujours à droite */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{ backgroundColor: primaryColor }}
          aria-label="Open chat"
        >
          {/* Icône de chat style bulle */}
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            <path d="M7 9h10v2H7zm0-3h10v2H7z" opacity="0.5"/>
          </svg>
        </button>
      )}

      {/* Widget de chat - toujours à droite */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 w-[480px] max-w-[calc(100vw-32px)] h-[750px] max-h-[calc(100vh-40px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header - violet foncé */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              {/* Logo Clara */}
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Clara</h3>
                <p className="text-xs text-white/90">
                  Active Laser • 03-5512277
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
            {/* Message de bienvenue */}
            {messages.length === 0 && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white shadow-sm border border-gray-100">
                  <p className="text-gray-800" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>{WELCOME_MESSAGES[locale]}</p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => {
              // Ne pas afficher les messages assistant vides (sauf si en streaming)
              if (msg.role === 'assistant' && !msg.content && !msg.isStreaming) {
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
                    <p className="whitespace-pre-wrap" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
                      <MessageContent
                        content={msg.content}
                        isStreaming={msg.isStreaming}
                        fontSize={fontSize}
                        primaryColor={primaryColor}
                        locale={locale}
                      />
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Quick replies */}
            {showQuickReplies && messages.length === 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {QUICK_REPLIES[locale].map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(reply)}
                    className="px-3 py-2 rounded-full border-2 transition-colors hover:text-white"
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                      fontSize: `${fontSize}px`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = primaryColor
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = primaryColor
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Indicateur de chargement */}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className={`flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
                <div className="bg-white shadow-sm border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: primaryColor }} />
                  <span className="text-gray-500" style={{ fontSize: `${fontSize}px` }}>
                    {locale === 'he' ? 'קלרה חושבת...' : locale === 'fr' ? 'Clara réfléchit...' : 'Clara is thinking...'}
                  </span>
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
                className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 text-gray-900 placeholder-gray-400 bg-white overflow-hidden"
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
