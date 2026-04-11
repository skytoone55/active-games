'use client'

/**
 * Incoming message alert — plays a repeating ring tone when a new inbound
 * WhatsApp or Messenger message arrives, until the employee dismisses it.
 *
 * Behaviour:
 * - Detects new inbound messages via Supabase realtime (INSERT on whatsapp_messages / messenger_messages)
 * - Plays a phone-ring loop (Web Audio API, no external file) every 4 seconds
 * - Exposes `isRinging` + `dismiss()` so the UI can show a banner with a "stop" button
 * - Stops automatically if the employee navigates to the chat page
 * - Tracks already-notified message IDs so the same message never triggers twice
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { usePathname } from 'next/navigation'

// ---------------------------------------------------------------------------
// Web Audio ring tone — pleasant double-beep pattern
// ---------------------------------------------------------------------------
function createRingLoop(): { stop: () => void } {
  let stopped = false
  let ctx: AudioContext | null = null

  const playOnce = () => {
    if (stopped) return
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

      const playBeep = (startTime: number, freq: number, duration: number, gain: number) => {
        const osc = ctx!.createOscillator()
        const g = ctx!.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        g.gain.setValueAtTime(0, startTime)
        g.gain.linearRampToValueAtTime(gain, startTime + 0.02)
        g.gain.setValueAtTime(gain, startTime + duration - 0.05)
        g.gain.linearRampToValueAtTime(0, startTime + duration)
        osc.connect(g)
        g.connect(ctx!.destination)
        osc.start(startTime)
        osc.stop(startTime + duration)
      }

      const t = ctx.currentTime
      // Two-tone ring: high + low, twice
      playBeep(t,       880, 0.18, 0.35)
      playBeep(t + 0.05, 660, 0.18, 0.25)
      playBeep(t + 0.5,  880, 0.18, 0.35)
      playBeep(t + 0.55, 660, 0.18, 0.25)

      setTimeout(() => { ctx?.close(); ctx = null }, 1500)
    } catch (e) {
      console.warn('[IncomingAlert] Audio error:', e)
    }
  }

  playOnce()
  const interval = setInterval(() => { if (!stopped) playOnce() }, 4000)

  return {
    stop: () => {
      stopped = true
      clearInterval(interval)
      ctx?.close()
      ctx = null
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useIncomingMessageAlert() {
  const [isRinging, setIsRinging] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)  // how many unread new messages
  const ringRef = useRef<{ stop: () => void } | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())
  const pathname = usePathname()

  // Auto-dismiss when employee navigates to chat
  useEffect(() => {
    if (pathname?.startsWith('/admin/chat')) {
      dismiss()
    }
  }, [pathname])

  const dismiss = useCallback(() => {
    ringRef.current?.stop()
    ringRef.current = null
    setIsRinging(false)
    setPendingCount(0)
  }, [])

  const triggerAlert = useCallback((messageId: string) => {
    if (notifiedRef.current.has(messageId)) return
    notifiedRef.current.add(messageId)

    setPendingCount(prev => prev + 1)

    // Start ring loop if not already ringing
    if (!ringRef.current) {
      ringRef.current = createRingLoop()
      setIsRinging(true)
    }
  }, [])

  // Listen for new inbound WhatsApp messages
  const handleWaMessage = useCallback((payload?: { new?: Record<string, unknown>; eventType?: string }) => {
    if (
      payload?.eventType === 'INSERT' &&
      payload?.new?.direction === 'inbound' &&
      payload?.new?.id
    ) {
      triggerAlert(payload.new.id as string)
    }
  }, [triggerAlert])

  // Listen for new inbound Messenger messages
  const handleMsMessage = useCallback((payload?: { new?: Record<string, unknown>; eventType?: string }) => {
    if (
      payload?.eventType === 'INSERT' &&
      payload?.new?.direction === 'inbound' &&
      payload?.new?.id
    ) {
      triggerAlert(payload.new.id as string)
    }
  }, [triggerAlert])

  useRealtimeSubscription(
    { table: 'whatsapp_messages', onChange: handleWaMessage },
    true
  )
  useRealtimeSubscription(
    { table: 'messenger_messages', onChange: handleMsMessage },
    true
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => { ringRef.current?.stop() }
  }, [])

  return { isRinging, pendingCount, dismiss }
}
