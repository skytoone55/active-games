/**
 * API Route pour les commandes en ligne
 * POST: Créer une nouvelle commande depuis le site
 * GET: Lister les commandes (pour l'admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client avec service role pour bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Générer un numéro de référence court (format XXXXXX) - même format pour order et booking
function generateShortReference(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Ancienne fonction conservée pour compatibilité (non utilisée)
async function generateRequestReferenceLegacy(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  
  // Compter les commandes du jour
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString())
  
  const seqNum = (count || 0) + 1
  return `REQ-${dateStr}-${seqNum.toString().padStart(4, '0')}`
}

// generateBookingReference supprimé - on utilise generateShortReference à la place

// Trouver ou créer un contact
async function findOrCreateContact(
  branchId: string,
  firstName: string,
  lastName: string | null,
  phone: string,
  email: string | null,
  notes: string | null
): Promise<string> {
  // Chercher un contact existant avec même téléphone ET même nom
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, notes_client')
    .eq('phone', phone)
    .eq('status', 'active')
  
  if (existingContacts && existingContacts.length > 0) {
    // Vérifier si les infos correspondent exactement
    const exactMatch = existingContacts.find(c => 
      c.first_name.toLowerCase() === firstName.toLowerCase() &&
      (c.last_name || '').toLowerCase() === (lastName || '').toLowerCase()
    )
    
    if (exactMatch) {
      // Si des notes sont fournies, les ajouter aux notes existantes
      if (notes && notes.trim()) {
        const dateStr = new Date().toLocaleDateString('fr-FR')
        const newNote = `[${dateStr} - Réservation site] ${notes}`
        const updatedNotes = exactMatch.notes_client 
          ? `${exactMatch.notes_client}\n\n${newNote}`
          : newNote
        
        await supabase
          .from('contacts')
          .update({ notes_client: updatedNotes })
          .eq('id', exactMatch.id)
      }
      return exactMatch.id
    }
  }
  
  // Préparer les notes pour un nouveau contact
  let formattedNotes = null
  if (notes && notes.trim()) {
    const dateStr = new Date().toLocaleDateString('fr-FR')
    formattedNotes = `[${dateStr} - Réservation site] ${notes}`
  }
  
  // Créer un nouveau contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      branch_id_main: branchId,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      email: email,
      notes_client: formattedNotes,
      source: 'public_booking',
      status: 'active',
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Error creating contact:', error.message, error.details, error.hint)
    throw new Error(`Failed to create contact: ${error.message}`)
  }
  
  return newContact.id
}

// Vérifier la disponibilité
async function checkAvailability(
  branchId: string,
  orderType: 'GAME' | 'EVENT',
  requestedDate: string,
  requestedTime: string,
  participantsCount: number,
  gameArea?: 'ACTIVE' | 'LASER' | null,
  numberOfGames?: number
): Promise<{ available: boolean; reason?: string; details?: string; eventRoomId?: string; laserRoomIds?: string[] }> {
  
  console.log(`[checkAvailability] Called with: orderType=${orderType}, gameArea=${gameArea}, numberOfGames=${numberOfGames}, participants=${participantsCount}`)
  
  // Récupérer les settings de la branche
  const { data: settings } = await supabase
    .from('branch_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()
  
  if (!settings) {
    return { available: false, reason: 'other', details: 'Branch settings not found' }
  }
  
  // Construire les datetime
  const startDateTime = new Date(`${requestedDate}T${requestedTime}`)
  const gameDuration = settings.game_duration_minutes || 30
  const numGames = numberOfGames || 1
  
  if (orderType === 'EVENT') {
    // Pour un EVENT, vérifier la disponibilité de la salle
    const eventDuration = settings.event_total_duration_minutes || 120
    const endDateTime = new Date(startDateTime.getTime() + eventDuration * 60000)
    
    // Récupérer les salles disponibles
    const { data: rooms } = await supabase
      .from('event_rooms')
      .select('id, name, capacity')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .gte('capacity', participantsCount)
      .order('capacity', { ascending: true })
    
    if (!rooms || rooms.length === 0) {
      return { available: false, reason: 'room_unavailable', details: 'No room with sufficient capacity' }
    }
    
    // Vérifier chaque salle
    for (const room of rooms) {
      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('branch_id', branchId)
        .eq('event_room_id', room.id)
        .neq('status', 'CANCELLED')
        .lt('start_datetime', endDateTime.toISOString())
        .gt('end_datetime', startDateTime.toISOString())
      
      if (!conflictingBookings || conflictingBookings.length === 0) {
        // Salle disponible!
        return { available: true, eventRoomId: room.id }
      }
    }
    
    return { available: false, reason: 'room_unavailable', details: 'All rooms are booked for this time slot' }
  }
  
  // Pour un GAME
  if (gameArea === 'LASER') {
    // Vérifier les vestes laser
    const totalVests = settings.laser_total_vests || 30
    const spareVests = settings.laser_spare_vests || 0
    const availableVests = totalVests + spareVests
    
    // Calculer la durée totale (nombre de parties * durée)
    const totalGameDuration = numGames * gameDuration
    const endDateTime = new Date(startDateTime.getTime() + totalGameDuration * 60000)
    
    // Récupérer les salles laser
    const { data: laserRooms } = await supabase
      .from('laser_rooms')
      .select('id, name, capacity, sort_order, is_active')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order')
    
    if (!laserRooms || laserRooms.length === 0) {
      return { available: false, reason: 'other', details: 'No laser rooms configured' }
    }
    
    // Récupérer toutes les réservations avec game_sessions LASER
    const { data: allBookings } = await supabase
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
      .eq('branch_id', branchId)
      .neq('status', 'CANCELLED')
    
    // Calculer vestes utilisées sur ce créneau
    let usedVests = 0
    if (allBookings) {
      for (const booking of allBookings) {
        const hasLaserSession = booking.game_sessions?.some((s: any) => 
          s.game_area === 'LASER' &&
          new Date(s.start_datetime) < endDateTime &&
          new Date(s.end_datetime) > startDateTime
        )
        if (hasLaserSession) {
          usedVests += booking.participants_count
        }
      }
    }
    
    if (usedVests + participantsCount > availableVests) {
      return { available: false, reason: 'laser_vests_full', details: `Only ${availableVests - usedVests} vests available` }
    }
    
    // Utiliser la fonction d'allocation partagée (même logique que l'admin)
    const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')
    
    const allocation = await findBestLaserRoomsForBooking({
      participants: participantsCount,
      startDateTime,
      endDateTime,
      branchId,
      laserRooms,
      settings: {
        laser_exclusive_threshold: settings.laser_exclusive_threshold || 10,
        laser_total_vests: totalVests,
        laser_spare_vests: spareVests
      },
      allBookings: allBookings || [],
      allocationMode: 'auto'
    })
    
    if (!allocation) {
      return { available: false, reason: 'slot_unavailable', details: 'No laser room available with sufficient capacity' }
    }
    
    console.log(`[checkAvailability] LASER allocation: ${allocation.roomIds.length} room(s)`, allocation.roomIds)
    
    return { available: true, laserRoomIds: allocation.roomIds }
  }
  
  // Pour ACTIVE games
  const totalGameDuration = numGames * gameDuration
  const endDateTime = new Date(startDateTime.getTime() + totalGameDuration * 60000)
  const maxPlayers = settings.max_concurrent_players || 80
  
  // Compter les joueurs sur ce créneau (exclure les bookings annulés)
  const { data: overlappingSlots } = await supabase
    .from('booking_slots')
    .select(`
      participants_count,
      booking:bookings!inner(id, status)
    `)
    .eq('branch_id', branchId)
    .neq('booking.status', 'CANCELLED')
    .lt('slot_start', endDateTime.toISOString())
    .gt('slot_end', startDateTime.toISOString())
  
  const currentPlayers = overlappingSlots?.reduce((sum, s) => sum + s.participants_count, 0) || 0
  
  console.log(`[checkAvailability] ACTIVE check: ${currentPlayers} current + ${participantsCount} requested vs ${maxPlayers} max`)
  
  if (currentPlayers + participantsCount > maxPlayers) {
    console.log(`[checkAvailability] OVERBOOKING detected! Returning pending.`)
    return { available: false, reason: 'overbooking', details: `Only ${maxPlayers - currentPlayers} spots available` }
  }
  
  return { available: true }
}

// Créer un booking avec la référence fournie
// UTILISE LA MÊME LOGIQUE QUE L'ADMIN (session-builder.ts)
async function createBooking(
  branchId: string,
  orderType: 'GAME' | 'EVENT',
  requestedDate: string,
  requestedTime: string,
  participantsCount: number,
  contactId: string,
  firstName: string,
  lastName: string | null,
  phone: string,
  email: string | null,
  notes: string | null,
  gameArea: 'ACTIVE' | 'LASER' | null,
  numberOfGames: number,
  referenceCode: string, // Référence passée en paramètre
  eventRoomId?: string,
  laserRoomIds?: string[] // Ignoré, sera calculé par session-builder
): Promise<{ bookingId: string; referenceCode: string }> {
  
  // Récupérer les settings
  const { data: settings } = await supabase
    .from('branch_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()
  
  const gameDuration = settings?.game_duration_minutes || 30
  const eventDuration = settings?.event_total_duration_minutes || 120
  
  console.log(`[createBooking] Settings: gameDuration=${gameDuration}min, numberOfGames=${numberOfGames}, gameArea=${gameArea}`)
  console.log(`[createBooking] Using session-builder (same logic as admin)`)
  
  const startDateTime = new Date(`${requestedDate}T${requestedTime}`)
  let endDateTime: Date
  let gameStartDateTime: Date | null = null
  let gameEndDateTime: Date | null = null
  
  if (orderType === 'EVENT') {
    // Event: 2h de salle, jeux au milieu
    endDateTime = new Date(startDateTime.getTime() + eventDuration * 60000)
    const bufferBefore = settings?.event_buffer_before_minutes || 30
    gameStartDateTime = new Date(startDateTime.getTime() + bufferBefore * 60000)
    gameEndDateTime = new Date(gameStartDateTime.getTime() + (numberOfGames * gameDuration) * 60000)
  } else {
    // Game simple
    endDateTime = new Date(startDateTime.getTime() + (numberOfGames * gameDuration) * 60000)
    gameStartDateTime = startDateTime
    gameEndDateTime = endDateTime
  }
  
  // Couleur par défaut
  let defaultColor = '#3B82F6' // Bleu pour GAME
  if (orderType === 'EVENT') {
    defaultColor = '#22C55E' // Vert pour EVENT
  }
  
  // Créer le booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      branch_id: branchId,
      type: orderType,
      status: 'CONFIRMED',
      start_datetime: startDateTime.toISOString(),
      end_datetime: endDateTime.toISOString(),
      game_start_datetime: gameStartDateTime?.toISOString(),
      game_end_datetime: gameEndDateTime?.toISOString(),
      participants_count: participantsCount,
      event_room_id: eventRoomId || null,
      customer_first_name: firstName,
      customer_last_name: lastName || '',
      customer_phone: phone,
      customer_email: email,
      customer_notes_at_booking: notes,
      primary_contact_id: contactId,
      reference_code: referenceCode,
      color: defaultColor,
    })
    .select('id')
    .single()
  
  if (bookingError) {
    console.error('Error creating booking:', bookingError)
    throw new Error('Failed to create booking')
  }
  
  // Créer la liaison contact
  await supabase
    .from('booking_contacts')
    .insert({
      booking_id: booking.id,
      contact_id: contactId,
      is_primary: true,
    })
  
  // Créer les slots
  const slots = []
  let currentTime = new Date(gameStartDateTime || startDateTime)
  
  for (let i = 0; i < numberOfGames; i++) {
    const slotEnd = new Date(currentTime.getTime() + gameDuration * 60000)
    slots.push({
      booking_id: booking.id,
      branch_id: branchId,
      slot_start: currentTime.toISOString(),
      slot_end: slotEnd.toISOString(),
      participants_count: participantsCount,
      slot_type: 'game_zone',
    })
    currentTime = slotEnd
  }
  
  if (slots.length > 0) {
    await supabase.from('booking_slots').insert(slots)
  }
  
  // UTILISER SESSION-BUILDER (même logique que admin)
  if (gameArea) {
    const { buildGameSessionsForAPI } = await import('@/lib/session-builder')
    
    const sessionResult = await buildGameSessionsForAPI({
      gameArea,
      numberOfGames,
      participants: participantsCount,
      startDateTime: gameStartDateTime || startDateTime,
      branchId,
      gameDuration,
      supabase
    })
    
    if (sessionResult.error) {
      // Supprimer le booking si échec sessions
      await supabase.from('bookings').delete().eq('id', booking.id)
      throw new Error(sessionResult.error)
    }
    
    console.log(`[createBooking] Built ${sessionResult.game_sessions.length} sessions via session-builder`)
    
    // Insérer les sessions
    if (sessionResult.game_sessions.length > 0) {
      await supabase.from('game_sessions').insert(sessionResult.game_sessions.map(s => ({
        ...s,
        booking_id: booking.id
      })))
    }
  }
  
  return { bookingId: booking.id, referenceCode }
}

/**
 * POST /api/orders
 * Créer une nouvelle commande depuis le site
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[POST /api/orders] Received body:', {
      order_type: body.order_type,
      game_area: body.game_area,
      number_of_games: body.number_of_games,
      participants_count: body.participants_count,
      requested_date: body.requested_date,
      requested_time: body.requested_time
    })
    
    // Validation des champs requis
    const requiredFields = ['branch_id', 'order_type', 'requested_date', 'requested_time', 'participants_count', 'customer_first_name', 'customer_phone', 'terms_accepted']
    const missingFields = requiredFields.filter(field => body[field] === undefined || body[field] === null || body[field] === '')
    
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
      number_of_games,
      event_type,
      event_celebrant_age,
    } = body
    
    // Générer le numéro de référence UNIQUE (même format pour order et booking)
    const referenceCode = generateShortReference()
    
    // Créer ou trouver le contact (avec les notes)
    const contactId = await findOrCreateContact(
      branch_id,
      customer_first_name,
      customer_last_name || null,
      customer_phone,
      customer_email || null,
      customer_notes || null
    )
    
    // Vérifier la disponibilité
    const availability = await checkAvailability(
      branch_id,
      order_type,
      requested_date,
      requested_time,
      participants_count,
      game_area,
      number_of_games || 1
    )
    
    console.log('[POST /api/orders] Availability result:', availability)
    
    let orderStatus: 'pending' | 'auto_confirmed' = 'pending'
    let bookingId: string | null = null
    let bookingReference: string | null = null
    
    if (availability.available) {
      // Créer le booking avec la MÊME référence que l'order
      const bookingResult = await createBooking(
        branch_id,
        order_type,
        requested_date,
        requested_time,
        participants_count,
        contactId,
        customer_first_name,
        customer_last_name,
        customer_phone,
        customer_email,
        customer_notes,
        game_area || null,
        number_of_games || 1,
        referenceCode, // Utilise la même référence que l'order
        availability.eventRoomId,
        availability.laserRoomIds
      )
      
      bookingId = bookingResult.bookingId
      bookingReference = bookingResult.referenceCode
      orderStatus = 'auto_confirmed'
    }
    
    // Créer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id,
        order_type,
        source: 'website', // Source = website car créé depuis le site public
        status: orderStatus,
        booking_id: bookingId,
        contact_id: contactId,
        request_reference: referenceCode, // Même référence que le booking
        customer_first_name,
        customer_last_name: customer_last_name || null,
        customer_phone,
        customer_email: customer_email || null,
        customer_notes: customer_notes || null,
        requested_date,
        requested_time,
        participants_count,
        game_area: game_area || null,
        number_of_games: number_of_games || 1,
        event_type: event_type || null,
        event_celebrant_age: event_celebrant_age || null,
        pending_reason: availability.available ? null : availability.reason,
        pending_details: availability.available ? null : availability.details,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: orderStatus,
        request_reference: referenceCode,
        booking_reference: bookingReference || referenceCode, // Toujours la même référence
        message: orderStatus === 'auto_confirmed' 
          ? 'Your reservation has been confirmed!'
          : 'Your request has been received. We will contact you shortly to confirm your reservation.'
      }
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('Error processing order:', error?.message || error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders
 * Lister les commandes (pour l'admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Synchroniser les commandes orphelines (booking supprimé mais status pas mis à jour)
    // Cela corrige les commandes dont le booking a été supprimé avant la mise en place de la synchro
    await supabase
      .from('orders')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .is('booking_id', null)
      .in('status', ['auto_confirmed', 'manually_confirmed'])
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        branch:branches(id, name, slug),
        booking:bookings(id, reference_code, status, start_datetime, end_datetime, participants_count),
        contact:contacts(id, first_name, last_name, phone, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (branchId) {
      query = query.eq('branch_id', branchId)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: orders, error } = await query
    
    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }
    
    // Compter les pending pour le badge
    const { count: pendingCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('branch_id', branchId || '')
    
    return NextResponse.json({
      success: true,
      orders,
      pending_count: pendingCount || 0
    })
    
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
