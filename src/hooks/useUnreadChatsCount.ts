'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Hook to get the count of conversations with unread messages (for header badge)
 * Returns the total number of WhatsApp + Messenger conversations that have unread_count > 0
 * Always fetches ALL branches (the badge should show unread across ALL branches)
 */
export function useUnreadChatsCount(branches: { id: string }[]) {
  const [waCount, setWaCount] = useState(0)
  const [msCount, setMsCount] = useState(0)

  const fetchWaCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active', pageSize: '200' })
      // Always fetch all branches for the badge
      params.set('branchId', 'all')
      if (branches.length > 0) {
        params.set('allowedBranches', branches.map(b => b.id).join(','))
      }
      params.set('includeUnassigned', 'true')

      const res = await fetch(`/api/chat/conversations?${params}`)
      const data = await res.json()

      if (data.conversations) {
        const unreadConvs = data.conversations.filter(
          (c: { unread_count: number }) => c.unread_count > 0
        )
        setWaCount(unreadConvs.length)
      }
    } catch (error) {
      console.error('[useUnreadChatsCount] WA Error:', error)
    }
  }, [branches])

  const fetchMsCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active', pageSize: '200' })
      params.set('branchId', 'all')
      if (branches.length > 0) {
        params.set('allowedBranches', branches.map(b => b.id).join(','))
      }
      params.set('includeUnassigned', 'true')

      const res = await fetch(`/api/chat/messenger-conversations?${params}`)
      const data = await res.json()

      if (data.conversations) {
        const unreadConvs = data.conversations.filter(
          (c: { unread_count: number }) => c.unread_count > 0
        )
        setMsCount(unreadConvs.length)
      }
    } catch (error) {
      console.error('[useUnreadChatsCount] MS Error:', error)
    }
  }, [branches])

  // Initial fetch
  useEffect(() => {
    if (branches.length > 0) {
      fetchWaCount()
      fetchMsCount()
    }
  }, [fetchWaCount, fetchMsCount, branches.length])

  // Realtime: listen for changes on WhatsApp conversations & messages
  const handleWaChange = useCallback(() => {
    fetchWaCount()
  }, [fetchWaCount])

  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleWaChange },
    true
  )
  useRealtimeSubscription(
    { table: 'whatsapp_messages', onChange: handleWaChange },
    true
  )

  // Realtime: listen for changes on Messenger conversations & messages
  const handleMsChange = useCallback(() => {
    fetchMsCount()
  }, [fetchMsCount])

  useRealtimeSubscription(
    { table: 'messenger_conversations', onChange: handleMsChange },
    true
  )
  useRealtimeSubscription(
    { table: 'messenger_messages', onChange: handleMsChange },
    true
  )

  return waCount + msCount
}
