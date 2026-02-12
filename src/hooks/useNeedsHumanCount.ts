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
 * Hook to get the count of conversations (WhatsApp + Messenger) that need human attention.
 * Listens to realtime changes on both tables.
 * Plays a notification sound when a new escalation is detected.
 *
 * Optimized: debounces realtime events, but plays sound immediately on escalation.
 */
export function useNeedsHumanCount(branches: { id: string }[]) {
  const [count, setCount] = useState(0)
  const notifiedRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCount = useCallback(async () => {
    let total = 0
    try {
      // Use countOnly mode — returns just { count: N } instead of 200 full objects
      const baseParams = new URLSearchParams({
        countOnly: 'true',
        countFilter: 'needs_human',
        branchId: 'all',
        includeUnassigned: 'true',
      })
      if (branches.length > 0) {
        baseParams.set('allowedBranches', branches.map(b => b.id).join(','))
      }

      const waParams = new URLSearchParams(baseParams)
      waParams.set('status', 'active')

      const msParams = new URLSearchParams(baseParams)
      msParams.set('status', 'all')

      // Fetch both counts in parallel
      const [waRes, msRes] = await Promise.all([
        fetch(`/api/chat/conversations?${waParams}`),
        fetch(`/api/chat/messenger-conversations?${msParams}`)
      ])

      const [waData, msData] = await Promise.all([waRes.json(), msRes.json()])

      total = (waData.count || 0) + (msData.count || 0)
    } catch (error) {
      console.error('[useNeedsHumanCount] Error:', error)
    }
    setCount(total)
  }, [branches])

  // Initial fetch
  useEffect(() => {
    if (branches.length > 0) {
      fetchCount()
    }
  }, [fetchCount, branches.length])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Shared handler for realtime escalation detection
  // Sound plays immediately, but fetch is debounced
  const handleEscalation = useCallback((payload?: { new?: Record<string, unknown>; eventType?: string }) => {
    // Debounce the fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCount()
    }, 500)

    // Sound plays immediately (no debounce) when a new escalation is detected
    const convId = payload?.new?.id as string | undefined
    if (payload?.eventType === 'UPDATE' && payload?.new?.needs_human === true && convId && !notifiedRef.current.has(convId)) {
      notifiedRef.current.add(convId)
      playEscalationSound()
    }
    if (payload?.eventType === 'UPDATE' && payload?.new?.needs_human === false && convId) {
      notifiedRef.current.delete(convId)
    }
  }, [fetchCount])

  // Listen to both WhatsApp and Messenger conversations
  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleEscalation },
    true
  )
  useRealtimeSubscription(
    { table: 'messenger_conversations', onChange: handleEscalation },
    true
  )

  return count
}
