'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase/client'
import { createIsraelDateTime } from '@/lib/dates'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import {
  getCachedBookings,
  setCachedBookings,
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
  // Si un refresh realtime arrive pendant un fetch en cours, on le note ici pour refetch à la fin
  const pendingRefreshRef = useRef(false)
  // Track whether we have any data displayed (avoids stale closure on bookings)
  const hasDataRef = useRef(false)

  // Keep hasDataRef in sync
  useEffect(() => {
    hasDataRef.current = bookings.length > 0
  }, [bookings])

  // Load from cache EVERY time branchId or date changes (instant display)
  useEffect(() => {
    if (!branchId || !date) return

    const cached = getCachedBookings(branchId, date)
    if (cached !== null) {
      setBookings(cached)
      setLoading(false) // Instant display (including empty days)
    } else {
      // Pas de cache pour cette date : vider immédiatement les données de la date précédente
      // et afficher le spinner — évite un calendrier vide sans aucune indication de chargement
      setBookings([])
      setLoading(true)
    }
  }, [branchId, date])

  // Charger les réservations
  const fetchBookings = useCallback(async (force = false) => {
    if (!branchId) {
      setBookings([])
      setLoading(false)
      return
    }

    // Éviter les appels concurrents — toujours mettre en file d'attente, même avec force=true
    // Deux fetches simultanés créent des race conditions (realtime + createBooking par exemple)
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true
      return
    }
    pendingRefreshRef.current = false

    const supabase = getClient()
    isFetchingRef.current = true

    // Safety: auto-release lock after 8 seconds to prevent infinite spinner
    const lockTimeout = setTimeout(() => {
      if (isFetchingRef.current) {
        console.warn('[useBookings] Fetch lock auto-released after 8s timeout')
        isFetchingRef.current = false
        setLoading(false)
      }
    }, 8000)

    // Only show loading spinner if no cache AND no data already in memory
    // This avoids the grey spinner when a refetch is triggered (realtime, visibility, etc.)
    // while the agenda is already displayed
    const cached = date ? getCachedBookings(branchId, date) : null
    if (cached === null && !hasDataRef.current) {
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
      // IMPORTANT: utiliser createIsraelDateTime pour convertir la date locale en UTC correct.
      // Israël est UTC+2 (hiver) ou UTC+3 (été). Un filtre naïf "date T00:00:00Z"
      // manque les réservations de minuit à 3h du matin (stockées la veille en UTC).
      if (date) {
        const startOfDay = createIsraelDateTime(date, '00:00').toISOString()
        const endOfDay   = createIsraelDateTime(date, '23:59').toISOString()
        query = query
          .gte('start_datetime', startOfDay)
          .lte('start_datetime', endOfDay)
      }

      const { data: bookingsData, error: bookingsError } = await query.returns<Booking[]>()

      if (bookingsError) throw bookingsError

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        // Mettre en cache même les jours vides pour éviter de repartir "à froid"
        // à chaque événement realtime (sinon setLoading(true) à chaque fois)
        if (date && branchId) {
          setCachedBookings(branchId, date, [])
          setLastSyncTime(branchId)
        }
        setLoading(false)
        return
      }

      // Charger slots, game_sessions et contacts EN PARALLÈLE (au lieu de séquentiellement)
      const bookingIds = bookingsData.map(b => b.id)
      const [slotsResult, sessionsResult, contactsResult] = await Promise.all([
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
          .returns<GameSession[]>(),
        // CRM: contacts liés — chargé en parallèle avec slots et sessions
        supabase
          .from('booking_contacts')
          .select('*, contact:contacts(*)')
          .in('booking_id', bookingIds)
      ])

      const { data: slotsData, error: slotsError } = slotsResult
      const { data: sessionsData, error: sessionsError } = sessionsResult
      const { data: bookingContactsData } = contactsResult

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
      // Si un refresh realtime était en attente pendant ce fetch, on l'exécute maintenant
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false
        setTimeout(() => fetchBookings(), 200)
      }
    }
  }, [branchId, date])

  // Charger quand branchId ou date change (debounced pour navigations rapides)
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    const fetchKey = `${branchId || ''}-${date || ''}`
    if (fetchKey === lastFetchKeyRef.current) {
      return
    }
    lastFetchKeyRef.current = fetchKey

    // Cancel any pending debounced fetch
    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current)
    }

    // IMPORTANT: réinitialiser le verrou quand on navigue vers une nouvelle date/branche
    // Sinon un fetch en cours pour l'ancienne date bloque le chargement de la nouvelle
    isFetchingRef.current = false
    pendingRefreshRef.current = false

    // Debounce: wait 150ms before fetching — lets cache display stabilize
    // and avoids hammering the API when user rapidly navigates dates
    fetchDebounceRef.current = setTimeout(() => {
      fetchBookings()
    }, 150)

    return () => {
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current)
      }
    }
  }, [branchId, date, fetchBookings])

  // ─── Mises à jour CIBLÉES via Realtime ───────────────────────────────────
  // Avant : chaque événement rechargeait toute la journée (~3 requêtes).
  // Maintenant : on n'actualise que la réservation concernée → instantané et
  // beaucoup moins de requêtes. La suppression est appliquée sans aucune requête.

  // Une réservation appartient-elle au jour affiché ? (bornes Israël)
  const isInCurrentDay = useCallback((startDatetime: string): boolean => {
    if (!date) return true
    const start = createIsraelDateTime(date, '00:00').toISOString()
    const end = createIsraelDateTime(date, '23:59').toISOString()
    return startDatetime >= start && startDatetime <= end
  }, [date])

  // Recharger UNE seule réservation (avec slots/sessions/contacts). null si
  // elle ne doit pas/plus apparaître (autre branche, annulée, introuvable).
  const fetchSingleBooking = useCallback(async (bookingId: string): Promise<BookingWithSlots | null> => {
    if (!branchId) return null
    const supabase = getClient()

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle<Booking>()

    if (!booking || booking.branch_id !== branchId || booking.status === 'CANCELLED') return null

    const [slotsResult, sessionsResult, contactsResult] = await Promise.all([
      supabase.from('booking_slots').select('*').eq('booking_id', bookingId).order('slot_start').returns<BookingSlot[]>(),
      supabase.from('game_sessions').select('*').eq('booking_id', bookingId).order('session_order').returns<GameSession[]>(),
      supabase.from('booking_contacts').select('*, contact:contacts(*)').eq('booking_id', bookingId),
    ])

    const slots = slotsResult.data || []
    const game_sessions = sessionsResult.data || []

    interface BookingContactRow { is_primary: boolean; contact: Contact | null }
    const rows = (contactsResult.data as BookingContactRow[] | null) || []
    const allContacts: Contact[] = []
    let primaryContact: Contact | null = null
    rows.forEach((bc) => {
      if (!bc.contact) return
      allContacts.push(bc.contact)
      if (bc.is_primary) primaryContact = bc.contact
    })

    // Fallback contact principal via primary_contact_id (anciennes données)
    if (!primaryContact && booking.primary_contact_id) {
      const { data: pc } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', booking.primary_contact_id)
        .eq('status', 'active')
        .maybeSingle<Contact>()
      if (pc) primaryContact = pc
    }

    return {
      ...booking,
      slots,
      game_sessions,
      primaryContact,
      allContacts: allContacts.length > 0 ? allContacts : (primaryContact ? [primaryContact] : []),
    }
  }, [branchId])

  // Insérer/remplacer une réservation dans l'état (et le cache), tri par heure.
  const upsertBooking = useCallback((b: BookingWithSlots) => {
    setBookings(prev => {
      const idx = prev.findIndex(x => x.id === b.id)
      const next = idx === -1 ? [...prev, b] : prev.map(x => (x.id === b.id ? b : x))
      next.sort((a, c) => a.start_datetime.localeCompare(c.start_datetime))
      if (date && branchId) {
        setCachedBookings(branchId, date, next)
        setLastSyncTime(branchId)
      }
      return next
    })
  }, [branchId, date])

  // Retirer une réservation de l'état (et du cache).
  const removeBooking = useCallback((id: string) => {
    setBookings(prev => {
      const next = prev.filter(b => b.id !== id)
      if (next.length === prev.length) return prev
      if (date && branchId) {
        setCachedBookings(branchId, date, next)
        setLastSyncTime(branchId)
      }
      return next
    })
  }, [branchId, date])

  const handleBookingUpsert = useCallback(async (payload: { new?: Record<string, unknown> }) => {
    const row = payload.new as Booking | undefined
    if (!row?.id) return
    // Annulée ou déplacée hors du jour affiché → la retirer de la vue
    if (row.status === 'CANCELLED' || !isInCurrentDay(row.start_datetime)) {
      removeBooking(row.id)
      return
    }
    const full = await fetchSingleBooking(row.id)
    if (full) upsertBooking(full)
    else removeBooking(row.id)
  }, [isInCurrentDay, fetchSingleBooking, upsertBooking, removeBooking])

  const handleBookingDelete = useCallback((payload: { old?: Record<string, unknown> }) => {
    const id = (payload.old as { id?: string } | undefined)?.id
    if (id) removeBooking(id)
  }, [removeBooking])

  // game_sessions / booking_slots : le payload porte booking_id → recharger
  // uniquement cette réservation.
  const handleRelatedChange = useCallback(async (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
    const bid = (payload.new as { booking_id?: string } | undefined)?.booking_id
      || (payload.old as { booking_id?: string } | undefined)?.booking_id
    if (!bid) return
    const full = await fetchSingleBooking(bid)
    if (full) upsertBooking(full)
    else removeBooking(bid)
  }, [fetchSingleBooking, upsertBooking, removeBooking])

  const branchFilter = branchId ? `branch_id=eq.${branchId}` : undefined

  useRealtimeSubscription(
    { table: 'bookings', filter: branchFilter, onInsert: handleBookingUpsert, onUpdate: handleBookingUpsert, onDelete: handleBookingDelete },
    !!branchId
  )
  useRealtimeSubscription(
    { table: 'game_sessions', filter: branchFilter, onChange: handleRelatedChange },
    !!branchId
  )
  useRealtimeSubscription(
    { table: 'booking_slots', filter: branchFilter, onChange: handleRelatedChange },
    !!branchId
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
