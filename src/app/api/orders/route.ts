/**
 * API Orders - Version 2.1 (EVENTS REFACTORISÉS)
 *
 * PHILOSOPHIE:
 * - Déléguer TOUT à des fonctions partagées avec l'admin
 * - Pas de calculs séparés
 * - Aussi simple qu'un appel depuis l'admin
 *
 * Cette API est comme si l'utilisateur créait une réservation manuellement dans l'admin,
 * mais via l'interface du site public.
 *
 * VERSION 2.1: Gestion complète des EVENTS
 * - event_room_id allocation
 * - Séparation room timing vs game timing (15 min setup)
 * - game_sessions selon event_type (AA, LL, AL)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createIsraelDateTime } from '@/lib/dates'
import { validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import { logOrderAction, logBookingAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { EventRoom, LaserRoom, UserRole } from '@/lib/supabase/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Générer une référence courte unique (6 caractères)
function generateShortReference(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Mapper event_type vers le plan de jeu (comme dans l'admin)
// event_active = Active + Active (AA)
// event_laser = Laser + Laser (LL)
// event_mix = Active + Laser (AL)
function getGameAreasForEventType(eventType: string | null): Array<'ACTIVE' | 'LASER'> {
  switch (eventType) {
    case 'event_active':
      return ['ACTIVE', 'ACTIVE'] // AA
    case 'event_laser':
      return ['LASER', 'LASER'] // LL
    case 'event_mix':
      return ['ACTIVE', 'LASER'] // AL
    default:
      return ['ACTIVE', 'ACTIVE'] // Défaut AA
  }
}

// Trouver la meilleure salle d'événement disponible
// IDENTIQUE à findBestAvailableRoom dans admin/page.tsx
async function findBestEventRoom(
  branchId: string,
  participants: number,
  startDateTime: Date,
  endDateTime: Date
): Promise<string | null> {
  // Récupérer les event_rooms de la branche
  const { data: eventRooms } = await supabase
    .from('event_rooms')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('sort_order')

  if (!eventRooms || eventRooms.length === 0) {
    return null
  }

  // Récupérer les bookings EVENT existants sur cette période
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, event_room_id, start_datetime, end_datetime')
    .eq('branch_id', branchId)
    .eq('type', 'EVENT')
    .neq('status', 'CANCELLED')

  // Trier les salles par capacité croissante (plus petite salle adaptée en premier)
  const sortedRooms = [...eventRooms]
    .filter(room => room.capacity >= participants)
    .sort((a, b) => {
      if (a.capacity !== b.capacity) {
        return a.capacity - b.capacity
      }
      return a.sort_order - b.sort_order
    })

  // Trouver la première salle disponible
  for (const room of sortedRooms) {
    let isAvailable = true

    for (const booking of (existingBookings || [])) {
      if (booking.event_room_id === room.id) {
        const bookingStart = new Date(booking.start_datetime)
        const bookingEnd = new Date(booking.end_datetime)

        // Vérifier le chevauchement
        if (
          (startDateTime >= bookingStart && startDateTime < bookingEnd) ||
          (endDateTime > bookingStart && endDateTime <= bookingEnd) ||
          (startDateTime <= bookingStart && endDateTime >= bookingEnd)
        ) {
          isAvailable = false
          break
        }
      }
    }

    if (isAvailable) {
      return room.id
    }
  }

  return null
}

// Trouver ou créer un contact
async function findOrCreateContact(
  branchId: string,
  firstName: string,
  lastName: string | null,
  phone: string,
  email: string | null,
  notes: string | null
): Promise<string> {

  // Chercher un contact existant par téléphone
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('branch_id_main', branchId)
    .eq('phone', phone)
    .single()

  if (existing) {
    return existing.id
  }

  // Créer un nouveau contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      branch_id_main: branchId,
      first_name: firstName,
      last_name: lastName || '',
      phone,
      email: email || null,
      notes_client: notes || null,
      source: 'website'
    })
    .select('id')
    .single()

  if (error) {
    throw new Error('Failed to create contact')
  }

  return newContact.id
}

/**
 * POST /api/orders
 * Créer une commande depuis le site public
 *
 * NOUVELLE ARCHITECTURE:
 * 1. Valider les données
 * 2. Trouver/créer le contact
 * 3. Utiliser session-builder (même logique que admin)
 * 4. Créer booking + sessions
 * 5. Créer l'order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation
    const requiredFields = [
      'branch_id', 'order_type', 'requested_date', 'requested_time',
      'participants_count', 'customer_first_name', 'customer_phone', 'terms_accepted'
    ]

    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    if (!body.terms_accepted) {
      return NextResponse.json(
        { success: false, error: 'Terms must be accepted' },
        { status: 400 }
      )
    }

    const {
      branch_id,
      order_type,
      requested_date,
      requested_time,
      participants_count,
      customer_first_name,
      customer_last_name,
      customer_phone,
      customer_email,
      customer_notes,
      game_area,
      number_of_games = 1,
      event_type = null, // event_active, event_laser, event_mix
      event_celebrant_age = null
    } = body

    // Récupérer l'adresse IP pour le logging
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Valider le format téléphone israélien
    if (!validateIsraeliPhone(customer_phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format. Expected Israeli format: 05XXXXXXXX', messageKey: 'errors.invalidPhoneFormat' },
        { status: 400 }
      )
    }

    // Formater le téléphone
    const formattedPhone = formatIsraeliPhone(customer_phone)

    // 1. Trouver ou créer le contact
    const contactId = await findOrCreateContact(
      branch_id,
      customer_first_name,
      customer_last_name || null,
      formattedPhone,
      customer_email || null,
      customer_notes || null
    )

    // 2. Récupérer les settings
    const { data: settings } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branch_id)
      .single()

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Branch settings not found' },
        { status: 500 }
      )
    }

    const gameDuration = settings.game_duration_minutes || 30
    const pauseDuration = 30 // 30 min de pause entre les jeux (comme admin)
    const eventSetupPause = 15 // 15 min de pause entre début salle et premier jeu (comme admin)

    // 3. Construire les dates/heures du booking
    // Utiliser createIsraelDateTime pour interpreter correctement l'heure Israel
    const requestedStartDateTime = createIsraelDateTime(requested_date, requested_time)

    // ========================================================================
    // GESTION DES ÉVÉNEMENTS (EVENT) - IDENTIQUE À L'ADMIN
    // ========================================================================
    if (order_type === 'EVENT') {
      // Pour EVENT :
      // - Durée de salle fixe = 2h (120 min) par défaut
      // - 15 min de setup avant le premier jeu
      // - 2 jeux de 30 min chacun avec 30 min de pause entre eux
      // - Plan de jeu selon event_type: AA (event_active), LL (event_laser), AL (event_mix)

      const roomDuration = 120 // 2 heures de salle par défaut
      const eventNumberOfGames = 2 // Toujours 2 jeux pour les événements
      const gameAreas = getGameAreasForEventType(event_type)

      // Timing de la salle (start/end du booking)
      const roomStartDateTime = new Date(requestedStartDateTime)
      const roomEndDateTime = new Date(roomStartDateTime.getTime() + roomDuration * 60000)

      // Timing des jeux (game_start/game_end) : 15 min après le début de la salle
      const gameStartDateTime = new Date(roomStartDateTime.getTime() + eventSetupPause * 60000)

      // Calculer la fin des jeux : jeux × durée + pauses entre jeux
      // 2 jeux de 30 min + 1 pause de 30 min = 90 min total de jeu
      const totalGameDuration = (eventNumberOfGames * gameDuration) + ((eventNumberOfGames - 1) * pauseDuration)
      const gameEndDateTime = new Date(gameStartDateTime.getTime() + totalGameDuration * 60000)

      // Trouver une salle d'événement disponible
      const eventRoomId = await findBestEventRoom(
        branch_id,
        participants_count,
        roomStartDateTime,
        roomEndDateTime
      )

      if (!eventRoomId) {
        // Pas de salle disponible → créer order en pending
        const referenceCode = generateShortReference()

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            branch_id,
            order_type,
            source: 'website',
            status: 'pending',
            contact_id: contactId,
            request_reference: referenceCode,
            customer_first_name,
            customer_last_name: customer_last_name || '',
            customer_phone: formattedPhone,
            customer_email: customer_email || null,
            customer_notes: customer_notes || null,
            requested_date,
            requested_time,
            participants_count,
            game_area: game_area || null,
            number_of_games: eventNumberOfGames,
            pending_reason: 'room_unavailable',
            pending_details: 'No event room available for this time slot',
            terms_accepted: true
          })
          .select('id, request_reference')
          .single()

        if (orderError) {
          return NextResponse.json(
            { success: false, error: 'Failed to create order' },
            { status: 500 }
          )
        }

        // Logger la création de l'order (pending - room unavailable)
        await logOrderAction({
          userId: null,
          userRole: 'agent' as UserRole,
          userName: 'Website',
          action: 'created',
          orderId: order.id,
          orderRef: order.request_reference,
          branchId: branch_id,
          details: {
            source: 'website',
            status: 'pending',
            reason: 'room_unavailable',
            orderType: order_type,
            participants: participants_count,
            customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
          },
          ipAddress
        })

        return NextResponse.json({
          success: true,
          order_id: order.id,
          reference: order.request_reference,
          status: 'pending',
          message: 'Your request has been received and is pending confirmation'
        })
      }

      // Générer les game_sessions pour EVENT (comme dans BookingModal)
      const eventGameSessions: Array<{
        game_area: 'ACTIVE' | 'LASER'
        start_datetime: string
        end_datetime: string
        laser_room_id: string | null
        session_order: number
        pause_before_minutes: number
      }> = []

      let currentStart = new Date(gameStartDateTime)

      // Charger les données pour allocation laser si nécessaire
      let laserRooms: LaserRoom[] = []
      let allBookings: any[] = []

      const hasLaserSession = gameAreas.some(area => area === 'LASER')
      if (hasLaserSession) {
        const { data: rooms } = await supabase
          .from('laser_rooms')
          .select('*')
          .eq('branch_id', branch_id)
          .eq('is_active', true)
          .order('sort_order')

        laserRooms = rooms || []

        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            id,
            branch_id,
            participants_count,
            status,
            game_sessions (
              id,
              game_area,
              laser_room_id,
              start_datetime,
              end_datetime
            )
          `)
          .eq('branch_id', branch_id)
          .neq('status', 'CANCELLED')

        allBookings = bookings || []
      }

      for (let i = 0; i < eventNumberOfGames; i++) {
        const area = gameAreas[i]
        const sessionStart = new Date(currentStart)
        const sessionEnd = new Date(sessionStart.getTime() + gameDuration * 60000)

        let laserRoomId: string | null = null

        if (area === 'LASER') {
          // Allocation Laser (comme dans BookingModal)
          const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')

          const allocation = await findBestLaserRoomsForBooking({
            participants: participants_count,
            startDateTime: sessionStart,
            endDateTime: sessionEnd,
            branchId: branch_id,
            laserRooms,
            settings: {
              laser_exclusive_threshold: settings.laser_exclusive_threshold || 10,
              laser_total_vests: settings.laser_total_vests || 30,
              laser_spare_vests: settings.laser_spare_vests || 0
            },
            allBookings,
            allocationMode: 'auto'
          })

          if (allocation && allocation.roomIds.length > 0) {
            laserRoomId = allocation.roomIds[0]
          } else {
            // Pas de salle laser disponible → créer order en pending
            const referenceCode = generateShortReference()

            const { data: order, error: orderError } = await supabase
              .from('orders')
              .insert({
                branch_id,
                order_type,
                source: 'website',
                status: 'pending',
                contact_id: contactId,
                request_reference: referenceCode,
                customer_first_name,
                customer_last_name: customer_last_name || '',
                customer_phone: formattedPhone,
                customer_email: customer_email || null,
                customer_notes: customer_notes || null,
                requested_date,
                requested_time,
                participants_count,
                game_area: game_area || null,
                number_of_games: eventNumberOfGames,
                pending_reason: 'laser_unavailable',
                pending_details: `No laser room available for game ${i + 1}`,
                terms_accepted: true
              })
              .select('id, request_reference')
              .single()

            if (orderError) {
              return NextResponse.json(
                { success: false, error: 'Failed to create order' },
                { status: 500 }
              )
            }

            // Logger la création de l'order (pending - laser unavailable)
            await logOrderAction({
              userId: null,
              userRole: 'agent' as UserRole,
              userName: 'Website',
              action: 'created',
              orderId: order.id,
              orderRef: order.request_reference,
              branchId: branch_id,
              details: {
                source: 'website',
                status: 'pending',
                reason: 'laser_unavailable',
                orderType: order_type,
                participants: participants_count,
                customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
              },
              ipAddress
            })

            return NextResponse.json({
              success: true,
              order_id: order.id,
              reference: order.request_reference,
              status: 'pending',
              message: 'Your request has been received and is pending confirmation'
            })
          }
        }

        eventGameSessions.push({
          game_area: area,
          start_datetime: sessionStart.toISOString(),
          end_datetime: sessionEnd.toISOString(),
          laser_room_id: laserRoomId,
          session_order: i + 1,
          pause_before_minutes: i === 0 ? eventSetupPause : pauseDuration
        })

        // Préparer le début du prochain jeu (après la pause)
        if (i < eventNumberOfGames - 1) {
          currentStart = new Date(sessionEnd.getTime() + pauseDuration * 60000)
        }
      }

      // Créer le booking EVENT
      const referenceCode = generateShortReference()
      const color = '#22C55E' // Vert pour EVENT (comme dans l'admin)

      // Notes avec alias si event_celebrant_age fourni
      const eventNotes = event_celebrant_age
        ? `Age: ${event_celebrant_age}${customer_notes ? '\n' + customer_notes : ''}`
        : customer_notes || null

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          branch_id,
          type: 'EVENT',
          status: 'CONFIRMED',
          // Room timing (salle complète)
          start_datetime: roomStartDateTime.toISOString(),
          end_datetime: roomEndDateTime.toISOString(),
          // Game timing (jeux uniquement)
          game_start_datetime: gameStartDateTime.toISOString(),
          game_end_datetime: gameEndDateTime.toISOString(),
          participants_count,
          event_room_id: eventRoomId, // CRITIQUE : allocation de la salle
          customer_first_name,
          customer_last_name: customer_last_name || '',
          customer_phone: formattedPhone,
          customer_email: customer_email || null,
          customer_notes_at_booking: eventNotes,
          primary_contact_id: contactId,
          reference_code: referenceCode,
          color
        })
        .select('id')
        .single()

      if (bookingError) {
        console.error('Booking creation error:', bookingError)
        return NextResponse.json(
          { success: false, error: 'Failed to create booking' },
          { status: 500 }
        )
      }

      // Créer booking_contacts
      await supabase.from('booking_contacts').insert({
        booking_id: booking.id,
        contact_id: contactId,
        is_primary: true
      })

      // Créer les slots (uniquement pour les sessions ACTIVE, comme dans l'admin)
      const eventSlots = eventGameSessions
        .filter(session => session.game_area === 'ACTIVE')
        .map(session => ({
          booking_id: booking.id,
          branch_id,
          slot_start: session.start_datetime,
          slot_end: session.end_datetime,
          participants_count,
          slot_type: 'game_zone'
        }))

      if (eventSlots.length > 0) {
        await supabase.from('booking_slots').insert(eventSlots)
      }

      // Créer les game_sessions
      const sessionsToInsert = eventGameSessions.map(s => ({
        ...s,
        booking_id: booking.id
      }))

      const { error: sessionsError } = await supabase
        .from('game_sessions')
        .insert(sessionsToInsert)

      if (sessionsError) {
        // Rollback booking
        await supabase.from('bookings').delete().eq('id', booking.id)
        console.error('Sessions creation error:', sessionsError)
        return NextResponse.json(
          { success: false, error: 'Failed to create game sessions' },
          { status: 500 }
        )
      }

      // Créer l'order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id,
          order_type: 'EVENT',
          source: 'website',
          status: 'auto_confirmed',
          booking_id: booking.id,
          contact_id: contactId,
          request_reference: referenceCode,
          customer_first_name,
          customer_last_name: customer_last_name || '',
          customer_phone: formattedPhone,
          customer_email: customer_email || null,
          customer_notes: customer_notes || null,
          requested_date,
          requested_time,
          participants_count,
          game_area: game_area || null,
          number_of_games: eventNumberOfGames,
          terms_accepted: true
        })
        .select('id, request_reference')
        .single()

      if (orderError) {
        // Rollback booking
        await supabase.from('bookings').delete().eq('id', booking.id)
        return NextResponse.json(
          { success: false, error: 'Failed to create order' },
          { status: 500 }
        )
      }

      // Logger la création de l'order (EVENT confirmé)
      await logOrderAction({
        userId: null,
        userRole: 'agent' as UserRole,
        userName: 'Website',
        action: 'created',
        orderId: order.id,
        orderRef: order.request_reference,
        branchId: branch_id,
        details: {
          source: 'website',
          status: 'auto_confirmed',
          orderType: 'EVENT',
          eventType: event_type,
          participants: participants_count,
          customerName: `${customer_first_name} ${customer_last_name || ''}`.trim(),
          bookingId: booking.id
        },
        ipAddress
      })

      // Logger aussi la création du booking
      await logBookingAction({
        userId: null,
        userRole: 'agent' as UserRole,
        userName: 'Website',
        action: 'created',
        bookingId: booking.id,
        bookingRef: referenceCode,
        branchId: branch_id,
        details: {
          source: 'website',
          type: 'EVENT',
          participants: participants_count,
          customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
        },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        order_id: order.id,
        booking_id: booking.id,
        reference: order.request_reference,
        status: 'confirmed',
        message: 'Event booking confirmed successfully'
      })
    }

    // ========================================================================
    // GESTION DES GAMES (GAME) - Code existant
    // ========================================================================
    const startDateTime = requestedStartDateTime

    // Calculer la durée totale incluant les pauses
    // Pour LASER : jeux × durée + (jeux - 1) × pause
    // Pour ACTIVE : jeux × durée (pas de pause par défaut dans l'admin)
    let totalDuration: number
    if (game_area === 'LASER' && number_of_games > 1) {
      totalDuration = (number_of_games * gameDuration) + ((number_of_games - 1) * pauseDuration)
    } else {
      totalDuration = number_of_games * gameDuration
    }

    const endDateTime = new Date(startDateTime.getTime() + (totalDuration * 60000))

    // 4. VÉRIFICATION OVERBOOKING ACTIVE
    // Si ACTIVE, vérifier si ajouter ces participants cause un overbooking
    if (game_area === 'ACTIVE') {
      const maxPlayers = settings.max_concurrent_players || 84 // 14 slots × 6 joueurs par défaut

      // Récupérer tous les bookings ACTIVE existants sur ce créneau
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select(`
          id,
          participants_count,
          game_sessions (
            id,
            game_area,
            start_datetime,
            end_datetime
          )
        `)
        .eq('branch_id', branch_id)
        .neq('status', 'CANCELLED')

      // Pour chaque tranche de 15 min du nouveau booking, calculer le total de participants
      let hasOverbooking = false
      let overbookingDetails = ''

      // Générer les tranches de 15 min couvertes par le nouveau booking
      const SLOT_DURATION = 15 // minutes
      let checkTime = new Date(startDateTime)

      while (checkTime < endDateTime) {
        const slotStart = new Date(checkTime)
        const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000)

        // Compter les participants existants sur ce créneau (sessions ACTIVE uniquement)
        let existingParticipants = 0

        for (const booking of (existingBookings || [])) {
          if (!booking.game_sessions || booking.game_sessions.length === 0) continue

          // Vérifier si une session ACTIVE de ce booking chevauche ce créneau
          const hasOverlap = booking.game_sessions.some((session: { game_area: string; start_datetime: string; end_datetime: string }) => {
            if (session.game_area !== 'ACTIVE') return false
            const sessionStart = new Date(session.start_datetime)
            const sessionEnd = new Date(session.end_datetime)
            return sessionStart < slotEnd && sessionEnd > slotStart
          })

          if (hasOverlap) {
            existingParticipants += booking.participants_count
          }
        }

        // Vérifier si overbooking
        const totalParticipants = existingParticipants + participants_count
        if (totalParticipants > maxPlayers) {
          hasOverbooking = true
          const timeStr = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
          overbookingDetails = `Overbooking at ${timeStr}: ${totalParticipants}/${maxPlayers} players`
          break
        }

        checkTime = slotEnd
      }

      // Si overbooking → créer order en pending
      if (hasOverbooking) {
        const referenceCode = generateShortReference()

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            branch_id,
            order_type,
            source: 'website',
            status: 'pending',
            contact_id: contactId,
            request_reference: referenceCode,
            customer_first_name,
            customer_last_name: customer_last_name || '',
            customer_phone: formattedPhone,
            customer_email: customer_email || null,
            customer_notes: customer_notes || null,
            requested_date,
            requested_time,
            participants_count,
            game_area: game_area || null,
            number_of_games,
            pending_reason: 'overbooking',
            pending_details: overbookingDetails,
            terms_accepted: true
          })
          .select('id, request_reference')
          .single()

        if (orderError) {
          return NextResponse.json(
            { success: false, error: 'Failed to create order' },
            { status: 500 }
          )
        }

        // Logger la création de l'order (pending - overbooking)
        await logOrderAction({
          userId: null,
          userRole: 'agent' as UserRole,
          userName: 'Website',
          action: 'created',
          orderId: order.id,
          orderRef: order.request_reference,
          branchId: branch_id,
          details: {
            source: 'website',
            status: 'pending',
            reason: 'overbooking',
            overbookingDetails,
            orderType: order_type,
            gameArea: game_area,
            participants: participants_count,
            customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
          },
          ipAddress
        })

        return NextResponse.json({
          success: true,
          order_id: order.id,
          reference: order.request_reference,
          status: 'pending',
          message: 'Your request has been received and is pending confirmation due to capacity limits'
        })
      }
    }

    // 5. Construire les sessions avec session-builder (LASER uniquement vérifie dispo)
    const { buildGameSessionsForAPI } = await import('@/lib/session-builder')

    let sessionResult
    try {
      sessionResult = await buildGameSessionsForAPI({
        gameArea: game_area as 'ACTIVE' | 'LASER' | null,
        numberOfGames: number_of_games,
        participants: participants_count,
        startDateTime,
        branchId: branch_id,
        gameDuration,
        supabase
      })
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Failed to allocate game sessions', details: String(err) },
        { status: 500 }
      )
    }

    if (sessionResult.error) {
      // Pas de salles disponibles ou autre erreur
      // Créer une order en pending
      const referenceCode = generateShortReference()

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id,
          order_type,
          source: 'website',
          status: 'pending',
          contact_id: contactId,
          request_reference: referenceCode,
          customer_first_name,
          customer_last_name: customer_last_name || '',
          customer_phone: formattedPhone,
          customer_email: customer_email || null,
          customer_notes: customer_notes || null,
          requested_date,
          requested_time,
          participants_count,
          game_area: game_area || null,
          number_of_games,
          pending_reason: 'slot_unavailable',
          pending_details: sessionResult.error,
          terms_accepted: true
        })
        .select('id, request_reference')
        .single()

      if (orderError) {
        return NextResponse.json(
          { success: false, error: 'Failed to create order' },
          { status: 500 }
        )
      }

      // Logger la création de l'order (pending - slot unavailable)
      await logOrderAction({
        userId: null,
        userRole: 'agent' as UserRole,
        userName: 'Website',
        action: 'created',
        orderId: order.id,
        orderRef: order.request_reference,
        branchId: branch_id,
        details: {
          source: 'website',
          status: 'pending',
          reason: 'slot_unavailable',
          errorDetails: sessionResult.error,
          orderType: order_type,
          gameArea: game_area,
          participants: participants_count,
          customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
        },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        order_id: order.id,
        reference: order.request_reference,
        status: 'pending',
        message: 'Your request has been received and is pending confirmation'
      })
    }

    // 5. Créer le booking
    const referenceCode = generateShortReference()
    const color = order_type === 'GAME' ? '#3B82F6' : '#22C55E'

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        branch_id,
        type: order_type,
        status: 'CONFIRMED',
        start_datetime: startDateTime.toISOString(),
        end_datetime: endDateTime.toISOString(),
        game_start_datetime: startDateTime.toISOString(),
        game_end_datetime: endDateTime.toISOString(),
        participants_count,
        customer_first_name,
        customer_last_name: customer_last_name || '',
        customer_phone: formattedPhone,
        customer_email: customer_email || null,
        customer_notes_at_booking: customer_notes || null,
        primary_contact_id: contactId,
        reference_code: referenceCode,
        color
      })
      .select('id')
      .single()

    if (bookingError) {
      return NextResponse.json(
        { success: false, error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // 6. Créer booking_contacts
    await supabase.from('booking_contacts').insert({
      booking_id: booking.id,
      contact_id: contactId,
      is_primary: true
    })

    // 7. Créer les slots (basés sur les sessions créées)
    // Pour être cohérent, on utilise les sessions pour définir les slots
    const slots = []

    if (sessionResult.game_sessions.length > 0) {
      // Grouper les sessions par session_order (chaque jeu)
      const sessionsByOrder = new Map<number, typeof sessionResult.game_sessions>()
      for (const session of sessionResult.game_sessions) {
        if (!sessionsByOrder.has(session.session_order)) {
          sessionsByOrder.set(session.session_order, [])
        }
        sessionsByOrder.get(session.session_order)!.push(session)
      }

      // Créer un slot par jeu (session_order)
      for (const [, sessions] of sessionsByOrder) {
        if (sessions.length > 0) {
          const firstSession = sessions[0]
          slots.push({
            booking_id: booking.id,
            branch_id,
            slot_start: firstSession.start_datetime,
            slot_end: firstSession.end_datetime,
            participants_count,
            slot_type: 'game_zone'
          })
        }
      }
    }

    if (slots.length > 0) {
      await supabase.from('booking_slots').insert(slots)
    }

    // 8. Créer les game_sessions
    if (sessionResult.game_sessions.length > 0) {
      const sessionsToInsert = sessionResult.game_sessions.map(s => ({
        ...s,
        booking_id: booking.id
      }))

      const { error: sessionsError } = await supabase
        .from('game_sessions')
        .insert(sessionsToInsert)

      if (sessionsError) {
        // Rollback booking
        await supabase.from('bookings').delete().eq('id', booking.id)
        return NextResponse.json(
          { success: false, error: 'Failed to create game sessions' },
          { status: 500 }
        )
      }
    }

    // 9. Créer l'order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id,
        order_type,
        source: 'website',
        status: 'auto_confirmed',
        booking_id: booking.id,
        contact_id: contactId,
        request_reference: referenceCode,
        customer_first_name,
        customer_last_name: customer_last_name || '',
        customer_phone: formattedPhone,
        customer_email: customer_email || null,
        customer_notes: customer_notes || null,
        requested_date,
        requested_time,
        participants_count,
        game_area: game_area || null,
        number_of_games,
        terms_accepted: true
      })
      .select('id, request_reference')
      .single()

    if (orderError) {
      // Rollback booking
      await supabase.from('bookings').delete().eq('id', booking.id)
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Logger la création de l'order (GAME confirmé)
    await logOrderAction({
      userId: null,
      userRole: 'agent' as UserRole,
      userName: 'Website',
      action: 'created',
      orderId: order.id,
      orderRef: order.request_reference,
      branchId: branch_id,
      details: {
        source: 'website',
        status: 'auto_confirmed',
        orderType: order_type,
        gameArea: game_area,
        numberOfGames: number_of_games,
        participants: participants_count,
        customerName: `${customer_first_name} ${customer_last_name || ''}`.trim(),
        bookingId: booking.id
      },
      ipAddress
    })

    // Logger aussi la création du booking
    await logBookingAction({
      userId: null,
      userRole: 'agent' as UserRole,
      userName: 'Website',
      action: 'created',
      bookingId: booking.id,
      bookingRef: referenceCode,
      branchId: branch_id,
      details: {
        source: 'website',
        type: order_type,
        gameArea: game_area,
        participants: participants_count,
        customerName: `${customer_first_name} ${customer_last_name || ''}`.trim()
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      booking_id: booking.id,
      reference: order.request_reference,
      status: 'confirmed',
      message: 'Booking confirmed successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders
 * Liste des orders pour l'admin
 */
export async function GET(request: NextRequest) {
  try {
    // Importer la vérification de permissions
    const { verifyApiPermission } = await import('@/lib/permissions')

    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branch_id')
    const status = searchParams.get('status')

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branch_id required', messageKey: 'errors.branchRequired' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branchId)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
        { status: 403 }
      )
    }

    let query = supabase
      .from('orders')
      .select(`
        *,
        contact:contacts(*),
        booking:bookings(*),
        branch:branches(*)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    // Compter les pending
    const pendingCount = orders?.filter(o => o.status === 'pending').length || 0

    return NextResponse.json({
      success: true,
      orders,
      pending_count: pendingCount
    })
  } catch (error) {
    console.error('Error in GET /api/orders:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
