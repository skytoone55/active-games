'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import {
  getCachedBookings,
  setCachedBookings,
  updateCachedBooking,
  removeCachedBooking,
  setLastSyncTime,
} from '@/lib/cache'
import type {
  Booking,
  BookingSlot,
  BookingType,
  Contact,
  GameSession,
  BookingUpdate,
  GameArea,
} from '@/lib/supabase/types'

// Type étendu avec les slots, contacts et game_sessions
export interface BookingWithSlots extends Booking {
  slots: BookingSlot[]
  game_sessions?: GameSession[]
  primaryContact?: Contact | null
  allContacts?: Contact[]
}

// Données pour créer une réservation
export interface CreateBookingData {
  branch_id: string
  type: BookingType
  start_datetime: string
  end_datetime: string
  game_start_datetime?: string
  game_end_datetime?: string
  participants_count: number
  event_room_id?: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  customer_email?: string
  customer_notes_at_booking?: string // Snapshot des notes client au moment de la réservation
  primary_contact_id?: string // ID du contact principal (CRM)
  notes?: string
  color?: string
  // Discount (remise)
  discount_type?: 'percent' | 'fixed' | null
  discount_value?: number | null
  slots: {
    slot_start: string
    slot_end: string
    participants_count: number
  }[]
  game_sessions?: {
    game_area: GameArea
    start_datetime: string
    end_datetime: string
    laser_room_id?: string | null
    session_order: number
    pause_before_minutes: number
  }[]
  // Pour réactiver une commande annulée
  reactivateOrderId?: string
  reactivateReference?: string // Référence à réutiliser
  // Langue préférée du contact pour les emails
  locale?: 'he' | 'fr' | 'en'
}

