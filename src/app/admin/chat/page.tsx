'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { MessageCircle, Send, Search, Phone, User, ArrowLeft, Loader2, Filter, UserPlus, Globe, Bot, Archive, X, Smile, Trash2, EyeOff } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Theme as EmojiTheme } from 'emoji-picker-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })
import { useTranslation } from '@/contexts/LanguageContext'
import { useAdmin } from '@/contexts/AdminContext'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { QuickContactModal } from './components/QuickContactModal'
import type { Contact } from '@/lib/supabase/types'

// ============================================================
// Types
// ============================================================

type ChatChannel = 'whatsapp' | 'site'

interface WhatsAppConversation {
  id: string
  phone: string
  contact_name: string | null
  contact_id: string | null
  branch_id: string | null
  activity: string | null
  onboarding_status: string | null
  onboarding_data: Record<string, string> | null
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
  branch?: {
    id: string
    name: string
    name_en: string | null
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

interface MessengerConversation {
  id: string
  session_id: string
  branch_id: string | null
  contact_id: string | null
  current_workflow_id: string
  current_step_ref: string | null
  collected_data: Record<string, unknown>
  status: string
  completed_at: string | null
  last_activity_at: string
  started_at: string
  last_message: string | null
  last_message_role: string | null
  message_count: number
  contacts?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
  } | null
  branch?: {
    id: string
    name: string
    name_en: string | null
  } | null
}

interface MessengerMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  step_ref: string | null
  created_at: string
}

// Fixed branch colors
const BRANCH_COLOR_MAP: Record<string, string> = {
  '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e': 'bg-blue-500',    // Rishon LeZion
  '9fa7c0b6-cf58-4a13-9fd6-db5dd2306362': 'bg-orange-500',   // Petah Tikva
  '2fb29792-1381-4595-ace3-9a61a8bc1f32': 'bg-yellow-500',    // Glilot
}

function getBranchColor(branchId: string, _allBranches?: { id: string }[]): string {
  return BRANCH_COLOR_MAP[branchId] || 'bg-gray-500'
}

