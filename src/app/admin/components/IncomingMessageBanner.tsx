'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, X, Volume2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useIncomingMessageAlert } from '@/hooks/useIncomingMessageAlert'

export function IncomingMessageBanner() {
  const { isRinging, pendingCount, dismiss } = useIncomingMessageAlert()
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  // Animate in/out
  useEffect(() => {
    if (isRinging) setVisible(true)
    else {
      // Small delay before hiding to allow fade-out animation
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }
  }, [isRinging])

  if (!visible) return null

  const handleGoToChat = () => {
    dismiss()
    router.push('/admin/chat')
  }

  return (
    <div
      className={`
        fixed top-4 left-1/2 z-[9999] -translate-x-1/2
        flex items-center gap-3
        bg-green-600 text-white
        px-5 py-3 rounded-2xl shadow-2xl
        border border-green-400/40
        transition-all duration-300
        ${isRinging ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
      `}
      style={{ minWidth: 320, maxWidth: 480 }}
    >
      {/* Pulsing icon */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
        <div className="relative w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">
          {pendingCount > 1
            ? `${pendingCount} nouveaux messages`
            : 'Nouveau message reçu'}
        </p>
        <p className="text-xs text-green-100 mt-0.5 flex items-center gap-1">
          <Volume2 className="w-3 h-3" />
          Cliquez pour ouvrir le chat
        </p>
      </div>

      {/* Go to chat button */}
      <button
        onClick={handleGoToChat}
        className="flex-shrink-0 bg-white text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
      >
        Ouvrir
      </button>

      {/* Dismiss / stop sound */}
      <button
        onClick={dismiss}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        title="Couper le son"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
