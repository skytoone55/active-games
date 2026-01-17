/**
 * API Orders - Version 2.0 (RECONSTRUITE COMPLÈTEMENT)
 *
 * PHILOSOPHIE:
 * - Déléguer TOUT à des fonctions partagées avec l'admin
 * - Pas de calculs séparés
 * - Aussi simple qu'un appel depuis l'admin
 *
 * Cette API est comme si l'utilisateur créait une réservation manuellement dans l'admin,
 * mais via l'interface du site public.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createIsraelDateTime } from '@/lib/dates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Générer une référence courte unique (6 caractères)
function generateShortReference(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
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
      number_of_games = 1
    } = body

    // 1. Trouver ou créer le contact
    const contactId = await findOrCreateContact(
      branch_id,
      customer_first_name,
      customer_last_name || null,
      customer_phone,
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

    // 3. Construire les dates/heures du booking
    // Utiliser createIsraelDateTime pour interpreter correctement l'heure Israel
    const startDateTime = createIsraelDateTime(requested_date, requested_time)

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
            customer_phone,
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
          customer_phone,
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
        customer_phone,
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
        customer_phone,
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
  const searchParams = request.nextUrl.searchParams
  const branchId = searchParams.get('branch_id')
  const status = searchParams.get('status')

  if (!branchId) {
    return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compter les pending
  const pendingCount = orders?.filter(o => o.status === 'pending').length || 0

  return NextResponse.json({
    success: true,
    orders,
    pending_count: pendingCount
  })
}
