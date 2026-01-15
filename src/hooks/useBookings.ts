'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { Booking, BookingSlot, BookingType, BookingStatus, Contact, GameSession } from '@/lib/supabase/types'

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
        console.log('Fetching bookings for date range:', { startOfDay, endOfDay, branchId })
        query = query
          .gte('start_datetime', startOfDay)
          .lte('start_datetime', endOfDay)
      }

      const { data: bookingsData, error: bookingsError } = await query.returns<Booking[]>()
      console.log('Bookings fetched:', bookingsData?.length || 0, bookingsData)

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

  // Créer une réservation
  const createBooking = useCallback(async (data: CreateBookingData): Promise<BookingWithSlots | null> => {
    const supabase = getClient()
    setError(null)

    try {
      // Log des données pour debug
      console.log('Creating booking with data:', {
        branch_id: data.branch_id,
        type: data.type,
        start_datetime: data.start_datetime,
        end_datetime: data.end_datetime,
        participants_count: data.participants_count,
        customer_first_name: data.customer_first_name,
        customer_last_name: data.customer_last_name,
        customer_phone: data.customer_phone,
      })

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
        reference_code: generateReferenceCode(),
        notes: data.notes,
      }
      
      // Couleur activée - la colonne existe dans la base de données
      if (data.color !== undefined && data.color !== null && data.color !== '') {
        insertData.color = data.color
      }
      
      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert(insertData as any)
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
          .insert({
            booking_id: newBooking.id,
            contact_id: data.primary_contact_id,
            is_primary: true,
            role: null,
          } as any)

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
          .insert(slotsToInsert as any)
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
          .insert(sessionsToInsert as any)
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

  // Mettre à jour une réservation
  const updateBooking = useCallback(async (
    id: string,
    data: Partial<CreateBookingData>
  ): Promise<BookingWithSlots | null> => {
    const supabase = getClient()
    setError(null)

    try {
      // Mettre à jour le booking
      const updateData: Record<string, unknown> = {}
      if (data.type) updateData.type = data.type
      if (data.branch_id !== undefined) updateData.branch_id = data.branch_id // CORRECTION: Mettre à jour branch_id
      if (data.start_datetime !== undefined) updateData.start_datetime = data.start_datetime
      if (data.end_datetime !== undefined) updateData.end_datetime = data.end_datetime
      if (data.game_start_datetime !== undefined) updateData.game_start_datetime = data.game_start_datetime
      if (data.game_end_datetime !== undefined) updateData.game_end_datetime = data.game_end_datetime
      if (data.participants_count !== undefined) updateData.participants_count = data.participants_count
      if (data.event_room_id !== undefined) updateData.event_room_id = data.event_room_id
      if (data.customer_first_name !== undefined) updateData.customer_first_name = data.customer_first_name
      if (data.customer_last_name !== undefined) updateData.customer_last_name = data.customer_last_name
      if (data.customer_phone !== undefined) updateData.customer_phone = data.customer_phone
      if (data.customer_email !== undefined) updateData.customer_email = data.customer_email
      if (data.notes !== undefined) updateData.notes = data.notes
      // Couleur activée - la colonne existe dans la base de données
      if (data.color !== undefined) updateData.color = data.color
      // CRM: Mettre à jour primary_contact_id si fourni
      if (data.primary_contact_id !== undefined) updateData.primary_contact_id = data.primary_contact_id
      updateData.updated_at = new Date().toISOString()

      // Récupérer l'ancien booking pour comparer primary_contact_id
      const { data: oldBooking } = await supabase
        .from('bookings')
        .select('primary_contact_id')
        .eq('id', id)
        .single<{ primary_contact_id: string | null }>()

      const { data: updatedBooking, error: bookingError } = await supabase
        .from('bookings')
        // @ts-expect-error - Type assertion nécessaire pour contourner le problème de typage Supabase
        .update(updateData)
        .eq('id', id)
        .select()
        .single<Booking>()

      if (bookingError) throw bookingError

      // CRM: Mettre à jour les relations booking_contacts si primary_contact_id a changé
      const newPrimaryContactId = data.primary_contact_id !== undefined ? data.primary_contact_id : updatedBooking.primary_contact_id
      const oldPrimaryContactId = oldBooking?.primary_contact_id || null
      
      // Si le primary_contact_id a changé, mettre à jour les relations
      if (newPrimaryContactId !== oldPrimaryContactId) {
        // Supprimer toutes les anciennes relations pour cette réservation
        const { error: deleteError } = await supabase
          .from('booking_contacts')
          .delete()
          .eq('booking_id', id)

        if (deleteError) {
          console.error('Error deleting old booking_contacts:', deleteError)
        }

        // Créer la nouvelle relation avec le nouveau contact (si fourni)
        if (newPrimaryContactId) {
          const { error: bookingContactError } = await supabase
            .from('booking_contacts')
            .insert({
              booking_id: id,
              contact_id: newPrimaryContactId,
              is_primary: true,
              role: null,
            } as any)

          if (bookingContactError) {
            console.error('Error inserting new booking_contacts:', bookingContactError)
            // Ne pas faire échouer la mise à jour si la relation échoue
          }
        }
      }

      // Si des slots sont fournis, les recréer
      let updatedSlots: BookingSlot[] = []
      if (data.slots) {
        // Supprimer les anciens slots
        await supabase
          .from('booking_slots')
          .delete()
          .eq('booking_id', id)

        // Créer les nouveaux slots
        if (data.slots.length > 0) {
          const slotsToInsert = data.slots.map(slot => ({
            booking_id: id,
            branch_id: data.branch_id || updatedBooking.branch_id, // CORRECTION: Utiliser la nouvelle branch_id si fournie
            slot_start: slot.slot_start,
            slot_end: slot.slot_end,
            participants_count: slot.participants_count,
            slot_type: 'game_zone',
          }))

          const { data: insertedSlots } = await supabase
            .from('booking_slots')
            .insert(slotsToInsert as any)
            .select()
            .returns<BookingSlot[]>()

          updatedSlots = insertedSlots || []
        }
      }

      // Si des game_sessions sont fournies, les recréer
      let updatedSessions: GameSession[] = []
      if (data.game_sessions) {
        // Supprimer les anciennes sessions (ON DELETE CASCADE gère déjà ça, mais on le fait explicitement pour être sûr)
        await supabase
          .from('game_sessions')
          .delete()
          .eq('booking_id', id)

        // Créer les nouvelles sessions
        if (data.game_sessions.length > 0) {
          const sessionsToInsert = data.game_sessions.map(session => ({
            booking_id: id,
            game_area: session.game_area,
            start_datetime: session.start_datetime,
            end_datetime: session.end_datetime,
            laser_room_id: session.laser_room_id || null,
            session_order: session.session_order,
            pause_before_minutes: session.pause_before_minutes,
          }))

          const { data: insertedSessions } = await supabase
            .from('game_sessions')
            .insert(sessionsToInsert as any)
            .select()
            .returns<GameSession[]>()

          updatedSessions = insertedSessions || []
        }
      }

      await fetchBookings()
      return { 
        ...updatedBooking, 
        slots: updatedSlots,
        game_sessions: updatedSessions,
      }
    } catch (err) {
      console.error('Error updating booking:', err)
      setError('Erreur lors de la mise à jour de la réservation')
      return null
    }
  }, [fetchBookings])

  // Annuler une réservation
  const cancelBooking = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    const supabase = getClient()
    setError(null)

    try {
      const { error: cancelError } = await supabase
        .from('bookings')
        // @ts-expect-error - Type assertion nécessaire pour contourner le problème de typage Supabase
        .update({
          status: 'CANCELLED' as BookingStatus,
          cancelled_at: new Date().toISOString(),
          cancelled_reason: reason,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)

      if (cancelError) throw cancelError

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error cancelling booking:', err)
      setError('Erreur lors de l\'annulation de la réservation')
      return false
    }
  }, [fetchBookings])

  // Supprimer définitivement une réservation
  const deleteBooking = useCallback(async (id: string): Promise<boolean> => {
    const supabase = getClient()
    setError(null)

    try {
      // Les slots seront supprimés automatiquement grâce à ON DELETE CASCADE
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

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
