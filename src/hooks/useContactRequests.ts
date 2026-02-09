'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ContactRequest } from '@/lib/supabase/types'

interface UseContactRequestsReturn {
  requests: ContactRequest[]
  loading: boolean
  error: string | null
  total: number
  totalPages: number
  unreadCount: number
  fetchRequests: (params?: {
    status?: 'all' | 'unread' | 'read'
    page?: number
    pageSize?: number
  }) => Promise<void>
  fetchUnreadCount: () => Promise<number>
  markAsRead: (id: string) => Promise<boolean>
  createContactFromRequest: (requestId: string, branchId: string) => Promise<boolean>
}

export function useContactRequests(branchId: string | null): UseContactRequestsReturn {
  const [requests, setRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)

  // Track branchId to prevent stale closures
  const branchIdRef = useRef(branchId)
  branchIdRef.current = branchId

  // Fetch unread count
  const fetchUnreadCount = useCallback(async (): Promise<number> => {
    if (!branchIdRef.current) return 0

    try {
      const response = await fetch(
        `/api/contact-requests?branchId=${branchIdRef.current}&countOnly=true`
      )
      const data = await response.json()
      if (data.success) {
        setUnreadCount(data.unreadCount)
        return data.unreadCount
      }
      return 0
    } catch {
      return 0
    }
  }, [])

  // Fetch contact requests list
  const fetchRequests = useCallback(async (params?: {
    status?: 'all' | 'unread' | 'read'
    page?: number
    pageSize?: number
  }) => {
    if (!branchIdRef.current) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams({
        branchId: branchIdRef.current,
        status: params?.status || 'all',
        page: String(params?.page || 1),
        pageSize: String(params?.pageSize || 20),
      })

      const response = await fetch(`/api/contact-requests?${queryParams}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.requests)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } else {
        setError(data.error || 'Failed to fetch requests')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Mark a request as read
  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/contact-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })

      const data = await response.json()
      if (data.success) {
        // Update local state
        setRequests(prev =>
          prev.map(r => r.id === id ? { ...r, is_read: true, read_at: new Date().toISOString() } : r)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Create a contact from a request then mark as read and link
  const createContactFromRequest = useCallback(async (requestId: string, branchId: string): Promise<boolean> => {
    const request = requests.find(r => r.id === requestId)
    if (!request) return false

    // Empêcher la création en double si contact déjà lié
    if (request.contact_id) return false

    try {
      // Parse name into first/last
      const nameParts = request.name.trim().split(/\s+/)
      const firstName = nameParts[0] || request.name
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

      // Create the contact
      const contactResponse = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id_main: branchId,
          first_name: firstName,
          last_name: lastName,
          phone: request.phone || '0500000000',
          email: request.email,
          source: 'website',
          notes_client: request.message,
        }),
      })

      const contactData = await contactResponse.json()
      if (!contactData.success || !contactData.contact) {
        return false
      }

      // Link contact to request + mark as read
      const updateResponse = await fetch(`/api/contact-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_read: true,
          contact_id: contactData.contact.id,
        }),
      })

      const updateData = await updateResponse.json()
      if (updateData.success) {
        setRequests(prev =>
          prev.map(r => r.id === requestId ? {
            ...r,
            is_read: true,
            read_at: new Date().toISOString(),
            contact_id: contactData.contact.id,
          } : r)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        return true
      }
      return false
    } catch {
      return false
    }
  }, [requests])

  // Auto-fetch unread count on mount and periodically
  useEffect(() => {
    if (!branchId) return

    fetchUnreadCount()

    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [branchId, fetchUnreadCount])

  return {
    requests,
    loading,
    error,
    total,
    totalPages,
    unreadCount,
    fetchRequests,
    fetchUnreadCount,
    markAsRead,
    createContactFromRequest,
  }
}

/**
 * Hook léger uniquement pour le compteur de demandes non lues (pour le header)
 */
export function useUnreadContactRequestsCount(branchId: string | null): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!branchId) {
      setCount(0)
      return
    }

    const fetchCount = async () => {
      try {
        const response = await fetch(
          `/api/contact-requests?branchId=${branchId}&countOnly=true`
        )
        const data = await response.json()
        if (data.success) {
          setCount(data.unreadCount)
        }
      } catch {
        // Silently fail
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [branchId])

  return count
}
