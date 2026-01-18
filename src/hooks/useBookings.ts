'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import type {
  Booking,
  BookingSlot,
  BookingType,
  BookingStatus,
  Contact,
  GameSession,
  Order,
  BookingInsert,
  BookingSlotInsert,
  BookingContactInsert,
  GameSessionInsert,
  OrderInsert,
  OrderUpdate,
  BookingUpdate,
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
  slots: {
    slot_start: string
    slot_end: string
    participants_count: number
  }[]
  game_sessions?: {
    game_area: 'ACTIVE' | 'LASER'
    start_datetime: string
    end_datetime: string
    laser_room_id?: string | null
    session_order: number
    pause_before_minutes: number
  }[]
  // Pour réactiver une commande annulée
  reactivateOrderId?: string
  reactivateReference?: string // Référence à réutiliser
}

// Générer un code de référence unique (max 10 caractères pour varchar(10))
function generateReferenceCode(): string {
  // Format: 6 caractères aléatoires en base36 = 2.176 milliards de combinaisons
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return random
}

export function useBookings(branchId: string | null, date?: string) {
  const [bookings, setBookings] = useState<BookingWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les réservations
  const fetchBookings = useCallback(async () => {
    if (!branchId) {
      setBookings([])
      setLoading(false)
      return
    }

    const supabase = getClient()
    setLoading(true)
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
      
      bookingContactsData?.forEach((bc: any) => {
        if (!bc.contact) return
        
        const contact = bc.contact as Contact
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
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError('Erreur lors du chargement des réservations')
    } finally {
      setLoading(false)
    }
  }, [branchId, date])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Realtime: écouter les changements sur bookings et game_sessions
  // Remplace le polling de 30 secondes - mise à jour instantanée
  useRealtimeRefresh(
    'bookings',
    branchId,
    fetchBookings,
    ['game_sessions', 'booking_slots'] // Tables liées qui déclenchent aussi un refresh
  )

  // Créer une réservation
  const createBooking = useCallback(async (data: CreateBookingData): Promise<BookingWithSlots | null> => {
    const supabase = getClient()
    setError(null)

    try {
      // Créer le booking
      const insertData: Record<string, unknown> = {
        branch_id: data.branch_id,
        type: data.type,
        status: 'CONFIRMED' as BookingStatus,
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
        reference_code: data.reactivateReference || generateReferenceCode(), // Utiliser la ref fournie si réactivation
        notes: data.notes,
      }
      
      // Couleur activée - la colonne existe dans la base de données
      if (data.color !== undefined && data.color !== null && data.color !== '') {
        insertData.color = data.color
      }
      
      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        // @ts-expect-error - Supabase SSR typing limitation with insert
        .insert(insertData as BookingInsert)
        .select()
        .single<Booking>()

      if (bookingError) {
        // Log complet de l'erreur
        console.error('Booking insert error - Raw error:', bookingError)
        console.error('Booking insert error - Type:', typeof bookingError)
        console.error('Booking insert error - Keys:', Object.keys(bookingError))
        console.error('Booking insert error details:', {
          message: bookingError.message,
          code: bookingError.code,
          details: bookingError.details,
          hint: bookingError.hint,
        })
        console.error('Full error object (JSON):', JSON.stringify(bookingError, null, 2))
        console.error('Insert data that was sent:', JSON.stringify(insertData, null, 2))
        
        // L'erreur vient d'autre chose (la colonne color existe maintenant)
        const errorMessage = bookingError.message || 'Unknown error'
        const errorCode = bookingError.code || 'unknown'
        throw new Error(`Supabase booking error: ${errorMessage} (code: ${errorCode})`)
      }

      // CRM: Créer la liaison booking_contacts si primary_contact_id existe
      if (data.primary_contact_id) {
        const { error: bookingContactError } = await supabase
          .from('booking_contacts')
          // @ts-expect-error - Supabase SSR typing limitation with insert
          .insert({
            booking_id: newBooking.id,
            contact_id: data.primary_contact_id,
            is_primary: true,
            role: null,
          } as BookingContactInsert)

        if (bookingContactError) {
          console.error('Booking contact link error:', bookingContactError)
          // Ne pas bloquer la création si la liaison échoue
        }
      }

      // Créer les slots
      let newSlots: BookingSlot[] = []
      if (data.slots.length > 0) {
        const slotsToInsert = data.slots.map(slot => ({
          booking_id: newBooking.id,
          branch_id: data.branch_id,
          slot_start: slot.slot_start,
          slot_end: slot.slot_end,
          participants_count: slot.participants_count,
          slot_type: 'game_zone',
        }))

        const { data: insertedSlots, error: slotsError } = await supabase
          .from('booking_slots')
          // @ts-expect-error - Supabase SSR typing limitation with insert
          .insert(slotsToInsert as BookingSlotInsert[])
          .select()
          .returns<BookingSlot[]>()

        if (slotsError) {
          console.error('Slots insert error details:', {
            message: slotsError.message,
            code: slotsError.code,
            details: slotsError.details,
            hint: slotsError.hint,
          })
          throw new Error(`Supabase slots error: ${slotsError.message} (code: ${slotsError.code})`)
        }

        newSlots = insertedSlots || []
      }

      // Créer les game_sessions
      let newSessions: GameSession[] = []
      if (data.game_sessions && data.game_sessions.length > 0) {
        const sessionsToInsert = data.game_sessions.map(session => ({
          booking_id: newBooking.id,
          game_area: session.game_area,
          start_datetime: session.start_datetime,
          end_datetime: session.end_datetime,
          laser_room_id: session.laser_room_id || null,
          session_order: session.session_order,
          pause_before_minutes: session.pause_before_minutes,
        }))

        const { data: insertedSessions, error: sessionsError } = await supabase
          .from('game_sessions')
          // @ts-expect-error - Supabase SSR typing limitation with insert
          .insert(sessionsToInsert as GameSessionInsert[])
          .select()
          .returns<GameSession[]>()

        if (sessionsError) {
          console.error('Game sessions insert error details:', {
            message: sessionsError.message,
            code: sessionsError.code,
            details: sessionsError.details,
            hint: sessionsError.hint,
          })
          throw new Error(`Supabase game_sessions error: ${sessionsError.message} (code: ${sessionsError.code})`)
        }

        newSessions = insertedSessions || []
      }

      // Synchroniser avec la section Commandes
      const bookingDate = new Date(data.start_datetime)
      
      if (data.reactivateOrderId) {
        // Réactivation: mettre à jour l'order existant
        const updateData = {
            booking_id: newBooking.id,
            status: 'manually_confirmed',
            requested_date: bookingDate.toISOString().split('T')[0],
            requested_time: bookingDate.toTimeString().slice(0, 5),
            participants_count: data.participants_count,
            customer_first_name: data.customer_first_name || 'Client',
            customer_last_name: data.customer_last_name || '',
            customer_phone: data.customer_phone || '0000000000',
            customer_email: data.customer_email || null,
            game_area: (newSessions.length > 0 ? newSessions[0].game_area : null) as 'ACTIVE' | 'LASER' | null,
            number_of_games: newSessions.length || 1,
            processed_at: new Date().toISOString(),
          }
        
        const { error: updateOrderError } = await supabase
          .from('orders')
          // @ts-expect-error - Supabase SSR typing limitation with update
          .update(updateData as OrderUpdate)
          .eq('id', data.reactivateOrderId)
        
        if (updateOrderError) {
          // Silent fail - order sync is not critical
        }
      } else {
        // Nouvelle création: créer une entrée dans orders
        const orderData = {
          branch_id: data.branch_id,
          booking_id: newBooking.id,
          contact_id: data.primary_contact_id || null,
          source: 'admin_agenda', // Source = admin car créé depuis l'agenda
          status: 'auto_confirmed',
          order_type: data.type, // 'GAME' ou 'EVENT'
          game_area: newSessions.length > 0 ? newSessions[0].game_area : null, // null pour Events
          number_of_games: newSessions.length || 1,
          requested_date: bookingDate.toISOString().split('T')[0],
          requested_time: bookingDate.toTimeString().slice(0, 5),
          participants_count: data.participants_count,
          customer_first_name: data.customer_first_name || 'Client',
          customer_last_name: data.customer_last_name || '',
          customer_phone: data.customer_phone || '0000000000',
          customer_email: data.customer_email || null,
          customer_notes: data.customer_notes_at_booking || null,
          request_reference: newBooking.reference_code, // Utiliser la même référence que le booking
          terms_accepted: true, // Automatiquement accepté car créé par admin
          terms_accepted_at: new Date().toISOString(),
        }

        const { error: orderError } = await supabase
          .from('orders')
          // @ts-expect-error - Supabase SSR typing limitation with insert
          .insert(orderData as OrderInsert)
          .select()
          .single<Order>()

        if (orderError) {
          // Silent fail - order sync is not critical
        }
      }

      const result: BookingWithSlots = {
        ...newBooking,
        slots: newSlots,
        game_sessions: newSessions,
      }

      // Rafraîchir la liste
      await fetchBookings()
      return result
    } catch (err: unknown) {
      // Meilleure capture d'erreur Supabase
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err)
      console.error('Error creating booking:', errorMessage, err)
      setError(`Erreur: ${errorMessage}`)
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
