'use client'

import { useEffect, useState } from 'react'
import { X, ShieldX, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

export type ToastType = 'error' | 'warning' | 'permission_denied' | 'success'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message: string
  messageKey?: string
  duration?: number // en ms, 0 = infini
}

interface PermissionToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  isDark: boolean
}

export function PermissionToast({ toasts, onDismiss, isDark }: PermissionToastProps) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          isDark={isDark}
        />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: ToastMessage
  onDismiss: () => void
  isDark: boolean
}

function ToastItem({ toast, onDismiss, isDark }: ToastItemProps) {
  const { t } = useTranslation()
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(onDismiss, 300) // Attendre l'animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 300)
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'permission_denied':
        return <ShieldX className="w-5 h-5 text-red-400" />
      case 'error':
        return <ShieldAlert className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      default:
        return <ShieldX className="w-5 h-5 text-red-400" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return isDark ? 'border-green-500/50' : 'border-green-200'
      case 'permission_denied':
      case 'error':
        return isDark ? 'border-red-500/50' : 'border-red-200'
      case 'warning':
        return isDark ? 'border-yellow-500/50' : 'border-yellow-200'
      default:
        return isDark ? 'border-red-500/50' : 'border-red-200'
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return isDark ? 'bg-green-900/20' : 'bg-green-50'
      case 'permission_denied':
      case 'error':
        return isDark ? 'bg-red-900/20' : 'bg-red-50'
      case 'warning':
        return isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'
      default:
        return isDark ? 'bg-red-900/20' : 'bg-red-50'
    }
  }

  // Utiliser la traduction si une clé est fournie
  const displayMessage = toast.messageKey
    ? t(toast.messageKey) !== toast.messageKey
      ? t(toast.messageKey)
      : toast.message
    : toast.message

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        ${isDark ? 'bg-gray-800' : 'bg-white'}
        ${getBorderColor()}
        ${getBackgroundColor()}
      `}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {toast.title}
        </p>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {displayMessage}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className={`flex-shrink-0 p-1 rounded transition-colors ${
          isDark
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Hook pour gérer les toasts
export function usePermissionToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const showPermissionError = (message: string, messageKey?: string) => {
    showToast({
      type: 'permission_denied',
      title: 'Permission refusée',
      message,
      messageKey,
      duration: 6000,
    })
  }

  const showError = (message: string, messageKey?: string) => {
    showToast({
      type: 'error',
      title: 'Erreur',
      message,
      messageKey,
      duration: 5000,
    })
  }

  const showWarning = (message: string, messageKey?: string) => {
    showToast({
      type: 'warning',
      title: 'Attention',
      message,
      messageKey,
      duration: 5000,
    })
  }

  const showSuccess = (message: string, messageKey?: string) => {
    showToast({
      type: 'success',
      title: 'Succes',
      message,
      messageKey,
      duration: 3000,
    })
  }

  return {
    toasts,
    showToast,
    dismissToast,
    showPermissionError,
    showError,
    showWarning,
    showSuccess,
  }
}
