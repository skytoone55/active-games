/**
 * API Route pour gérer une réservation individuelle
 * GET: Récupérer une réservation
 * PUT: Mettre à jour une réservation
 * DELETE: Annuler/supprimer une réservation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logBookingAction, logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { UserRole, Booking, BookingSlot, GameSession } from '@/lib/supabase/types'

/**
 * GET /api/bookings/[id]
 * Récupère une réservation avec ses slots et sessions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('agenda', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Récupérer le booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single<Booking>()

    if (error || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found', messageKey: 'errors.bookingNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && booking.branch_id) {
      if (!user.branchIds.includes(booking.branch_id)) {
        return NextResponse.json(
          { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
          { status: 403 }
        )
      }
    }

    // Récupérer les slots et sessions
    const [slotsResult, sessionsResult] = await Promise.all([
      supabase
        .from('booking_slots')
        .select('*')
        .eq('booking_id', id)
        .order('slot_start')
        .returns<BookingSlot[]>(),
      supabase
        .from('game_sessions')
        .select('*')
        .eq('booking_id', id)
        .order('session_order')
        .returns<GameSession[]>()
    ])

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        slots: slotsResult.data || [],
        game_sessions: sessionsResult.data || []
      }
    })

  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bookings/[id]
 * Met à jour une réservation (participants, datetime, customer info, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('agenda', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer le booking actuel
    const { data: oldBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single<Booking>()

    if (fetchError || !oldBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found', messageKey: 'errors.bookingNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && oldBooking.branch_id) {
      if (!user.branchIds.includes(oldBooking.branch_id)) {
        return NextResponse.json(
          { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
          { status: 403 }
        )
      }
    }

    // Construire les données de mise à jour
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}
    const changedFields: string[] = []

    if (body.type !== undefined && body.type !== oldBooking.type) {
      updateData.type = body.type
      changedFields.push('type')
    }
    if (body.branch_id !== undefined && body.branch_id !== oldBooking.branch_id) {
      updateData.branch_id = body.branch_id
      changedFields.push('branch_id')
    }
    if (body.start_datetime !== undefined && body.start_datetime !== oldBooking.start_datetime) {
      updateData.start_datetime = body.start_datetime
      changedFields.push('start_datetime')
    }
    if (body.end_datetime !== undefined && body.end_datetime !== oldBooking.end_datetime) {
      updateData.end_datetime = body.end_datetime
      changedFields.push('end_datetime')
    }
    if (body.game_start_datetime !== undefined) {
      updateData.game_start_datetime = body.game_start_datetime
    }
    if (body.game_end_datetime !== undefined) {
      updateData.game_end_datetime = body.game_end_datetime
    }
    if (body.participants_count !== undefined && body.participants_count !== oldBooking.participants_count) {
      updateData.participants_count = body.participants_count
      changedFields.push('participants_count')
    }
    if (body.event_room_id !== undefined) {
      updateData.event_room_id = body.event_room_id
    }
    if (body.customer_first_name !== undefined && body.customer_first_name !== oldBooking.customer_first_name) {
      updateData.customer_first_name = body.customer_first_name
      changedFields.push('customer_first_name')
    }
    if (body.customer_last_name !== undefined && body.customer_last_name !== oldBooking.customer_last_name) {
      updateData.customer_last_name = body.customer_last_name
      changedFields.push('customer_last_name')
    }
    if (body.customer_phone !== undefined && body.customer_phone !== oldBooking.customer_phone) {
      updateData.customer_phone = body.customer_phone
      changedFields.push('customer_phone')
    }
    if (body.customer_email !== undefined && body.customer_email !== oldBooking.customer_email) {
      updateData.customer_email = body.customer_email
      changedFields.push('customer_email')
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes
    }
    if (body.color !== undefined) {
      updateData.color = body.color
    }
    if (body.primary_contact_id !== undefined) {
      updateData.primary_contact_id = body.primary_contact_id
    }

    updateData.updated_at = new Date().toISOString()

    // Mettre à jour le booking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single() as { data: Booking | null; error: any }

    if (updateError || !updatedBooking) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update booking', messageKey: 'errors.updateFailed' },
        { status: 500 }
      )
    }

    // Si primary_contact_id a changé, mettre à jour booking_contacts
    if (body.primary_contact_id !== undefined && body.primary_contact_id !== oldBooking.primary_contact_id) {
      // Supprimer les anciennes relations
      await supabase
        .from('booking_contacts')
        .delete()
        .eq('booking_id', id)

      // Créer la nouvelle relation si fournie
      if (body.primary_contact_id) {
        await supabase
          .from('booking_contacts')
          // @ts-expect-error - Supabase typing
          .insert({
            booking_id: id,
            contact_id: body.primary_contact_id,
            is_primary: true,
            role: null
          })
      }
    }

    // Si des slots sont fournis, les recréer
    if (body.slots && Array.isArray(body.slots)) {
      // Supprimer les anciens slots
      await supabase
        .from('booking_slots')
        .delete()
        .eq('booking_id', id)

      // Créer les nouveaux slots
      if (body.slots.length > 0) {
        const slotsToInsert = body.slots.map((slot: { slot_start: string; slot_end: string; participants_count: number }) => ({
          booking_id: id,
          branch_id: updateData.branch_id || oldBooking.branch_id,
          slot_start: slot.slot_start,
          slot_end: slot.slot_end,
          participants_count: slot.participants_count,
          slot_type: 'game_zone',
        }))

        await supabase
          .from('booking_slots')
          .insert(slotsToInsert)
      }
    }

    // Si des game_sessions sont fournies, les recréer
    if (body.game_sessions && Array.isArray(body.game_sessions)) {
      // Supprimer les anciennes sessions
      await supabase
        .from('game_sessions')
        .delete()
        .eq('booking_id', id)

      // Créer les nouvelles sessions
      if (body.game_sessions.length > 0) {
        const sessionsToInsert = body.game_sessions.map((session: {
          game_area: 'ACTIVE' | 'LASER';
          start_datetime: string;
          end_datetime: string;
          laser_room_id?: string | null;
          session_order: number;
          pause_before_minutes: number;
        }) => ({
          booking_id: id,
          game_area: session.game_area,
          start_datetime: session.start_datetime,
          end_datetime: session.end_datetime,
          laser_room_id: session.laser_room_id || null,
          session_order: session.session_order,
          pause_before_minutes: session.pause_before_minutes,
        }))

        await supabase
          .from('game_sessions')
          .insert(sessionsToInsert)
      }
    }

    // Synchroniser avec l'order correspondante
    const orderUpdateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updateData.start_datetime) {
      const bookingDate = new Date(updateData.start_datetime)
      orderUpdateData.requested_date = bookingDate.toISOString().split('T')[0]
      orderUpdateData.requested_time = bookingDate.toTimeString().slice(0, 5)
    }
    if (updateData.participants_count !== undefined) {
      orderUpdateData.participants_count = updateData.participants_count
    }
    if (updateData.customer_first_name !== undefined) {
      orderUpdateData.customer_first_name = updateData.customer_first_name
    }
    if (updateData.customer_last_name !== undefined) {
      orderUpdateData.customer_last_name = updateData.customer_last_name
    }
    if (updateData.customer_phone !== undefined) {
      orderUpdateData.customer_phone = updateData.customer_phone
    }
    if (updateData.customer_email !== undefined) {
      orderUpdateData.customer_email = updateData.customer_email
    }
    if (body.game_sessions && body.game_sessions.length > 0) {
      orderUpdateData.game_area = body.game_sessions[0].game_area
      orderUpdateData.number_of_games = body.game_sessions.length
    }

    // Récupérer l'order liée pour le log
    const { data: linkedOrder } = await supabase
      .from('orders')
      .select('id, request_reference')
      .eq('booking_id', id)
      .single<{ id: string; request_reference: string }>()

    // Mettre à jour l'order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('orders')
      .update(orderUpdateData)
      .eq('booking_id', id)

    // Logger la modification du booking
    await logBookingAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
      action: 'updated',
      bookingId: id,
      bookingRef: updatedBooking.reference_code,
      branchId: updatedBooking.branch_id,
      details: {
        changedFields,
        oldValues: {
          participants_count: oldBooking.participants_count,
          start_datetime: oldBooking.start_datetime,
          customer_first_name: oldBooking.customer_first_name,
          customer_last_name: oldBooking.customer_last_name
        },
        newValues: {
          participants_count: updatedBooking.participants_count,
          start_datetime: updatedBooking.start_datetime,
          customer_first_name: updatedBooking.customer_first_name,
          customer_last_name: updatedBooking.customer_last_name
        }
      },
      ipAddress
    })

    // Logger aussi la mise à jour de l'order si elle existe
    if (linkedOrder) {
      await logOrderAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
        action: 'confirmed', // 'confirmed' pour représenter une mise à jour (pas d'action 'updated' dans le type actuel)
        orderId: linkedOrder.id,
        orderRef: linkedOrder.request_reference,
        branchId: updatedBooking.branch_id,
        details: {
          bookingUpdated: true,
          changedFields
        },
        ipAddress
      })
    }

    return NextResponse.json({ success: true, booking: updatedBooking })

  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bookings/[id]
 * Annuler ou supprimer une réservation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('agenda', 'delete')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'
    const reason = searchParams.get('reason') || undefined

    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer le booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single<Booking>()

    if (fetchError || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found', messageKey: 'errors.bookingNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && booking.branch_id) {
      if (!user.branchIds.includes(booking.branch_id)) {
        return NextResponse.json(
          { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
          { status: 403 }
        )
      }
    }

    if (hardDelete) {
      // Suppression définitive
      // Mettre à jour l'order correspondante d'abord
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          booking_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', id)

      // Supprimer le booking (les slots et sessions sont supprimés en cascade)
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting booking:', deleteError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete booking', messageKey: 'errors.deleteFailed' },
          { status: 500 }
        )
      }

      // Logger la suppression
      await logBookingAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
        action: 'deleted',
        bookingId: id,
        bookingRef: booking.reference_code,
        branchId: booking.branch_id,
        details: {
          customerName: `${booking.customer_first_name} ${booking.customer_last_name || ''}`.trim(),
          type: booking.type,
          participants: booking.participants_count
        },
        ipAddress
      })

    } else {
      // Annulation (soft delete)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: cancelError } = await (supabase as any)
        .from('bookings')
        .update({
          status: 'CANCELLED',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (cancelError) {
        console.error('Error cancelling booking:', cancelError)
        return NextResponse.json(
          { success: false, error: 'Failed to cancel booking', messageKey: 'errors.cancelFailed' },
          { status: 500 }
        )
      }

      // Mettre à jour l'order correspondante
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', id)

      // Logger l'annulation
      await logBookingAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
        action: 'cancelled',
        bookingId: id,
        bookingRef: booking.reference_code,
        branchId: booking.branch_id,
        details: {
          reason,
          customerName: `${booking.customer_first_name} ${booking.customer_last_name || ''}`.trim(),
          type: booking.type
        },
        ipAddress
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