export default function ChatPage() {
  const { t, locale } = useTranslation()
  const { user, branches, selectedBranch, selectBranch, isDark, loading: adminLoading } = useAdmin()
  const { hasPermission, loading: permissionsLoading } = useUserPermissions(user?.role || null)

  // ============================================================
  // Channel tab state
  // ============================================================
  const [activeChannel, setActiveChannel] = useState<ChatChannel>('whatsapp')

  // ============================================================
  // WhatsApp state
  // ============================================================
  const [waConversations, setWaConversations] = useState<WhatsAppConversation[]>([])
  const [selectedWaConv, setSelectedWaConv] = useState<WhatsAppConversation | null>(null)
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [waLoading, setWaLoading] = useState(true)
  const [waLoadingMessages, setWaLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  // ============================================================
  // Messenger (Site) state
  // ============================================================
  const [msConversations, setMsConversations] = useState<MessengerConversation[]>([])
  const [selectedMsConv, setSelectedMsConv] = useState<MessengerConversation | null>(null)
  const [msMessages, setMsMessages] = useState<MessengerMessage[]>([])
  const [msLoading, setMsLoading] = useState(true)
  const [msLoadingMessages, setMsLoadingMessages] = useState(false)

  // ============================================================
  // Cross-tab notification badges
  // ============================================================
  const [waHasNew, setWaHasNew] = useState(false)
  const [msHasNew, setMsHasNew] = useState(false)
  const [msLiveActive, setMsLiveActive] = useState(false) // live conversation indicator
  const msLiveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [closingConversation, setClosingConversation] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingConversation, setDeletingConversation] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; convId: string } | null>(null)

  // ============================================================
  // Shared state
  // ============================================================
  const [searchQuery, setSearchQuery] = useState('')
  const [chatBranchFilter, setChatBranchFilter] = useState<string>('all')
  const [showQuickContact, setShowQuickContact] = useState(false)

  // Non-urgent state transition (prevents INP issues)
  const [, startTransition] = useTransition()

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(384)
  const isResizing = useRef(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedWaConvIdRef = useRef<string | null>(null)
  const selectedMsConvIdRef = useRef<string | null>(null)
  const activeChannelRef = useRef<ChatChannel>('whatsapp')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  const isLoading = adminLoading || permissionsLoading || !user

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  // Close context menu on outside click / scroll
  useEffect(() => {
    if (!contextMenu) return
    const handleClose = () => setContextMenu(null)
    document.addEventListener('click', handleClose)
    document.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('click', handleClose)
      document.removeEventListener('scroll', handleClose, true)
    }
  }, [contextMenu])

  // Mark WhatsApp conversation as unread
  const handleMarkAsUnread = async (convId: string) => {
    setContextMenu(null)
    // If this is the currently selected conversation, deselect it
    if (selectedWaConv?.id === convId) {
      setSelectedWaConv(null)
    }
    // Optimistic update
    setWaConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: Math.max(c.unread_count, 1) } : c))
    try {
      await fetch(`/api/chat/conversations/${convId}/unread`, { method: 'POST' })
    } catch (error) {
      console.error('Error marking as unread:', error)
    }
  }

  // Determine if user can see all branches
  const canSeeAll = user?.role === 'super_admin' || branches.length > 1
  const canSeeUnassigned = canSeeAll && hasPermission('chat', 'can_edit')

  // Effective branch filter for API calls
  const effectiveBranchId = chatBranchFilter === 'inherit'
    ? (selectedBranch?.id || (canSeeAll ? 'all' : branches[0]?.id || null))
    : chatBranchFilter

  // ============================================================
  // Selected conversation (unified accessor)
  // ============================================================
  const hasSelectedConversation = activeChannel === 'whatsapp' ? !!selectedWaConv : !!selectedMsConv

  // Keep refs in sync
  useEffect(() => {
    selectedWaConvIdRef.current = selectedWaConv?.id || null
  }, [selectedWaConv])
  useEffect(() => {
    selectedMsConvIdRef.current = selectedMsConv?.id || null
  }, [selectedMsConv])
  useEffect(() => {
    activeChannelRef.current = activeChannel
  }, [activeChannel])

  // Cleanup live indicator timer on unmount
  useEffect(() => {
    return () => { if (msLiveTimerRef.current) clearTimeout(msLiveTimerRef.current) }
  }, [])

  // ============================================================
  // Sidebar width sync
  // ============================================================
  useEffect(() => {
    const savedWidth = localStorage.getItem('chat_sidebar_width')
    if (savedWidth) setSidebarWidth(Math.max(280, Math.min(600, parseInt(savedWidth))))
  }, [])

  // Sidebar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let lastWidth = sidebarWidth

    let rafId: number | null = null
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      if (rafId) return // throttle to animation frame
      rafId = requestAnimationFrame(() => {
        const newWidth = Math.max(280, Math.min(600, e.clientX))
        lastWidth = newWidth
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`
        }
        rafId = null
      })
    }

    const handleMouseUp = () => {
      isResizing.current = false
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSidebarWidth(lastWidth)
      localStorage.setItem('chat_sidebar_width', String(lastWidth))
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [sidebarWidth])

  // ============================================================
  // WhatsApp: Fetch conversations
  // ============================================================
  const fetchWaConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active' })
      if (effectiveBranchId && effectiveBranchId !== 'all') {
        params.set('branchId', effectiveBranchId)
      } else if (effectiveBranchId === 'all') {
        params.set('branchId', 'all')
        // Send allowed branches so API can scope "all" properly
        if (branches.length > 0) {
          params.set('allowedBranches', branches.map(b => b.id).join(','))
        }
        if (canSeeUnassigned) {
          params.set('includeUnassigned', 'true')
        }
      }
      if (searchQuery && activeChannelRef.current === 'whatsapp') params.set('search', searchQuery)

      const res = await fetch(`/api/chat/conversations?${params}`)
      const data = await res.json()
      if (data.conversations) {
        setWaConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching WA conversations:', error)
    } finally {
      setWaLoading(false)
    }
  }, [effectiveBranchId, searchQuery, branches, canSeeUnassigned])

  // WhatsApp: Fetch messages
  const fetchWaMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setWaLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`)
      const data = await res.json()
      if (data.messages) {
        setWaMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching WA messages:', error)
    } finally {
      setWaLoadingMessages(false)
    }
  }, [])

  // ============================================================
  // Messenger: Fetch conversations
  // ============================================================
  const fetchMsConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      // When showArchived, show only completed (archived); otherwise only active
      if (showArchived) {
        params.set('status', 'completed')
      } else {
        params.set('status', 'active')
      }
      if (effectiveBranchId && effectiveBranchId !== 'all') {
        params.set('branchId', effectiveBranchId)
      } else if (effectiveBranchId === 'all') {
        params.set('branchId', 'all')
        // Send allowed branches so API can scope "all" properly
        if (branches.length > 0) {
          params.set('allowedBranches', branches.map(b => b.id).join(','))
        }
        if (canSeeUnassigned) {
          params.set('includeUnassigned', 'true')
        }
      }
      if (searchQuery && activeChannelRef.current === 'site') params.set('search', searchQuery)

      const res = await fetch(`/api/chat/messenger-conversations?${params}`)
      const data = await res.json()
      if (data.conversations) {
        setMsConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching messenger conversations:', error)
    } finally {
      setMsLoading(false)
    }
  }, [effectiveBranchId, searchQuery, showArchived, branches, canSeeUnassigned])

  // Messenger: Fetch messages
  const fetchMsMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setMsLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/messenger-messages?conversationId=${conversationId}`)
      const data = await res.json()
      if (data.messages) {
        setMsMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching messenger messages:', error)
    } finally {
      setMsLoadingMessages(false)
    }
  }, [])

  // ============================================================
  // Initial data load
  // ============================================================
  useEffect(() => {
    if (!isLoading) {
      fetchWaConversations()
      fetchMsConversations()
    }
  }, [fetchWaConversations, fetchMsConversations, isLoading])

  // ============================================================
  // Supabase Realtime
  // ============================================================
  const handleWaConversationChange = useCallback(() => {
    fetchWaConversations()
    // Notify if not on whatsapp tab
    if (activeChannelRef.current !== 'whatsapp') {
      setWaHasNew(true)
    }
  }, [fetchWaConversations])

  const handleWaMessageChange = useCallback(() => {
    fetchWaConversations()
    if (selectedWaConvIdRef.current) {
      fetchWaMessages(selectedWaConvIdRef.current, true)
    }
    if (activeChannelRef.current !== 'whatsapp') {
      setWaHasNew(true)
    }
  }, [fetchWaConversations, fetchWaMessages])

  // Trigger the "live" indicator on Site tab — auto-expires after 2 min of silence
  const triggerMsLive = useCallback(() => {
    setMsLiveActive(true)
    if (msLiveTimerRef.current) clearTimeout(msLiveTimerRef.current)
    msLiveTimerRef.current = setTimeout(() => setMsLiveActive(false), 2 * 60 * 1000)
  }, [])

  const handleMsConversationChange = useCallback(() => {
    fetchMsConversations()
    triggerMsLive()
    if (activeChannelRef.current !== 'site') {
      setMsHasNew(true)
    }
  }, [fetchMsConversations, triggerMsLive])

  const handleMsMessageChange = useCallback(() => {
    fetchMsConversations()
    if (selectedMsConvIdRef.current) {
      fetchMsMessages(selectedMsConvIdRef.current, true)
    }
    triggerMsLive()
    if (activeChannelRef.current !== 'site') {
      setMsHasNew(true)
    }
  }, [fetchMsConversations, fetchMsMessages, triggerMsLive])

  useRealtimeSubscription({ table: 'whatsapp_conversations', onChange: handleWaConversationChange }, !isLoading)
  useRealtimeSubscription({ table: 'whatsapp_messages', onChange: handleWaMessageChange }, !isLoading)
  useRealtimeSubscription({ table: 'messenger_conversations', onChange: handleMsConversationChange }, !isLoading)
  useRealtimeSubscription({ table: 'messenger_messages', onChange: handleMsMessageChange }, !isLoading)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [waMessages, msMessages])

  // ============================================================
  // Clear notification when switching tabs
  // ============================================================
  const handleSwitchChannel = (channel: ChatChannel) => {
    setActiveChannel(channel)
    setSearchQuery('')
    if (channel === 'whatsapp') {
      setWaHasNew(false)
      setSelectedMsConv(null)
    } else {
      setMsHasNew(false)
      setSelectedWaConv(null)
    }
  }

  // ============================================================
  // WhatsApp actions
  // ============================================================
  const handleSelectWaConversation = (conv: WhatsAppConversation) => {
    setSelectedWaConv(conv)
    fetchWaMessages(conv.id)
    setWaConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    fetch(`/api/chat/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => {})
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedWaConv || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedWaConv.id,
          message: newMessage.trim(),
          userId: user?.id || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewMessage('')
        fetchWaMessages(selectedWaConv.id, true)
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleContactCreated = async (contact: Contact) => {
    if (!selectedWaConv) return
    try {
      const res = await fetch(`/api/chat/conversations/${selectedWaConv.id}/link-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      })
      const data = await res.json()
      if (data.success && data.conversation) {
        setSelectedWaConv(data.conversation)
        setWaConversations(prev => prev.map(c => c.id === data.conversation.id ? data.conversation : c))
      }
    } catch (error) {
      console.error('Error linking contact:', error)
    }
    fetchWaConversations()
  }

  // ============================================================
  // Messenger actions
  // ============================================================
  const handleSelectMsConversation = (conv: MessengerConversation) => {
    setSelectedMsConv(conv)
    fetchMsMessages(conv.id)
  }

  const handleMsContactCreated = async (contact: Contact) => {
    if (!selectedMsConv) return
    try {
      const res = await fetch(`/api/chat/messenger-conversations/${selectedMsConv.id}/link-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id }),
      })
      const data = await res.json()
      if (data.success && data.conversation) {
        setSelectedMsConv(data.conversation)
        setMsConversations(prev => prev.map(c => c.id === data.conversation.id ? { ...data.conversation, last_message: c.last_message, last_message_role: c.last_message_role, message_count: c.message_count } : c))
      }
    } catch (error) {
      console.error('Error linking messenger contact:', error)
    }
    fetchMsConversations()
  }

  const handleCloseMsConversation = async () => {
    if (!selectedMsConv || closingConversation) return
    if (!confirm(t('admin.chat.close_confirm') || 'Close this conversation? It will be archived.')) return
    setClosingConversation(true)
    try {
      const res = await fetch('/api/chat/messenger-conversations/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedMsConv.id }),
      })
      const data = await res.json()
      if (data.success) {
        setSelectedMsConv(null)
        fetchMsConversations()
      }
    } catch (error) {
      console.error('Error closing conversation:', error)
    } finally {
      setClosingConversation(false)
    }
  }

  const handleDeleteWaConversation = async () => {
    if (!selectedWaConv || deletingConversation) return
    setDeletingConversation(true)
    try {
      const res = await fetch(`/api/chat/conversations/${selectedWaConv.id}/delete`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setSelectedWaConv(null)
        setShowDeleteConfirm(false)
        fetchWaConversations()
      } else {
        console.error('Delete failed:', data.error)
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    } finally {
      setDeletingConversation(false)
    }
  }

  // ============================================================
  // Helpers
  // ============================================================
  const formatPhone = (phone: string) => {
    if (phone.startsWith('+')) return phone
    if (/^\d{10,15}$/.test(phone) && !phone.startsWith('0')) return '+' + phone
    return phone
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    // Compare calendar dates (not time diff)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return formatTime(dateStr)
    if (diffDays === 1) return t('admin.chat.yesterday') || 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString(locale === 'he' ? 'he-IL' : locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' })
    return d.toLocaleDateString(locale === 'he' ? 'he-IL' : locale === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' })
  }

  const getWaDisplayName = (conv: WhatsAppConversation) => {
    if (conv.contacts?.first_name || conv.contacts?.last_name) {
      return `${conv.contacts.first_name || ''} ${conv.contacts.last_name || ''}`.trim()
    }
    return conv.contact_name || formatPhone(conv.phone)
  }

  const getMsDisplayName = (conv: MessengerConversation) => {
    if (conv.contacts?.first_name || conv.contacts?.last_name) {
      return `${conv.contacts.first_name || ''} ${conv.contacts.last_name || ''}`.trim()
    }
    // Use collected_data name fields if available
    const data = conv.collected_data || {}
    const name = (data.NAME as string) || (data.name as string) || (data.first_name as string)
    if (name) return name
    return `${t('admin.chat.site_visitor') || 'Visitor'} #${conv.session_id.slice(-6)}`
  }

  const getMsPhone = (conv: MessengerConversation) => {
    const data = conv.collected_data || {}
    return (data.NUMBER as string) || (data.phone as string) || conv.contacts?.phone || null
  }

  const getBranchDisplayName = (branch?: { id: string; name: string; name_en: string | null } | null) => {
    if (!branch) return null
    if (locale === 'en' && branch.name_en) return branch.name_en
    return branch.name
  }

  // Total unread (WhatsApp only — messenger has no unread concept)
  const totalWaUnread = waConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`h-[calc(100vh-88px)] flex ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Left sidebar - Conversation list (resizable on desktop) */}
        <div
          ref={sidebarRef}
          style={{ width: sidebarWidth }}
          className={`max-md:!w-full md:flex-shrink-0 flex flex-col border-r ${
            isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
          } ${hasSelectedConversation ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Header with channel tabs */}
          <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            {/* Channel tabs */}
            <div className="flex">
              <button
                onClick={() => handleSwitchChannel('whatsapp')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                  activeChannel === 'whatsapp'
                    ? isDark ? 'text-green-400 border-b-2 border-green-400' : 'text-green-600 border-b-2 border-green-600'
                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
                {totalWaUnread > 0 && activeChannel === 'whatsapp' && (
                  <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {totalWaUnread}
                  </span>
                )}
                {waHasNew && activeChannel !== 'whatsapp' && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
              <button
                onClick={() => handleSwitchChannel('site')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative ${
                  activeChannel === 'site'
                    ? isDark ? 'text-blue-400 border-b-2 border-blue-400' : 'text-blue-600 border-b-2 border-blue-600'
                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Globe className="w-4 h-4" />
                Site
                {msLiveActive && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Live conversation" />
                )}
                {msHasNew && activeChannel !== 'site' && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            </div>

            {/* Branch filter + search (shared) */}
            <div className="p-4 pt-3">
              {canSeeAll && branches.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => startTransition(() => setChatBranchFilter(chatBranchFilter === 'all' ? 'inherit' : 'all'))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                        effectiveBranchId === 'all'
                          ? 'bg-green-600 text-white'
                          : isDark
                            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      {t('admin.chat.all_branches') || 'All'}
                    </button>
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => startTransition(() => setChatBranchFilter(
                          chatBranchFilter === branch.id ? 'inherit' : branch.id
                        ))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                          effectiveBranchId === branch.id
                            ? `${getBranchColor(branch.id, branches)} text-white`
                            : isDark
                              ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          effectiveBranchId === branch.id
                            ? 'bg-white/40'
                            : getBranchColor(branch.id, branches)
                        }`} />
                        {locale === 'en' && branch.name_en ? branch.name_en : branch.name}
                      </button>
                    ))}
                    {canSeeUnassigned && (
                      <button
                        onClick={() => startTransition(() => setChatBranchFilter(
                          chatBranchFilter === 'unassigned' ? 'inherit' : 'unassigned'
                        ))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          effectiveBranchId === 'unassigned'
                            ? isDark ? 'bg-gray-600 text-white' : 'bg-gray-500 text-white'
                            : isDark
                              ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        {t('admin.chat.unassigned') || 'Unassigned'}
                      </button>
                    )}
                  </div>
                </div>
              )}

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
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {activeChannel === 'whatsapp' ? (
              // ============================================================
              // WhatsApp conversation list
              // ============================================================
              waLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
              ) : waConversations.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('admin.chat.no_conversations') || 'No conversations yet'}</p>
                </div>
              ) : (
                waConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group relative w-full p-4 flex items-center gap-3 transition-colors border-b cursor-pointer ${
                      selectedWaConv?.id === conv.id
                        ? isDark ? 'bg-gray-800 border-gray-700' : 'bg-green-50 border-gray-100'
                        : isDark ? 'hover:bg-gray-800/50 border-gray-800' : 'hover:bg-gray-50 border-gray-100'
                    }`}
                    onClick={() => handleSelectWaConversation(conv)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id })
                    }}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      conv.contact_id ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`}>
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {getWaDisplayName(conv)}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatDate(conv.last_message_at)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsUnread(conv.id)
                            }}
                            className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-400'
                            }`}
                            title={t('admin.chat.mark_unread') || 'Mark as unread'}
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatPhone(conv.phone)}
                          </span>
                          {conv.branch_id && (
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getBranchColor(conv.branch_id, branches)}`}
                              title={getBranchDisplayName(conv.branch) || ''}
                            />
                          )}
                          {conv.activity && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              conv.activity === 'laser_city'
                                ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                                : isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                            }`}>
                              {conv.activity === 'laser_city' ? 'Laser' : 'Active'}
                            </span>
                          )}
                          {conv.onboarding_status && conv.onboarding_status !== 'completed' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse ${
                              isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                            }`}>
                              ⏳
                            </span>
                          )}
                          {!conv.branch_id && !conv.contact_id && !conv.onboarding_status && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {t('admin.chat.new_contact') || 'New'}
                            </span>
                          )}
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="bg-green-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              // ============================================================
              // Messenger (Site) conversation list
              // ============================================================
              <>
                {/* Archive toggle */}
                <div className={`px-4 py-2 border-b flex items-center justify-between ${
                  isDark ? 'border-gray-800' : 'border-gray-100'
                }`}>
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className={`text-xs flex items-center gap-1.5 transition-colors ${
                      showArchived
                        ? 'text-blue-400'
                        : isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {showArchived
                      ? t('admin.chat.hide_archived') || 'Hide archived'
                      : t('admin.chat.show_archived') || 'Show archived'}
                  </button>
                </div>
                {msLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                ) : msConversations.length === 0 ? (
                  <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('admin.chat.no_site_conversations') || 'No site conversations yet'}</p>
                  </div>
                ) : (
                msConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectMsConversation(conv)}
                    className={`w-full p-4 flex items-center gap-3 transition-colors border-b ${
                      selectedMsConv?.id === conv.id
                        ? isDark ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-gray-100'
                        : isDark ? 'hover:bg-gray-800/50 border-gray-800' : 'hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      conv.contact_id ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`}>
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {getMsDisplayName(conv)}
                        </span>
                        <span className={`text-xs flex-shrink-0 ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatDate(conv.last_activity_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {getMsPhone(conv) || (conv.last_message
                              ? conv.last_message.slice(0, 40) + (conv.last_message.length > 40 ? '...' : '')
                              : t('admin.chat.no_messages') || 'No messages')}
                          </span>
                          {conv.branch_id && (
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getBranchColor(conv.branch_id, branches)}`}
                              title={getBranchDisplayName(conv.branch) || ''}
                            />
                          )}
                          {!conv.contact_id && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {t('admin.chat.new_contact') || 'New'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {/* Status badge */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            conv.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : conv.status === 'completed'
                                ? isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                                : 'bg-red-500/20 text-red-400'
                          }`}>
                            {conv.status === 'active'
                              ? t('admin.chat.site_active') || 'Active'
                              : conv.status === 'completed'
                                ? t('admin.chat.site_completed') || 'Done'
                                : t('admin.chat.site_abandoned') || 'Left'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
              </>
            )}
          </div>
        </div>

        {/* Resize handle (desktop only) */}
        <div
          onMouseDown={handleResizeStart}
          className={`hidden md:flex w-1.5 cursor-col-resize items-center justify-center hover:bg-green-500/20 active:bg-green-500/30 transition-colors group ${
            isDark ? 'bg-gray-800' : 'bg-gray-100'
          }`}
        >
          <div className={`w-0.5 h-8 rounded-full group-hover:bg-green-500 transition-colors ${
            isDark ? 'bg-gray-700' : 'bg-gray-300'
          }`} />
        </div>

        {/* Right panel - Chat view */}
        <div className={`flex-1 flex flex-col min-w-0 ${
          !hasSelectedConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {!hasSelectedConversation ? (
            <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
              <div className="text-center">
                {activeChannel === 'whatsapp' ? (
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                ) : (
                  <Globe className="w-16 h-16 mx-auto mb-4 opacity-30" />
                )}
                <p className="text-lg">{t('admin.chat.select_conversation') || 'Select a conversation'}</p>
              </div>
            </div>
          ) : activeChannel === 'whatsapp' && selectedWaConv ? (
            // ============================================================
            // WhatsApp chat view
            // ============================================================
            <>
              {/* Chat header */}
              <div className={`p-4 border-b flex items-center gap-3 ${
                isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <button
                  onClick={() => setSelectedWaConv(null)}
                  className={`md:hidden p-1 rounded-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedWaConv.contact_id ? 'bg-green-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}>
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getWaDisplayName(selectedWaConv)}
                  </div>
                  <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Phone className="w-3 h-3" />
                    {formatPhone(selectedWaConv.phone)}
                    {selectedWaConv.branch_id && (
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${getBranchColor(selectedWaConv.branch_id, branches)}`}
                        title={getBranchDisplayName(selectedWaConv.branch) || ''}
                      />
                    )}
                    {selectedWaConv.activity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedWaConv.activity === 'laser_city'
                          ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                          : isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                      }`}>
                        {selectedWaConv.activity === 'laser_city' ? 'Laser City' : 'Active Games'}
                      </span>
                    )}
                  </div>
                </div>
                {!selectedWaConv.contact_id && (
                  <button
                    onClick={() => setShowQuickContact(true)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-gray-700 text-green-400' : 'hover:bg-gray-100 text-green-600'
                    }`}
                    title={t('admin.chat.create_contact') || 'Create contact'}
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletingConversation}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'
                    } disabled:opacity-50`}
                    title={t('admin.chat.delete_conversation') || 'Delete conversation'}
                  >
                    {deletingConversation ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>

              {/* WhatsApp messages */}
              <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                {waLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                ) : waMessages.length === 0 ? (
                  <div className={`text-center py-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    <p>{t('admin.chat.no_messages') || 'No messages yet'}</p>
                  </div>
                ) : (
                  waMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
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
                <div className="flex items-center gap-3 relative">
                  {/* Emoji picker */}
                  <div className="relative" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full transition-colors ${
                        showEmojiPicker
                          ? 'bg-green-600 text-white'
                          : isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full mb-2 left-0 z-50">
                        <EmojiPicker
                          theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                          onEmojiClick={(emojiData) => {
                            setNewMessage(prev => prev + emojiData.emoji)
                            inputRef.current?.focus()
                          }}
                          width={350}
                          height={400}
                          searchPlaceHolder={t('admin.chat.search_emoji') || 'Search emoji...'}
                          previewConfig={{ showPreview: false }}
                        />
                      </div>
                    )}
                  </div>

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
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : activeChannel === 'site' && selectedMsConv ? (
            // ============================================================
            // Messenger (Site) chat view
            // ============================================================
            <>
              {/* Chat header */}
              <div className={`p-4 border-b flex items-center gap-3 ${
                isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <button
                  onClick={() => setSelectedMsConv(null)}
                  className={`md:hidden p-1 rounded-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedMsConv.contact_id ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'
                }`}>
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getMsDisplayName(selectedMsConv)}
                  </div>
                  <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {getMsPhone(selectedMsConv) ? (
                      <>
                        <Phone className="w-3 h-3" />
                        {getMsPhone(selectedMsConv)}
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3" />
                        {t('admin.chat.site_conversation') || 'Site conversation'}
                      </>
                    )}
                    {selectedMsConv.branch_id && (
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${getBranchColor(selectedMsConv.branch_id, branches)}`}
                        title={getBranchDisplayName(selectedMsConv.branch) || ''}
                      />
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      selectedMsConv.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : selectedMsConv.status === 'completed'
                          ? isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                          : 'bg-red-500/20 text-red-400'
                    }`}>
                      {selectedMsConv.status === 'active'
                        ? t('admin.chat.site_active') || 'Active'
                        : selectedMsConv.status === 'completed'
                          ? t('admin.chat.site_completed') || 'Done'
                          : t('admin.chat.site_abandoned') || 'Left'}
                    </span>
                  </div>
                </div>

                {/* Create contact button (only for unlinked conversations) */}
                {!selectedMsConv.contact_id && (
                  <button
                    onClick={() => setShowQuickContact(true)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-100 text-blue-600'
                    }`}
                    title={t('admin.chat.create_contact') || 'Create contact'}
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}

                {/* Close conversation button (only for active conversations) */}
                {selectedMsConv.status === 'active' && (
                  <button
                    onClick={handleCloseMsConversation}
                    disabled={closingConversation}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-500'
                    } disabled:opacity-50`}
                    title={t('admin.chat.close_conversation') || 'Close conversation'}
                  >
                    {closingConversation ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>

              {/* Messenger messages */}
              <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                {msLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                ) : msMessages.length === 0 ? (
                  <div className={`text-center py-12 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    <p>{t('admin.chat.no_messages') || 'No messages yet'}</p>
                  </div>
                ) : (
                  msMessages.map((msg) => {
                    if (msg.role === 'system') return null
                    const isAssistant = msg.role === 'assistant'
                    return (
                      <div key={msg.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        {isAssistant && (
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isAssistant
                            ? isDark
                              ? 'bg-gray-800 text-white rounded-bl-md'
                              : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                            : 'bg-blue-600 text-white rounded-br-md'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={`text-[10px] mt-1 text-right ${
                            isAssistant
                              ? isDark ? 'text-gray-500' : 'text-gray-400'
                              : 'text-blue-200'
                          }`}>
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Read-only notice for site conversations */}
              <div className={`px-4 py-3 border-t text-center text-sm ${
                isDark ? 'border-gray-700 bg-gray-800 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}>
                {t('admin.chat.site_read_only') || 'Site conversations are read-only'}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Quick Contact Creation Modal (WhatsApp + Messenger) */}
      {selectedWaConv && (
        <QuickContactModal
          isOpen={showQuickContact}
          onClose={() => setShowQuickContact(false)}
          onContactCreated={handleContactCreated}
          phone={selectedWaConv.phone}
          contactName={selectedWaConv.contact_name}
          branches={branches}
          isDark={isDark}
        />
      )}
      {selectedMsConv && !selectedWaConv && (
        <QuickContactModal
          isOpen={showQuickContact}
          onClose={() => setShowQuickContact(false)}
          onContactCreated={handleMsContactCreated}
          phone={getMsPhone(selectedMsConv) || ''}
          contactName={getMsDisplayName(selectedMsConv)}
          branches={branches}
          isDark={isDark}
          defaultBranchId={selectedMsConv.branch_id}
        />
      )}
      {/* Context menu for WhatsApp conversations */}
      {contextMenu && (
        <div
          className={`fixed z-50 rounded-lg shadow-xl border py-1 min-w-[180px] ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 50),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleMarkAsUnread(contextMenu.convId)}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
              isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <EyeOff className="w-4 h-4" />
            {t('admin.chat.mark_unread') || 'Mark as unread'}
          </button>
        </div>
      )}

      {/* Delete WhatsApp conversation confirm (super_admin only) */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('admin.chat.delete_conversation') || 'Delete conversation'}
        message={
          selectedWaConv
            ? `${t('admin.chat.delete_conversation_confirm') || 'Are you sure you want to permanently delete this conversation?'}\n\n📱 ${selectedWaConv.contact_name || selectedWaConv.phone}\n\n${t('admin.chat.delete_conversation_warning') || 'All messages will be permanently deleted. This action cannot be undone.'}`
            : ''
        }
        confirmLabel={t('admin.chat.delete_confirm_btn') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        isDark={isDark}
        variant="danger"
        onConfirm={handleDeleteWaConversation}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
