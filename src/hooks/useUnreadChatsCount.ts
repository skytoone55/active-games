'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Hook to get the count of conversations with unread messages (for header badge)
 * Returns the total number of WhatsApp + Messenger conversations that have unread_count > 0
 * Always fetches ALL branches (the badge should show unread across ALL branches)
 *
 * Optimized: debounces realtime events to avoid cascading API calls
 */
export function useUnreadChatsCount(branches: { id: string }[]) {
  const [waCount, setWaCount] = useState(0)
  const [msCount, setMsCount] = useState(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active', pageSize: '200' })
      // Always fetch all branches for the badge
      params.set('branchId', 'all')
      if (branches.length > 0) {
        params.set('allowedBranches', branches.map(b => b.id).join(','))
      }
      params.set('includeUnassigned', 'true')

      // Fetch both in parallel
      const [waRes, msRes] = await Promise.all([
        fetch(`/api/chat/conversations?${params}`),
        fetch(`/api/chat/messenger-conversations?${params}`)
      ])

      const [waData, msData] = await Promise.all([waRes.json(), msRes.json()])

      if (waData.conversations) {
        setWaCount(waData.conversations.filter(
          (c: { unread_count: number }) => c.unread_count > 0
        ).length)
      }

      if (msData.conversations) {
        setMsCount(msData.conversations.filter(
          (c: { unread_count: number }) => c.unread_count > 0
        ).length)
      }
    } catch (error) {
      console.error('[useUnreadChatsCount] Error:', error)
    }
  }, [branches])

  // Initial fetch
  useEffect(() => {
    if (branches.length > 0) {
      fetchCounts()
    }
  }, [fetchCounts, branches.length])

  // Debounced handler for realtime changes — wait 500ms before fetching
  const handleRealtimeChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCounts()
    }, 500)
  }, [fetchCounts])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Listen for changes on WhatsApp conversations & messages (single handler)
  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleRealtimeChange },
    true
  )
  useRealtimeSubscription(
    { table: 'whatsapp_messages', onChange: handleRealtimeChange },
    true
  )

  // Listen for changes on Messenger conversations & messages (single handler)
  useRealtimeSubscription(
    { table: 'messenger_conversations', onChange: handleRealtimeChange },
    true
  )
  useRealtimeSubscription(
    { table: 'messenger_messages', onChange: handleRealtimeChange },
    true
  )

  return waCount + msCount
}
