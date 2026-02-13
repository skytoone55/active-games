/**
 * Hook pour gérer les automatisations d'emails
 */

import { useState, useEffect, useCallback } from 'react'

export interface EmailAutomation {
  id: string
  name: string
  description: string | null
  trigger_event: string
  template_code: string
  delay_minutes: number
  conditions: Record<string, unknown>
  enabled: boolean
  max_sends: number | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

interface UseEmailAutomationsReturn {
  automations: EmailAutomation[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createAutomation: (data: Partial<EmailAutomation>) => Promise<{ success: boolean; data?: EmailAutomation; error?: string }>
  updateAutomation: (id: string, data: Partial<EmailAutomation>) => Promise<{ success: boolean; error?: string }>
  deleteAutomation: (id: string) => Promise<{ success: boolean; error?: string }>
  toggleAutomation: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
}

export function useEmailAutomations(): UseEmailAutomationsReturn {
  const [automations, setAutomations] = useState<EmailAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAutomations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/email-automations')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch automations')
      }

      setAutomations(data.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch automations'
      setError(message)
      console.error('Error fetching automations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAutomations()
  }, [fetchAutomations])

  const createAutomation = async (data: Partial<EmailAutomation>): Promise<{ success: boolean; data?: EmailAutomation; error?: string }> => {
    try {
      const response = await fetch('/api/email-automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await fetchAutomations()
      return { success: true, data: result.data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create automation'
      return { success: false, error: message }
    }
  }

  const updateAutomation = async (id: string, data: Partial<EmailAutomation>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/email-automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await fetchAutomations()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update automation'
      return { success: false, error: message }
    }
  }

  const deleteAutomation = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/email-automations/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await fetchAutomations()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete automation'
      return { success: false, error: message }
    }
  }

  const toggleAutomation = async (id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    return updateAutomation(id, { enabled })
  }

  return {
    automations,
    loading,
    error,
    refresh: fetchAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation
  }
}
