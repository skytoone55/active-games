'use client'

import { useState, useCallback } from 'react'
import type { Call, CallStatus, CallDirection } from '@/lib/supabase/types'

export interface SearchCallsParams {
  branchId: string | null
  query?: string
  status?: CallStatus | 'all'
  direction?: CallDirection | 'all'
  page?: number
  pageSize?: number
}

export interface SearchCallsResult {
  calls: Call[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Hook pour gérer les appels téléphoniques via les routes API
 * Toutes les opérations passent par /api/calls
 */
export function useCalls(branchId: string | null) {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Rechercher des appels avec pagination
  const searchCalls = useCallback(async (params: SearchCallsParams): Promise<SearchCallsResult> => {
    if (!params.branchId) {
      return { calls: [], total: 0, page: params.page || 1, pageSize: params.pageSize || 20, totalPages: 0 }
    }

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      queryParams.set('branchId', params.branchId)
      if (params.query) queryParams.set('query', params.query)
      if (params.status && params.status !== 'all') queryParams.set('status', params.status)
      if (params.direction && params.direction !== 'all') queryParams.set('direction', params.direction)
      if (params.page) queryParams.set('page', String(params.page))
      if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))

      const response = await fetch(`/api/calls?${queryParams.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la recherche des appels')
      }

      return {
        calls: data.calls || [],
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || 20,
        totalPages: data.totalPages || 0,
      }
    } catch (err) {
      console.error('Error searching calls:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la recherche des appels'
      setError(errorMessage)
      return { calls: [], total: 0, page: params.page || 1, pageSize: params.pageSize || 20, totalPages: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    calls,
    loading,
    error,
    searchCalls,
  }
}
