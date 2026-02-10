'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Send, Search, Phone, User, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useAuth } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'

interface WhatsAppConversation {
  id: string
  phone: string
  contact_name: string | null
  contact_id: string | null
  branch_id: string | null
  status: string
  last_message_at: string
  unread_count: number
  contacts?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
  } | null
}

interface WhatsAppMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string
  status: string
  created_at: string
  sent_by: string | null
}

export default function ChatPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedBranch } = useBranches()
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isDark = theme === 'dark'

  // Theme sync
  useEffect(() => {
    const saved = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
    const handler = () => {
      const t = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
      if (t) setTheme(t)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active' })
      if (selectedBranch?.id) params.set('branchId', selectedBranch.id)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/chat/conversations?${params}`)
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedBranch?.id, searchQuery])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Poll for new messages every 5 seconds
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchConversations()
      if (selectedConversation) {
        fetchMessages(selectedConversation.id, true)
      }
    }, 5000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation])

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Select a conversation
  const handleSelectConversation = (conv: WhatsAppConversation) => {
    setSelectedConversation(conv)
    fetchMessages(conv.id)
    // Update unread count locally
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
  }

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: newMessage.trim(),
          userId: user?.id || null,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setNewMessage('')
        fetchMessages(selectedConversation.id, true)
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Format phone display
  const formatPhone = (phone: string) => {
    if (phone.startsWith('972')) return '+' + phone
    return phone
  }

  // Format time
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return formatTime(dateStr)
    if (days === 1) return t('admin.chat.yesterday') || 'Yesterday'
    if (days < 7) return d.toLocaleDateString('he-IL', { weekday: 'short' })
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  }

  const getContactDisplayName = (conv: WhatsAppConversation) => {
    if (conv.contacts?.first_name || conv.contacts?.last_name) {
      return `${conv.contacts.first_name || ''} ${conv.contacts.last_name || ''}`.trim()
    }
    return conv.contact_name || formatPhone(conv.phone)
  }

  // Total unread
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  return (
    <div className={`h-[calc(100vh-88px)] flex ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Left sidebar - Conversation list */}
      <div className={`w-full md:w-96 flex-shrink-0 flex flex-col border-r ${
        isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
      } ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.header.chat')}
              </h1>
              {totalUnread > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => fetchConversations()}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder={t('admin.chat.search_placeholder') || 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-800 text-white placeholder-gray-500 border-gray-700'
                  : 'bg-gray-100 text-gray-900 placeholder-gray-400 border-gray-200'
              } border focus:outline-none focus:ring-2 focus:ring-green-500/50`}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          ) : conversations.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('admin.chat.no_conversations') || 'No conversations yet'}</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 transition-colors border-b ${
                  selectedConversation?.id === conv.id
                    ? isDark ? 'bg-gray-800 border-gray-700' : 'bg-green-50 border-gray-100'
                    : isDark ? 'hover:bg-gray-800/50 border-gray-800' : 'hover:bg-gray-50 border-gray-100'
                }`}
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  conv.contact_id
                    ? 'bg-green-600'
                    : isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}>
                  <User className="w-6 h-6 text-white" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {getContactDisplayName(conv)}
                    </span>
                    <span className={`text-xs flex-shrink-0 ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatDate(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatPhone(conv.phone)}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="bg-green-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - Chat view */}
      <div className={`flex-1 flex flex-col ${
        !selectedConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {!selectedConversation ? (
          // Empty state
          <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">{t('admin.chat.select_conversation') || 'Select a conversation'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className={`p-4 border-b flex items-center gap-3 ${
              isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
              {/* Back button (mobile) */}
              <button
                onClick={() => setSelectedConversation(null)}
                className={`md:hidden p-1 rounded-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedConversation.contact_id ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
              }`}>
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {getContactDisplayName(selectedConversation)}
                </div>
                <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Phone className="w-3 h-3" />
                  {formatPhone(selectedConversation.phone)}
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${
              isDark ? 'bg-gray-900' : 'bg-gray-50'
            }`}>
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
              ) : messages.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  <p>{t('admin.chat.no_messages') || 'No messages yet'}</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.direction === 'outbound'
                        ? 'bg-green-600 text-white rounded-br-md'
                        : isDark
                          ? 'bg-gray-800 text-white rounded-bl-md'
                          : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`text-[10px] mt-1 text-right ${
                        msg.direction === 'outbound'
                          ? 'text-green-200'
                          : isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}>
                        {formatTime(msg.created_at)}
                        {msg.direction === 'outbound' && (
                          <span className="ml-1">
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className={`p-4 border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={t('admin.chat.type_message') || 'Type a message...'}
                  className={`flex-1 px-4 py-2.5 rounded-full text-sm ${
                    isDark
                      ? 'bg-gray-700 text-white placeholder-gray-500 border-gray-600'
                      : 'bg-gray-100 text-gray-900 placeholder-gray-400 border-gray-200'
                  } border focus:outline-none focus:ring-2 focus:ring-green-500/50`}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className={`p-2.5 rounded-full transition-colors ${
                    newMessage.trim() && !sending
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
