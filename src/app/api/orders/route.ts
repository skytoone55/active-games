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
    .eq('branch_id', branchId)
    .eq('phone', phone)
    .single()
  
  if (existing) {
    return existing.id
  }
  
  // Créer un nouveau contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      branch_id: branchId,
      first_name: firstName,
      last_name: lastName || '',
      phone,
      email: email || null,
      notes: notes || null,
      source: 'website'
    })
    .select('id')
    .single()
  
  if (error) {
    console.error('Error creating contact:', error)
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
    
    console.log('[POST /api/orders] Received order request:', {
      order_type: body.order_type,
      game_area: body.game_area,
      number_of_games: body.number_of_games,
      participants_count: body.participants_count,
      date: body.requested_date,
      time: body.requested_time
    })
    
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
    
    console.log('[POST /api/orders] Contact ID:', contactId)
    
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
    
    // 3. Construire les dates/heures du booking
    const startDateTime = new Date(`${requested_date}T${requested_time}`)
    const endDateTime = new Date(startDateTime.getTime() + (number_of_games * gameDuration * 60000))
    
    console.log('[POST /api/orders] Booking timespan:', startDateTime.toISOString(), 'to', endDateTime.toISOString())
    
    // 4. Construire les sessions avec session-builder (MÊME LOGIQUE QUE ADMIN)
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
      console.error('[POST /api/orders] Session building error:', err)
      return NextResponse.json(
        { success: false, error: 'Failed to allocate game sessions', details: String(err) },
        { status: 500 }
      )
    }
    
    if (sessionResult.error) {
      // Pas de salles disponibles ou autre erreur
      console.log('[POST /api/orders] Session allocation failed, creating pending order:', sessionResult.error)
      
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
        console.error('[POST /api/orders] Order creation error:', orderError)
        return NextResponse.json(
          { success: false, error: 'Failed to create order' },
          { status: 500 }
        )
      }
      
      console.log('[POST /api/orders] Pending order created:', order.id)
      
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
    
    console.log('[POST /api/orders] Creating booking with', sessionResult.game_sessions.length, 'sessions')
    
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
      console.error('[POST /api/orders] Booking creation error:', bookingError)
      return NextResponse.json(
        { success: false, error: 'Failed to create booking' },
        { status: 500 }
      )
    }
    
    console.log('[POST /api/orders] Booking created:', booking.id)
    
    // 6. Créer booking_contacts
    await supabase.from('booking_contacts').insert({
      booking_id: booking.id,
      contact_id: contactId,
      is_primary: true
    })
    
    // 7. Créer les slots
    const slots = []
    let slotTime = new Date(startDateTime)
    
    for (let i = 0; i < number_of_games; i++) {
      const slotEnd = new Date(slotTime.getTime() + gameDuration * 60000)
      slots.push({
        booking_id: booking.id,
        branch_id,
        slot_start: slotTime.toISOString(),
        slot_end: slotEnd.toISOString(),
        participants_count,
        slot_type: 'game_zone'
      })
      slotTime = slotEnd
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
        console.error('[POST /api/orders] Sessions insert error:', sessionsError)
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
      console.error('[POST /api/orders] Order creation error:', orderError)
      // Rollback booking
      await supabase.from('bookings').delete().eq('id', booking.id)
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }
    
    console.log('[POST /api/orders] Order created successfully:', order.id)
    
    return NextResponse.json({
      success: true,
      order_id: order.id,
      booking_id: booking.id,
      reference: order.request_reference,
      status: 'confirmed',
      message: 'Booking confirmed successfully'
    })
    
  } catch (error) {
    console.error('[POST /api/orders] Unexpected error:', error)
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
    orders,
    pending_count: pendingCount
  })
}
