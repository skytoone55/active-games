'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
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

      // Filtrer par status
      if (params.status) {
        query = query.eq('status', params.status)
      } else if (!params.includeArchived) {
        query = query.eq('status', 'active')
      }

      // Filtrer par source
      if (params.source) {
        query = query.eq('source', params.source)
      }

      // Filtrer par date de création
      if (params.dateFrom) {
        query = query.gte('created_at', params.dateFrom)
      }
      if (params.dateTo) {
        query = query.lte('created_at', params.dateTo + 'T23:59:59')
      }

      // Recherche multi-champs si query fourni
      if (params.query && params.query.trim().length > 0) {
        const searchQuery = params.query.trim()
        // Utiliser or() avec la syntaxe correcte pour Supabase
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }

      // Tri (sera géré côté client pour l'instant, mais on garde un tri par défaut)
      query = query.order('created_at', { ascending: false })

      // Pagination
      query = query.range(from, to)

      const { data, error: searchError, count } = await query

      if (searchError) {
        console.error('Supabase search error:', searchError)
        throw new Error(searchError.message || 'Erreur lors de la recherche')
      }

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
      // Améliorer l'affichage de l'erreur
      let errorMessage = 'Erreur lors de la recherche des contacts'
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (err && typeof err === 'object') {
        // Si c'est un objet d'erreur Supabase
        if ('message' in err) {
          errorMessage = String(err.message)
        } else {
          errorMessage = JSON.stringify(err)
        }
      }
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

      // @ts-ignore - Supabase typing issue with dynamic updates
      const query = supabase.from('contacts') as any
      const { data: updatedContact, error: updateError } = await query
        .update(updateData)
        .eq('id', contactId)
        .select()
        .single()

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
      // @ts-ignore - Supabase typing issue with dynamic updates
      const archiveQuery = supabase.from('contacts') as any
      const { error: archiveError } = await archiveQuery
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_reason: reason?.trim() || null,
          updated_at: new Date().toISOString(),
        })
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
      // @ts-ignore - Supabase typing issue with dynamic updates
      const unarchiveQuery = supabase.from('contacts') as any
      const { error: unarchiveError } = await unarchiveQuery
        .update({
          status: 'active',
          archived_at: null,
          archived_reason: null,
          updated_at: new Date().toISOString(),
        })
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

      const bookingIds = (bookingContacts as any[]).map((bc: any) => bc.booking_id)

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

  // Statistiques d'un contact
  const getContactStats = useCallback(async (contactId: string) => {
    if (!branchId) {
      return null
    }

    const supabase = getClient()

    try {
      // Récupérer les réservations liées
      const { data: bookingContacts, error: bookingContactsError } = await supabase
        .from('booking_contacts')
        .select('booking_id')
        .eq('contact_id', contactId)

      if (bookingContactsError) throw bookingContactsError

      if (!bookingContacts || bookingContacts.length === 0) {
        return {
          totalBookings: 0,
          totalParticipants: 0,
          upcomingBookings: 0,
          pastBookings: 0,
          lastActivity: null,
          firstBooking: null,
          gameBookings: 0,
          eventBookings: 0,
        }
      }

      const bookingIds = (bookingContacts as any[]).map((bc: any) => bc.booking_id)
      const now = new Date().toISOString()

      // Récupérer les bookings avec stats
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, type, status, start_datetime, participants_count, created_at')
        .in('id', bookingIds)
        .eq('branch_id', branchId)

      if (bookingsError) throw bookingsError

      const bookingsList = (bookings || []) as any[]
      const totalBookings = bookingsList.length
      const totalParticipants = bookingsList.reduce((sum: number, b: any) => sum + (b.participants_count || 0), 0)
      
      const upcomingBookings = bookingsList.filter((b: any) => b.start_datetime > now && b.status !== 'CANCELLED').length
      const pastBookings = bookingsList.filter((b: any) => b.start_datetime <= now || b.status === 'CANCELLED').length
      
      const gameBookings = bookingsList.filter((b: any) => b.type === 'GAME').length
      const eventBookings = bookingsList.filter((b: any) => b.type === 'EVENT').length

      // Dernière activité (dernière réservation)
      const sortedByDate = [...bookingsList].sort((a: any, b: any) => 
        new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
      )
      const lastActivity = sortedByDate.length > 0 ? sortedByDate[0].start_datetime : null
      
      // Première réservation
      const sortedByCreated = [...bookingsList].sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const firstBooking = sortedByCreated.length > 0 ? sortedByCreated[0].created_at : null

      return {
        totalBookings,
        totalParticipants,
        upcomingBookings,
        pastBookings,
        lastActivity,
        firstBooking,
        gameBookings,
        eventBookings,
      }
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
