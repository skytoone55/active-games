'use client'

import { useState, useCallback } from 'react'
import type { Contact, ContactStatus, ContactSource } from '@/lib/supabase/types'

export interface SearchContactsParams {
  query?: string
  branchId: string | null
  includeArchived?: boolean
  status?: 'active' | 'archived'
  source?: 'admin_agenda' | 'public_booking'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface SearchContactsResult {
  contacts: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateContactData {
  branch_id_main: string
  first_name: string
  last_name?: string | null
  phone: string
  email?: string | null
  notes_client?: string | null
  alias?: string | null
  source?: ContactSource
}

export interface UpdateContactData extends Partial<CreateContactData> {
  status?: ContactStatus
  archived_reason?: string | null
}

/**
 * Hook pour gérer les contacts via les routes API
 * IMPORTANT: Toutes les opérations passent par /api/contacts pour garantir
 * les vérifications de permissions et le logging des actions
 */
export function useContacts(branchId: string | null) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Rechercher des contacts (avec pagination server-side)
  const searchContacts = useCallback(async (params: SearchContactsParams): Promise<SearchContactsResult> => {
    if (!params.branchId) {
      return { contacts: [], total: 0, page: params.page || 1, pageSize: params.pageSize || 50, totalPages: 0 }
    }

    setLoading(true)
    setError(null)

    try {
      // Construire les query params
      const queryParams = new URLSearchParams()
      queryParams.set('branchId', params.branchId)
      if (params.query) queryParams.set('query', params.query)
      if (params.status) queryParams.set('status', params.status)
      if (params.includeArchived) queryParams.set('includeArchived', 'true')
      if (params.source) queryParams.set('source', params.source)
      if (params.dateFrom) queryParams.set('dateFrom', params.dateFrom)
      if (params.dateTo) queryParams.set('dateTo', params.dateTo)
      if (params.page) queryParams.set('page', String(params.page))
      if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))

      const response = await fetch(`/api/contacts?${queryParams.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la recherche des contacts')
      }

      return {
        contacts: data.contacts || [],
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || 50,
        totalPages: data.totalPages || 0,
      }
    } catch (err) {
      console.error('Error searching contacts:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la recherche des contacts'
      setError(errorMessage)
      return { contacts: [], total: 0, page: params.page || 1, pageSize: params.pageSize || 50, totalPages: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  // Créer un contact
  const createContact = useCallback(async (data: CreateContactData): Promise<Contact | null> => {
    setError(null)

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création du contact')
      }

      return result.contact
    } catch (err) {
      console.error('Error creating contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la création du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Obtenir un contact par ID
  const getContact = useCallback(async (contactId: string): Promise<Contact | null> => {
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la récupération du contact')
      }

      return data.contact
    } catch (err) {
      console.error('Error fetching contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la récupération du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Mettre à jour un contact
  const updateContact = useCallback(async (contactId: string, data: UpdateContactData): Promise<Contact | null> => {
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour du contact')
      }

      return result.contact
    } catch (err) {
      console.error('Error updating contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Archiver un contact (soft delete)
  const archiveContact = useCallback(async (contactId: string, reason?: string): Promise<boolean> => {
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'archived',
          archived_reason: reason || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'archivage du contact')
      }

      return true
    } catch (err) {
      console.error('Error archiving contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'archivage du contact'
      setError(errorMessage)
      return false
    }
  }, [])

  // Restaurer un contact archivé
  const unarchiveContact = useCallback(async (contactId: string): Promise<boolean> => {
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la restauration du contact')
      }

      return true
    } catch (err) {
      console.error('Error unarchiving contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la restauration du contact'
      setError(errorMessage)
      return false
    }
  }, [])

  // Vérifier les doublons (phone ou email) - via API
  const checkDuplicates = useCallback(async (phone: string, email: string | null, excludeContactId?: string): Promise<{ phoneMatches: Contact[]; emailMatches: Contact[] }> => {
    if (!branchId) {
      return { phoneMatches: [], emailMatches: [] }
    }

    try {
      const queryParams = new URLSearchParams()
      queryParams.set('branchId', branchId)
      queryParams.set('checkDuplicates', 'true')
      queryParams.set('phone', phone.trim())
      if (email) queryParams.set('email', email.trim())
      if (excludeContactId) queryParams.set('excludeId', excludeContactId)

      const response = await fetch(`/api/contacts?${queryParams.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('Error checking duplicates:', data.error)
        return { phoneMatches: [], emailMatches: [] }
      }

      return {
        phoneMatches: data.phoneMatches || [],
        emailMatches: data.emailMatches || [],
      }
    } catch (err) {
      console.error('Error checking duplicates:', err)
      return { phoneMatches: [], emailMatches: [] }
    }
  }, [branchId])

  // Récupérer les réservations liées à un contact - via API
  const getLinkedBookings = useCallback(async (contactId: string) => {
    if (!branchId) {
      return []
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}/bookings?branchId=${branchId}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('Error fetching linked bookings:', data.error)
        return []
      }

      return data.bookings || []
    } catch (err) {
      console.error('Error fetching linked bookings:', err)
      return []
    }
  }, [branchId])

  // Statistiques d'un contact - via API
  const getContactStats = useCallback(async (contactId: string) => {
    if (!branchId) {
      return null
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}/stats?branchId=${branchId}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('Error fetching contact stats:', data.error)
        return null
      }

      return data.stats || null
    } catch (err) {
      console.error('Error fetching contact stats:', err)
      return null
    }
  }, [branchId])

  return {
    contacts,
    loading,
    error,
    searchContacts,
    createContact,
    getContact,
    updateContact,
    archiveContact,
    unarchiveContact,
    checkDuplicates,
    getLinkedBookings,
    getContactStats,
  }
}
