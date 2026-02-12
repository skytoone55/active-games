'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

// Phone ring notification sound (Web Audio API — no external file needed)
function playEscalationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

    // Ring pattern: two short tones repeated 3 times
    const playRing = (startTime: number) => {
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.value = 880
      gain1.gain.value = 0.3
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(startTime)
      osc1.stop(startTime + 0.15)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = 660
      gain2.gain.value = 0.3
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(startTime + 0.2)
      osc2.stop(startTime + 0.35)
    }

    playRing(ctx.currentTime)
    playRing(ctx.currentTime + 0.6)
    playRing(ctx.currentTime + 1.2)

    setTimeout(() => ctx.close(), 2000)
  } catch (e) {
    console.warn('[NeedsHuman] Could not play escalation sound:', e)
  }
}

/**
 * Hook to get the count of WhatsApp conversations that need human attention (for header badge).
 * Returns the number of conversations with needs_human = true.
 * Listens to realtime changes on whatsapp_conversations.
 * Plays a notification sound when a new escalation is detected.
 */
export function useNeedsHumanCount(branches: { id: string }[]) {
  const [count, setCount] = useState(0)
  const notifiedRef = useRef<Set<string>>(new Set())

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
  const handleChange = useCallback((payload?: { new?: Record<string, unknown>; eventType?: string }) => {
    fetchCount()

    // Play sound when needs_human changes to true
    const convId = payload?.new?.id as string | undefined
    if (payload?.eventType === 'UPDATE' && payload?.new?.needs_human === true && convId && !notifiedRef.current.has(convId)) {
      notifiedRef.current.add(convId)
      playEscalationSound()
    }
    // Remove from notified set when resolved
    if (payload?.eventType === 'UPDATE' && payload?.new?.needs_human === false && convId) {
      notifiedRef.current.delete(convId)
    }
  }, [fetchCount])

  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleChange },
    true
  )

  return count
}