export function useBookings(branchId: string | null, date?: string) {
  const [bookings, setBookings] = useState<BookingWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastFetchKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)
  const initialCacheLoadedRef = useRef(false)

  // Charger depuis le cache au démarrage (affichage instantané)
  useEffect(() => {
    if (!branchId || !date || initialCacheLoadedRef.current) return

    const cached = getCachedBookings(branchId, date)
    if (cached && cached.length > 0) {
      setBookings(cached)
      setLoading(false) // Affichage instantané !
      initialCacheLoadedRef.current = true
    }
  }, [branchId, date])

  // Charger les réservations
  const fetchBookings = useCallback(async (force = false) => {
    if (!branchId) {
      setBookings([])
      setLoading(false)
      return
    }

    // Éviter les appels concurrents — but auto-release after 15s to prevent infinite lock
    if (isFetchingRef.current && !force) {
      return
    }

    const supabase = getClient()
    isFetchingRef.current = true

    // Safety: auto-release lock after 15 seconds to prevent infinite spinner
    const lockTimeout = setTimeout(() => {
      if (isFetchingRef.current) {
        console.warn('[useBookings] Fetch lock auto-released after 15s timeout')
        isFetchingRef.current = false
        setLoading(false)
      }
    }, 15000)

    // Ne montrer le loading que si pas de cache
    const cached = date ? getCachedBookings(branchId, date) : null
    if (!cached || cached.length === 0) {
      setLoading(true)
    }
    setError(null)

    try {
      // Construire la requête
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('branch_id', branchId)
        .neq('status', 'CANCELLED')
        .order('start_datetime', { ascending: true })

      // Filtrer par date si fournie
      if (date) {
        const startOfDay = `${date}T00:00:00.000Z`
        const endOfDay = `${date}T23:59:59.999Z`
        query = query
          .gte('start_datetime', startOfDay)
          .lte('start_datetime', endOfDay)
      }

      const { data: bookingsData, error: bookingsError } = await query.returns<Booking[]>()

      if (bookingsError) throw bookingsError

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      // Charger les slots et game_sessions pour chaque booking
      const bookingIds = bookingsData.map(b => b.id)
      const [slotsResult, sessionsResult] = await Promise.all([
        supabase
          .from('booking_slots')
          .select('*')
          .in('booking_id', bookingIds)
          .order('slot_start')
          .returns<BookingSlot[]>(),
        supabase
          .from('game_sessions')
          .select('*')
          .in('booking_id', bookingIds)
          .order('session_order')
          .returns<GameSession[]>()
      ])

      const { data: slotsData, error: slotsError } = slotsResult
      const { data: sessionsData, error: sessionsError } = sessionsResult
      
      // Gérer les erreurs silencieusement si les tables n'existent pas encore
      if (slotsError) {
        console.warn('Error loading slots (table may not exist yet):', slotsError)
      }
      if (sessionsError) {
        // Code 42P01 = table does not exist
        if (sessionsError.code === '42P01' || sessionsError.message?.includes('does not exist') || sessionsError.message?.includes('n\'existe pas')) {
          console.warn('Table game_sessions does not exist yet. Please run migration 006_add_laser_support.sql')
        } else {
          console.warn('Error loading game_sessions:', sessionsError)
        }
      }

      // CRM: Charger les contacts liés pour chaque booking
      const { data: bookingContactsData } = await supabase
        .from('booking_contacts')
        .select('*, contact:contacts(*)')
        .in('booking_id', bookingIds)

      // Créer un map des contacts par booking_id
      const contactsByBooking = new Map<string, { primary: Contact | null; all: Contact[] }>()

      interface BookingContactRow {
        booking_id: string
        contact_id: string
        is_primary: boolean
        role: string | null
        contact: Contact | null
      }

      (bookingContactsData as BookingContactRow[] | null)?.forEach((bc) => {
        if (!bc.contact) return

        const contact = bc.contact
        const bookingId = bc.booking_id

        if (!contactsByBooking.has(bookingId)) {
          contactsByBooking.set(bookingId, { primary: null, all: [] })
        }

        const contacts = contactsByBooking.get(bookingId)!
        contacts.all.push(contact)

        if (bc.is_primary) {
          contacts.primary = contact
        }
      })

      // Charger les contacts principaux via primary_contact_id (fallback pour anciennes données)
      const primaryContactIds = bookingsData
        .filter(b => b.primary_contact_id && !contactsByBooking.has(b.id))
        .map(b => b.primary_contact_id!)

      let primaryContactsMap = new Map<string, Contact>()
      if (primaryContactIds.length > 0) {
        const { data: primaryContactsData } = await supabase
          .from('contacts')
          .select('*')
          .in('id', primaryContactIds)
          .eq('status', 'active')
          .returns<Contact[]>()

        primaryContactsData?.forEach(contact => {
          primaryContactsMap.set(contact.id, contact)
        })
      }

      // Associer les slots, game_sessions et contacts à chaque booking
      const bookingsWithSlots: BookingWithSlots[] = bookingsData.map(booking => {
        const slots = slotsData?.filter(s => s.booking_id === booking.id) || []
        const game_sessions = sessionsData?.filter(s => s.booking_id === booking.id) || []
        const contacts = contactsByBooking.get(booking.id)
        
        // Contact principal : depuis booking_contacts en priorité, sinon depuis primary_contact_id
        let primaryContact: Contact | null = null
        if (contacts?.primary) {
          primaryContact = contacts.primary
        } else if (booking.primary_contact_id) {
          primaryContact = primaryContactsMap.get(booking.primary_contact_id) || null
        }

        return {
          ...booking,
          slots,
          game_sessions,
          primaryContact,
          allContacts: contacts?.all || (primaryContact ? [primaryContact] : []),
        }
      })

      setBookings(bookingsWithSlots)

      // Sauvegarder en cache pour affichage instantané au prochain chargement
      if (date && branchId) {
        setCachedBookings(branchId, date, bookingsWithSlots)
        setLastSyncTime(branchId)
      }
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError('Erreur lors du chargement des réservations')
    } finally {
      clearTimeout(lockTimeout)
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [branchId, date])

  // Charger quand branchId ou date change (avec déduplication)
  useEffect(() => {
    const fetchKey = `${branchId || ''}-${date || ''}`
    if (fetchKey === lastFetchKeyRef.current) {
      return
    }
    lastFetchKeyRef.current = fetchKey
    fetchBookings()
  }, [branchId, date, fetchBookings])

  // Realtime: écouter les changements sur bookings et game_sessions
  // Remplace le polling de 30 secondes - mise à jour instantanée
  useRealtimeRefresh(
    'bookings',
    branchId,
    fetchBookings,
    ['game_sessions', 'booking_slots'] // Tables liées qui déclenchent aussi un refresh
  )

  // Créer une réservation via l'API (garantit les logs et l'email)
  const createBooking = useCallback(async (data: CreateBookingData): Promise<BookingWithSlots | null> => {
    setError(null)

    try {
      // Appeler l'API qui gère tout : création, logs, email
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch_id: data.branch_id,
          type: data.type,
          start_datetime: data.start_datetime,
          end_datetime: data.end_datetime,
          game_start_datetime: data.game_start_datetime,
          game_end_datetime: data.game_end_datetime,
          participants_count: data.participants_count,
          event_room_id: data.event_room_id,
          customer_first_name: data.customer_first_name,
          customer_last_name: data.customer_last_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          customer_notes_at_booking: data.customer_notes_at_booking,
          primary_contact_id: data.primary_contact_id,
          notes: data.notes,
          color: data.color,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          reactivateReference: data.reactivateReference,
          reactivateOrderId: data.reactivateOrderId,
          slots: data.slots,
          game_sessions: data.game_sessions,
          locale: data.locale || 'he', // Langue préférée du contact pour l'email
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        // Erreur de validation (400) = erreur métier, pas une erreur technique
        // On affiche le message à l'utilisateur sans console.error pour éviter l'overlay Next.js
        const errorMessage = result.error || 'Failed to create booking'
        setError(errorMessage)
        return null
      }

      // Rafraîchir la liste
      await fetchBookings()

      return result.booking as BookingWithSlots
    } catch (err: unknown) {
      // Vraie erreur technique (réseau, etc.)
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err)
      console.error('Error creating booking:', errorMessage, err)
      setError(`Erreur technique: ${errorMessage}`)
      return null
    }
  }, [fetchBookings])

  // Mettre à jour une réservation (via API route pour permissions et logging)
  const updateBooking = useCallback(async (
    id: string,
    data: Partial<CreateBookingData>
  ): Promise<BookingWithSlots | null> => {
    setError(null)

    try {
      // Construire le body pour l'API
      const apiBody: Record<string, unknown> = {}

      if (data.type !== undefined) apiBody.type = data.type
      if (data.branch_id !== undefined) apiBody.branch_id = data.branch_id
      if (data.start_datetime !== undefined) apiBody.start_datetime = data.start_datetime
      if (data.end_datetime !== undefined) apiBody.end_datetime = data.end_datetime
      if (data.game_start_datetime !== undefined) apiBody.game_start_datetime = data.game_start_datetime
      if (data.game_end_datetime !== undefined) apiBody.game_end_datetime = data.game_end_datetime
      if (data.participants_count !== undefined) apiBody.participants_count = data.participants_count
      if (data.event_room_id !== undefined) apiBody.event_room_id = data.event_room_id
      if (data.customer_first_name !== undefined) apiBody.customer_first_name = data.customer_first_name
      if (data.customer_last_name !== undefined) apiBody.customer_last_name = data.customer_last_name
      if (data.customer_phone !== undefined) apiBody.customer_phone = data.customer_phone
      if (data.customer_email !== undefined) apiBody.customer_email = data.customer_email
      if (data.notes !== undefined) apiBody.notes = data.notes
      if (data.color !== undefined) apiBody.color = data.color
      if (data.discount_type !== undefined) apiBody.discount_type = data.discount_type
      if (data.discount_value !== undefined) apiBody.discount_value = data.discount_value
      if (data.primary_contact_id !== undefined) apiBody.primary_contact_id = data.primary_contact_id
      if (data.slots !== undefined) apiBody.slots = data.slots
      if (data.game_sessions !== undefined) apiBody.game_sessions = data.game_sessions

      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody)
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'Failed to update booking'
        setError(errorMsg)
        return null
      }

      await fetchBookings()
      return result.booking as BookingWithSlots
    } catch (err) {
      console.error('Error updating booking:', err)
      setError('Erreur lors de la mise à jour de la réservation')
      return null
    }
  }, [fetchBookings])

  // Annuler une réservation (via API route pour permissions et logging)
  const cancelBooking = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    setError(null)

    try {
      const url = new URL(`/api/bookings/${id}`, window.location.origin)
      if (reason) url.searchParams.set('reason', reason)

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Erreur lors de l\'annulation')
        return false
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error cancelling booking:', err)
      setError('Erreur lors de l\'annulation de la réservation')
      return false
    }
  }, [fetchBookings])

  // Supprimer définitivement une réservation (via API route pour permissions et logging)
  const deleteBooking = useCallback(async (id: string): Promise<boolean> => {
    setError(null)

    try {
      const url = new URL(`/api/bookings/${id}`, window.location.origin)
      url.searchParams.set('hard', 'true')

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Erreur lors de la suppression')
        return false
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error deleting booking:', err)
      setError('Erreur lors de la suppression de la réservation')
      return false
    }
  }, [fetchBookings])

  // Supprimer toutes les réservations (pour remettre le système à zéro)
  const deleteAllBookings = useCallback(async (): Promise<boolean> => {
    const supabase = getClient()
    setError(null)

    try {
      if (!branchId) {
        setError('Aucune branche sélectionnée')
        return false
      }

      // Supprimer toutes les réservations de la branche
      // Les slots seront supprimés automatiquement grâce à ON DELETE CASCADE
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('branch_id', branchId)

      if (deleteError) throw deleteError

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error deleting all bookings:', err)
      setError('Erreur lors de la suppression de toutes les réservations')
      return false
    }
  }, [branchId, fetchBookings])

  return {
    bookings,
    loading,
    error,
    createBooking,
    updateBooking,
    cancelBooking,
    deleteBooking,
    deleteAllBookings,
    refresh: fetchBookings,
  }
}
