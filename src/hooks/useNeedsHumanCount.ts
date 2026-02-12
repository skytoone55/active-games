'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Hook to get the count of WhatsApp conversations that need human attention (for header badge).
 * Returns the number of conversations with needs_human = true.
 * Listens to realtime changes on whatsapp_conversations.
 */
export function useNeedsHumanCount(branches: { id: string }[]) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active', pageSize: '200' })
      params.set('branchId', 'all')
      if (branches.length > 0) {
        params.set('allowedBranches', branches.map(b => b.id).join(','))
      }
      params.set('includeUnassigned', 'true')

      const res = await fetch(`/api/chat/conversations?${params}`)
      const data = await res.json()

      if (data.conversations) {
        const needsHumanConvs = data.conversations.filter(
          (c: { needs_human: boolean | null }) => c.needs_human === true
        )
        setCount(needsHumanConvs.length)
      }
    } catch (error) {
      console.error('[useNeedsHumanCount] Error:', error)
    }
  }, [branches])

  // Initial fetch
  useEffect(() => {
    if (branches.length > 0) {
      fetchCount()
    }
  }, [fetchCount, branches.length])

  // Realtime: listen for changes on WhatsApp conversations
  const handleChange = useCallback(() => {
    fetchCount()
  }, [fetchCount])

  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleChange },
    true
  )

  return count
}
