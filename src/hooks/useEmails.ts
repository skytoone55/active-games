/**
 * Hook pour gérer les emails (historique et envoi)
 */

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/swr-fetcher'
import type { EmailLog } from '@/lib/supabase/types'

interface EmailFilters {
  status?: string
  branchId?: string
  entityType?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

interface UseEmailsReturn {
  emails: EmailLog[]
  loading: boolean
  error: string | null
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  filters: EmailFilters
  setFilters: (filters: EmailFilters) => void
  setPage: (page: number) => void
  refresh: () => Promise<void>
  resendEmail: (emailLogId: string) => Promise<{ success: boolean; error?: string }>
  sendConfirmation: (bookingId: string) => Promise<{ success: boolean; error?: string }>
  deleteEmail: (emailLogId: string) => Promise<{ success: boolean; error?: string }>
  stats: {
    total: number
    sent: number
    failed: number
    pending: number
  }
}

function buildEmailsUrl(page: number, limit: number, filters: EmailFilters): string {
  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('limit', limit.toString())

  if (filters.status) params.set('status', filters.status)
  if (filters.branchId) params.set('branch_id', filters.branchId)
  if (filters.entityType) params.set('entity_type', filters.entityType)
  if (filters.search) params.set('search', filters.search)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)

  return `/api/emails?${params.toString()}`
}

export function useEmails(initialBranchId?: string): UseEmailsReturn {
  const [page, setPageState] = useState(1)
  const [limit] = useState(20)
  const [filters, setFiltersState] = useState<EmailFilters>({
    branchId: initialBranchId
  })

  // Build dynamic SWR key
  const swrKey = buildEmailsUrl(page, limit, filters)

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    data: EmailLog[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const emails = data?.data || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 }

  // Calculate stats from emails
  const stats = useMemo(() => ({
    total: pagination.total,
    sent: emails.filter(e => e.status === 'sent' || e.status === 'delivered').length,
    failed: emails.filter(e => e.status === 'failed' || e.status === 'bounced').length,
    pending: emails.filter(e => e.status === 'pending').length
  }), [emails, pagination.total])

  // Resend an email
  const resendEmail = useCallback(async (emailLogId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', emailLogId })
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await mutate()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend email'
      return { success: false, error: message }
    }
  }, [mutate])

  // Send confirmation email for a booking
  const sendConfirmation = useCallback(async (bookingId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_confirmation', bookingId })
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await mutate()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email'
      return { success: false, error: message }
    }
  }, [mutate])

  // Delete an email log
  const deleteEmail = useCallback(async (emailLogId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/emails/${emailLogId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        return { success: false, error: result.error }
      }

      await mutate()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete email'
      return { success: false, error: message }
    }
  }, [mutate])

  // Update filters (reset to page 1)
  const updateFilters = useCallback((newFilters: EmailFilters) => {
    setFiltersState(newFilters)
    setPageState(1)
  }, [])

  // Set page
  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
  }, [])

  return {
    emails,
    loading: isLoading,
    error: error ? 'Erreur lors du chargement des emails' : null,
    pagination,
    filters,
    setFilters: updateFilters,
    setPage,
    refresh: async () => { await mutate() },
    resendEmail,
    sendConfirmation,
    deleteEmail,
    stats
  }
}
