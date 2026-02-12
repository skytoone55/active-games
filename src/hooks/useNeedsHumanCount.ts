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
 */
export function useNeedsHumanCount(branches: { id: string }[]) {
  const [count, setCount] = useState(0)
  const notifiedRef = useRef<Set<string>>(new Set())

  const fetchCount = useCallback(async () => {
    let total = 0
    try {
      // WhatsApp conversations
      const waParams = new URLSearchParams({ status: 'active', pageSize: '200' })
      waParams.set('branchId', 'all')
      if (branches.length > 0) {
        waParams.set('allowedBranches', branches.map(b => b.id).join(','))
      }
      waParams.set('includeUnassigned', 'true')

      const waRes = await fetch(`/api/chat/conversations?${waParams}`)
      const waData = await waRes.json()
      if (waData.conversations) {
        total += waData.conversations.filter(
          (c: { needs_human: boolean | null }) => c.needs_human === true
        ).length
      }

      // Messenger conversations
      const msParams = new URLSearchParams({ status: 'all', pageSize: '200' })
      msParams.set('branchId', 'all')
      if (branches.length > 0) {
        msParams.set('allowedBranches', branches.map(b => b.id).join(','))
      }

      const msRes = await fetch(`/api/chat/messenger-conversations?${msParams}`)
      const msData = await msRes.json()
      if (msData.conversations) {
        total += msData.conversations.filter(
          (c: { needs_human: boolean | null }) => c.needs_human === true
        ).length
      }
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

  // Shared handler for realtime escalation detection
  const handleEscalation = useCallback((payload?: { new?: Record<string, unknown>; eventType?: string }) => {
    fetchCount()

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
