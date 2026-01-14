'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { Contact, ContactStatus, ContactSource } from '@/lib/supabase/types'

export interface SearchContactsParams {
  query?: string
  branchId: string | null
  includeArchived?: boolean
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

export function useContacts(branchId: string | null) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Rechercher des contacts (avec pagination server-side)
  const searchContacts = useCallback(async (params: SearchContactsParams): Promise<SearchContactsResult> => {
    if (!params.branchId) {
      return { contacts: [], total: 0, page: params.page || 1, pageSize: params.pageSize || 50, totalPages: 0 }
    }

    const supabase = getClient()
    setLoading(true)
    setError(null)

    try {
      const page = params.page || 1
      const pageSize = params.pageSize || 50
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      // Construire la requête de base
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('branch_id_main', params.branchId)

      // Filtrer par status si includeArchived = false
      if (!params.includeArchived) {
        query = query.eq('status', 'active')
      }

      // Recherche multi-champs si query fourni
      if (params.query && params.query.trim().length > 0) {
        const searchQuery = params.query.trim()
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }

      // Tri par défaut : plus récents
      query = query.order('created_at', { ascending: false })

      // Pagination
      query = query.range(from, to)

      const { data, error: searchError, count } = await query.returns<Contact[]>()

      if (searchError) throw searchError

      const contactsList = data || []
      const total = count || 0
      const totalPages = Math.ceil(total / pageSize)

      return {
        contacts: contactsList,
        total,
        page,
        pageSize,
        totalPages,
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
    const supabase = getClient()
    setError(null)

    try {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          branch_id_main: data.branch_id_main,
          first_name: data.first_name.trim(),
          last_name: data.last_name?.trim() || null,
          phone: data.phone.trim(),
          email: data.email?.trim() || null,
          notes_client: data.notes_client?.trim() || null,
          alias: data.alias?.trim() || null,
          source: data.source || 'admin_agenda',
          status: 'active',
        } as any)
        .select()
        .single<Contact>()

      if (createError) throw createError

      return newContact
    } catch (err) {
      console.error('Error creating contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la création du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Obtenir un contact par ID
  const getContact = useCallback(async (contactId: string): Promise<Contact | null> => {
    const supabase = getClient()
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single<Contact>()

      if (fetchError) throw fetchError

      return data
    } catch (err) {
      console.error('Error fetching contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la récupération du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Mettre à jour un contact
  const updateContact = useCallback(async (contactId: string, data: UpdateContactData): Promise<Contact | null> => {
    const supabase = getClient()
    setError(null)

    try {
      const updateData: Record<string, unknown> = {}

      if (data.first_name !== undefined) updateData.first_name = data.first_name.trim()
      if (data.last_name !== undefined) updateData.last_name = data.last_name?.trim() || null
      if (data.phone !== undefined) updateData.phone = data.phone.trim()
      if (data.email !== undefined) updateData.email = data.email?.trim() || null
      if (data.notes_client !== undefined) updateData.notes_client = data.notes_client?.trim() || null
      if (data.alias !== undefined) updateData.alias = data.alias?.trim() || null
      if (data.source !== undefined) updateData.source = data.source
      if (data.status !== undefined) {
        updateData.status = data.status
        // Si on archive, mettre archived_at
        if (data.status === 'archived') {
          updateData.archived_at = new Date().toISOString()
          if (data.archived_reason !== undefined) {
            updateData.archived_reason = data.archived_reason?.trim() || null
          }
        } else if (data.status === 'active') {
          // Si on restaure, effacer archived_at
          updateData.archived_at = null
          updateData.archived_reason = null
        }
      }

      // Toujours mettre à jour updated_at (via trigger, mais on peut le faire explicitement)
      updateData.updated_at = new Date().toISOString()

      const { data: updatedContact, error: updateError } = await supabase
        .from('contacts')
        .update(updateData as any)
        .eq('id', contactId)
        .select()
        .single<Contact>()

      if (updateError) throw updateError

      return updatedContact
    } catch (err) {
      console.error('Error updating contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du contact'
      setError(errorMessage)
      return null
    }
  }, [])

  // Archiver un contact (soft delete)
  const archiveContact = useCallback(async (contactId: string, reason?: string): Promise<boolean> => {
    const supabase = getClient()
    setError(null)

    try {
      const { error: archiveError } = await supabase
        .from('contacts')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_reason: reason?.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', contactId)

      if (archiveError) throw archiveError

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
    const supabase = getClient()
    setError(null)

    try {
      const { error: unarchiveError } = await supabase
        .from('contacts')
        .update({
          status: 'active',
          archived_at: null,
          archived_reason: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', contactId)

      if (unarchiveError) throw unarchiveError

      return true
    } catch (err) {
      console.error('Error unarchiving contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la restauration du contact'
      setError(errorMessage)
      return false
    }
  }, [])

  // Vérifier les doublons (phone ou email)
  const checkDuplicates = useCallback(async (phone: string, email: string | null, excludeContactId?: string): Promise<{ phoneMatches: Contact[]; emailMatches: Contact[] }> => {
    if (!branchId) {
      return { phoneMatches: [], emailMatches: [] }
    }

    const supabase = getClient()

    try {
      // Rechercher par phone
      let phoneQuery = supabase
        .from('contacts')
        .select('*')
        .eq('branch_id_main', branchId)
        .eq('phone', phone.trim())

      if (excludeContactId) {
        phoneQuery = phoneQuery.neq('id', excludeContactId)
      }

      const { data: phoneMatches } = await phoneQuery.returns<Contact[]>()

      // Rechercher par email (si fourni)
      let emailMatches: Contact[] = []
      if (email && email.trim()) {
        let emailQuery = supabase
          .from('contacts')
          .select('*')
          .eq('branch_id_main', branchId)
          .eq('email', email.trim())

        if (excludeContactId) {
          emailQuery = emailQuery.neq('id', excludeContactId)
        }

        const { data: emailData } = await emailQuery.returns<Contact[]>()
        emailMatches = emailData || []
      }

      return {
        phoneMatches: phoneMatches || [],
        emailMatches,
      }
    } catch (err) {
      console.error('Error checking duplicates:', err)
      return { phoneMatches: [], emailMatches: [] }
    }
  }, [branchId])

  // Récupérer les réservations liées à un contact
  const getLinkedBookings = useCallback(async (contactId: string) => {
    if (!branchId) {
      return []
    }

    const supabase = getClient()

    try {
      // Récupérer les réservations via booking_contacts
      const { data: bookingContacts, error: bookingContactsError } = await supabase
        .from('booking_contacts')
        .select('booking_id')
        .eq('contact_id', contactId)

      if (bookingContactsError) throw bookingContactsError

      if (!bookingContacts || bookingContacts.length === 0) {
        return []
      }

      const bookingIds = bookingContacts.map(bc => bc.booking_id)

      // Récupérer les bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, reference_code, type, status, start_datetime, end_datetime, participants_count, created_at')
        .in('id', bookingIds)
        .eq('branch_id', branchId)
        .order('start_datetime', { ascending: false })

      if (bookingsError) throw bookingsError

      return bookings || []
    } catch (err) {
      console.error('Error fetching linked bookings:', err)
      return []
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
  }
}
