/**
 * API Route pour gérer une commande individuelle
 * GET: Récupérer une commande
 * PATCH: Mettre à jour le statut (confirmer, annuler)
 * DELETE: Supprimer une commande
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * GET /api/orders/[id]
 * Récupérer une commande
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        branch:branches(id, name, slug),
        booking:bookings(id, reference_code, status, start_datetime, end_datetime),
        contact:contacts(id, first_name, last_name, phone, email)
      `)
      .eq('id', id)
      .single()
    
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, order })
    
  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/orders/[id]
 * Mettre à jour une commande (confirmer manuellement, annuler, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, user_id } = body
    
    // Récupérer la commande actuelle
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }
    
    if (action === 'confirm') {
      // Confirmer manuellement une commande pending
      if (order.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Order is not pending' },
          { status: 400 }
        )
      }
      
      // Utiliser la MÊME référence que l'order (pas de nouvelle génération)
      const bookingReference = order.request_reference
      
      // Récupérer les settings
      const { data: settings } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', order.branch_id)
        .single()
      
      const gameDuration = settings?.game_duration_minutes || 30
      const eventDuration = settings?.event_total_duration_minutes || 120
      const bufferBefore = settings?.event_buffer_before_minutes || 30
      
      const startDateTime = new Date(`${order.requested_date}T${order.requested_time}`)
      let endDateTime: Date
      let gameStartDateTime: Date | null = null
      let gameEndDateTime: Date | null = null
      
      if (order.order_type === 'EVENT') {
        endDateTime = new Date(startDateTime.getTime() + eventDuration * 60000)
        gameStartDateTime = new Date(startDateTime.getTime() + bufferBefore * 60000)
        gameEndDateTime = new Date(gameStartDateTime.getTime() + (order.number_of_games * gameDuration) * 60000)
      } else {
        endDateTime = new Date(startDateTime.getTime() + (order.number_of_games * gameDuration) * 60000)
        gameStartDateTime = startDateTime
        gameEndDateTime = endDateTime
      }
      
      // Créer le booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          branch_id: order.branch_id,
          type: order.order_type,
          status: 'CONFIRMED',
          start_datetime: startDateTime.toISOString(),
          end_datetime: endDateTime.toISOString(),
          game_start_datetime: gameStartDateTime?.toISOString(),
          game_end_datetime: gameEndDateTime?.toISOString(),
          participants_count: order.participants_count,
          customer_first_name: order.customer_first_name,
          customer_last_name: order.customer_last_name || '',
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          customer_notes_at_booking: order.customer_notes,
          primary_contact_id: order.contact_id,
          reference_code: bookingReference,
        })
        .select('id')
        .single()
      
      if (bookingError) {
        console.error('Error creating booking:', bookingError)
        return NextResponse.json(
          { success: false, error: 'Failed to create booking' },
          { status: 500 }
        )
      }
      
      // Créer la liaison contact
      await supabase
        .from('booking_contacts')
        .insert({
          booking_id: booking.id,
          contact_id: order.contact_id,
          is_primary: true,
        })
      
      // Créer les slots
      const slots = []
      let currentTime = new Date(gameStartDateTime || startDateTime)
      
      for (let i = 0; i < order.number_of_games; i++) {
        const slotEnd = new Date(currentTime.getTime() + gameDuration * 60000)
        slots.push({
          booking_id: booking.id,
          branch_id: order.branch_id,
          slot_start: currentTime.toISOString(),
          slot_end: slotEnd.toISOString(),
          participants_count: order.participants_count,
          slot_type: 'game_zone',
        })
        currentTime = slotEnd
      }
      
      if (slots.length > 0) {
        await supabase.from('booking_slots').insert(slots)
      }
      
      // Mettre à jour la commande
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'manually_confirmed',
          booking_id: booking.id,
          processed_at: new Date().toISOString(),
          processed_by: user_id || null,
        })
        .eq('id', id)
      
      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update order' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: 'Order confirmed successfully',
        booking_reference: bookingReference
      })
      
    } else if (action === 'cancel') {
      // Annuler la commande
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          processed_at: new Date().toISOString(),
          processed_by: user_id || null,
        })
        .eq('id', id)
      
      // Si un booking existe, l'annuler aussi
      if (order.booking_id) {
        await supabase
          .from('bookings')
          .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
            cancelled_reason: 'Order cancelled',
          })
          .eq('id', order.booking_id)
      }
      
      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to cancel order' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully'
      })
      
    } else if (action === 'reactivate') {
      // Réactiver une commande annulée (garder la même référence)
      if (order.status !== 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'Order is not cancelled' },
          { status: 400 }
        )
      }
      
      // Utiliser la référence originale de la commande
      const originalReference = order.request_reference
      
      // Vérifier si le booking existe encore et est annulé
      if (order.booking_id) {
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('id', order.booking_id)
          .single()
        
        if (existingBooking && existingBooking.status === 'CANCELLED') {
          // Réactiver le booking existant
          const { error: reactivateError } = await supabase
            .from('bookings')
            .update({
              status: 'CONFIRMED',
              cancelled_at: null,
              cancelled_reason: null,
            })
            .eq('id', order.booking_id)
          
          if (reactivateError) {
            console.error('Error reactivating booking:', reactivateError)
            return NextResponse.json(
              { success: false, error: 'Failed to reactivate booking' },
              { status: 500 }
            )
          }
          
          // Mettre à jour la commande
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'manually_confirmed',
              processed_at: new Date().toISOString(),
              processed_by: user_id || null,
            })
            .eq('id', id)
          
          if (updateError) {
            return NextResponse.json(
              { success: false, error: 'Failed to update order' },
              { status: 500 }
            )
          }
          
          return NextResponse.json({
            success: true,
            message: 'Order reactivated successfully',
            booking_reference: originalReference
          })
        }
      }
      
      // Si le booking n'existe plus, en créer un nouveau avec la MÊME référence
      // Récupérer les settings
      const { data: settings } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', order.branch_id)
        .single()
      
      const gameDuration = settings?.game_duration_minutes || 30
      const eventDuration = settings?.event_total_duration_minutes || 120
      const bufferBefore = settings?.event_buffer_before_minutes || 30
      
      const startDateTime = new Date(`${order.requested_date}T${order.requested_time}`)
      let endDateTime: Date
      let gameStartDateTime: Date | null = null
      let gameEndDateTime: Date | null = null
      
      if (order.order_type === 'EVENT') {
        endDateTime = new Date(startDateTime.getTime() + eventDuration * 60000)
        gameStartDateTime = new Date(startDateTime.getTime() + bufferBefore * 60000)
        gameEndDateTime = new Date(gameStartDateTime.getTime() + (order.number_of_games * gameDuration) * 60000)
      } else {
        endDateTime = new Date(startDateTime.getTime() + (order.number_of_games * gameDuration) * 60000)
        gameStartDateTime = startDateTime
        gameEndDateTime = endDateTime
      }
      
      // Créer le booking avec la MÊME référence originale
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          branch_id: order.branch_id,
          type: order.order_type,
          status: 'CONFIRMED',
          start_datetime: startDateTime.toISOString(),
          end_datetime: endDateTime.toISOString(),
          game_start_datetime: gameStartDateTime?.toISOString(),
          game_end_datetime: gameEndDateTime?.toISOString(),
          participants_count: order.participants_count,
          customer_first_name: order.customer_first_name,
          customer_last_name: order.customer_last_name || '',
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          customer_notes_at_booking: order.customer_notes,
          primary_contact_id: order.contact_id,
          reference_code: originalReference, // MÊME référence
        })
        .select('id')
        .single()
      
      if (bookingError) {
        console.error('Error creating booking:', bookingError)
        return NextResponse.json(
          { success: false, error: 'Failed to create booking' },
          { status: 500 }
        )
      }
      
      // Créer la liaison contact
      if (order.contact_id) {
        await supabase
          .from('booking_contacts')
          .insert({
            booking_id: booking.id,
            contact_id: order.contact_id,
            is_primary: true,
          })
      }
      
      // Créer les slots
      const slots = []
      let currentTime = new Date(gameStartDateTime || startDateTime)
      
      for (let i = 0; i < order.number_of_games; i++) {
        const slotEnd = new Date(currentTime.getTime() + gameDuration * 60000)
        slots.push({
          booking_id: booking.id,
          branch_id: order.branch_id,
          slot_start: currentTime.toISOString(),
          slot_end: slotEnd.toISOString(),
          participants_count: order.participants_count,
          slot_type: 'game_zone',
        })
        currentTime = slotEnd
      }
      
      if (slots.length > 0) {
        await supabase.from('booking_slots').insert(slots)
      }
      
      // Créer les game_sessions si c'est un GAME
      if (order.order_type === 'GAME' && order.game_area) {
        const sessions = []
        let sessionTime = new Date(gameStartDateTime || startDateTime)
        
        for (let i = 0; i < order.number_of_games; i++) {
          const sessionEnd = new Date(sessionTime.getTime() + gameDuration * 60000)
          sessions.push({
            booking_id: booking.id,
            game_area: order.game_area,
            start_datetime: sessionTime.toISOString(),
            end_datetime: sessionEnd.toISOString(),
            session_order: i + 1,
            pause_before_minutes: 0,
          })
          sessionTime = sessionEnd
        }
        
        if (sessions.length > 0) {
          await supabase.from('game_sessions').insert(sessions)
        }
      }
      
      // Mettre à jour la commande
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'manually_confirmed',
          booking_id: booking.id,
          processed_at: new Date().toISOString(),
          processed_by: user_id || null,
        })
        .eq('id', id)
      
      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update order' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: 'Order reactivated successfully',
        booking_reference: originalReference
      })
      
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]
 * Supprimer une commande
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
    
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete order' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
