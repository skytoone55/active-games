'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Hook to get the count of conversations with unread messages (for header badge)
 * Returns the number of conversations that have unread_count > 0
 */
export function useUnreadChatsCount(branchId: string | null) {
  const [count, setCount] = useState(0)
  const isFetchingRef = useRef(false)

  const fetchCount = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const params = new URLSearchParams({ status: 'active' })
      if (branchId) params.set('branchId', branchId)

      const res = await fetch(`/api/chat/conversations?${params}&pageSize=200`)
      const data = await res.json()

      if (data.conversations) {
        const unreadConvs = data.conversations.filter(
          (c: { unread_count: number }) => c.unread_count > 0
        )
        setCount(unreadConvs.length)
      }
    } catch (error) {
      console.error('[useUnreadChatsCount] Error:', error)
    } finally {
      isFetchingRef.current = false
    }
  }, [branchId])

  useEffect(() => {
    fetchCount()
  }, [fetchCount])

  // Realtime: listen for changes on whatsapp_conversations
  const handleChange = useCallback(() => {
    fetchCount()
  }, [fetchCount])

  useRealtimeSubscription(
    {
      table: 'whatsapp_conversations',
      onChange: handleChange,
    },
    true
  )

  // Also listen to whatsapp_messages (new inbound message = unread count changes)
  useRealtimeSubscription(
    {
      table: 'whatsapp_messages',
      onChange: handleChange,
    },
    true
  )

  return count
}
