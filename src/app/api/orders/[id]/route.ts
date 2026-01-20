/**
 * API Route pour gérer une commande individuelle
 * GET: Récupérer une commande
 * PATCH: Mettre à jour le statut (confirmer, annuler)
 * DELETE: Supprimer une commande
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, logBookingAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { sendBookingConfirmationEmail } from '@/lib/email-sender'
import { cancelOfferDirectBackground } from '@/lib/icount-documents'
import type { UserRole, Booking, Branch } from '@/lib/supabase/types'

/**
 * GET /api/orders/[id]
 * Récupérer une commande
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error } = await (supabase as any)
      .from('orders')
      .select(`
        *,
        branch:branches(id, name, slug),
        booking:bookings(id, reference_code, status, start_datetime, end_datetime),
        contact:contacts(id, first_name, last_name, phone, email)
      `)
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found', messageKey: 'errors.orderNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && order.branch_id) {
      if (!user.branchIds.includes(order.branch_id)) {
        return NextResponse.json(
          {
            success: false,
            error: 'BRANCH_ACCESS_DENIED',
            message: 'You don\'t have access to this branch',
            messageKey: 'errors.branchAccessDenied'
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ success: true, order })

  } catch (error) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
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
    // Vérifier les permissions (edit pour modifier)
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const { action } = body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer la commande actuelle
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found', messageKey: 'errors.orderNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && order.branch_id) {
      if (!user.branchIds.includes(order.branch_id)) {
        return NextResponse.json(
          {
            success: false,
            error: 'BRANCH_ACCESS_DENIED',
            message: 'You don\'t have access to this branch',
            messageKey: 'errors.branchAccessDenied'
          },
          { status: 403 }
        )
      }
    }

    if (action === 'confirm') {
      // Confirmer manuellement une commande pending
      // DÉSACTIVÉ: L'utilisateur doit passer par l'agenda pour validation manuelle
      return NextResponse.json(
        {
          success: false,
          error: 'Direct confirmation disabled',
          message: 'Please use "Reactivate" button to open this order in the agenda for manual confirmation.',
          messageKey: 'errors.directConfirmDisabled'
        },
        { status: 400 }
      )

    } else if (action === 'cancel') {
      // Annuler la commande
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
        })
        .eq('id', id)

      // Si un booking existe, l'annuler aussi
      if (order.booking_id) {
        // Récupérer les infos du booking pour annuler le devis
        const { data: bookingToCancel } = await supabase
          .from('bookings')
          .select('icount_offer_id, branch_id')
          .eq('id', order.booking_id)
          .single()

        // Annuler le devis iCount si présent (en background)
        if (bookingToCancel?.icount_offer_id && bookingToCancel?.branch_id) {
          cancelOfferDirectBackground(bookingToCancel.icount_offer_id, bookingToCancel.branch_id, 'Order cancelled')
        }

        await supabase
          .from('bookings')
          .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
            cancelled_reason: 'Order cancelled',
          })
          .eq('id', order.booking_id)

        // Logger l'annulation du booking
        await logBookingAction({
          userId: user.id,
          userRole: user.role as UserRole,
          userName: `${user.profile.first_name} ${user.profile.last_name}`,
          action: 'cancelled',
          bookingId: order.booking_id,
          bookingRef: order.request_reference,
          branchId: order.branch_id,
          details: { reason: 'Order cancelled', orderId: id },
          ipAddress
        })
      }

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to cancel order', messageKey: 'errors.cancelFailed' },
          { status: 500 }
        )
      }

      // Logger l'annulation de la commande
      await logOrderAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`,
        action: 'cancelled',
        orderId: id,
        orderRef: order.request_reference,
        branchId: order.branch_id,
        details: { previousStatus: order.status },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully'
      })

    } else if (action === 'reactivate') {
      // Réactiver une commande annulée (garder la même référence)
      if (order.status !== 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'Order is not cancelled', messageKey: 'errors.orderNotCancelled' },
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
              { success: false, error: 'Failed to reactivate booking', messageKey: 'errors.reactivateFailed' },
              { status: 500 }
            )
          }

          // Mettre à jour la commande
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'manually_confirmed',
              processed_at: new Date().toISOString(),
              processed_by: user.id,
            })
            .eq('id', id)

          if (updateError) {
            return NextResponse.json(
              { success: false, error: 'Failed to update order', messageKey: 'errors.updateFailed' },
              { status: 500 }
            )
          }

          // Logger la réactivation
          await logOrderAction({
            userId: user.id,
            userRole: user.role as UserRole,
            userName: `${user.profile.first_name} ${user.profile.last_name}`,
            action: 'confirmed',
            orderId: id,
            orderRef: originalReference,
            branchId: order.branch_id,
            details: { reactivated: true, previousStatus: 'cancelled' },
            ipAddress
          })

          await logBookingAction({
            userId: user.id,
            userRole: user.role as UserRole,
            userName: `${user.profile.first_name} ${user.profile.last_name}`,
            action: 'updated',
            bookingId: order.booking_id,
            bookingRef: originalReference,
            branchId: order.branch_id,
            details: { reactivated: true, previousStatus: 'CANCELLED' },
            ipAddress
          })

          // Envoyer l'email de confirmation si le client a un email
          if (order.customer_email) {
            // Récupérer le booking complet
            const { data: bookingData } = await supabase
              .from('bookings')
              .select('*')
              .eq('id', order.booking_id)
              .single()

            // Récupérer la branche
            const { data: branchData } = await supabase
              .from('branches')
              .select('*')
              .eq('id', order.branch_id)
              .single()

            if (bookingData && branchData) {
              sendBookingConfirmationEmail({
                booking: bookingData as Booking,
                branch: branchData as Branch,
                triggeredBy: user.id
              }).catch(err => {
                console.error('Failed to send confirmation email on reactivation:', err)
              })
            }
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
          { success: false, error: 'Failed to create booking', messageKey: 'errors.createBookingFailed' },
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
          processed_by: user.id,
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update order', messageKey: 'errors.updateFailed' },
          { status: 500 }
        )
      }

      // Logger les actions
      await logOrderAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`,
        action: 'confirmed',
        orderId: id,
        orderRef: originalReference,
        branchId: order.branch_id,
        details: { reactivated: true, newBookingId: booking.id },
        ipAddress
      })

      await logBookingAction({
        userId: user.id,
        userRole: user.role as UserRole,
        userName: `${user.profile.first_name} ${user.profile.last_name}`,
        action: 'created',
        bookingId: booking.id,
        bookingRef: originalReference,
        branchId: order.branch_id,
        details: { fromReactivatedOrder: id, orderType: order.order_type },
        ipAddress
      })

      // Envoyer l'email de confirmation si le client a un email
      if (order.customer_email) {
        // Récupérer le booking complet qu'on vient de créer
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', booking.id)
          .single()

        // Récupérer la branche
        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('id', order.branch_id)
          .single()

        if (bookingData && branchData) {
          sendBookingConfirmationEmail({
            booking: bookingData as Booking,
            branch: branchData as Branch,
            triggeredBy: user.id
          }).catch(err => {
            console.error('Failed to send confirmation email on reactivation (new booking):', err)
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Order reactivated successfully',
        booking_reference: originalReference
      })

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action', messageKey: 'errors.invalidAction' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
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
    // Vérifier les permissions (delete pour supprimer)
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'delete')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer la commande avant suppression pour le log
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found', messageKey: 'errors.orderNotFound' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && order.branch_id) {
      if (!user.branchIds.includes(order.branch_id)) {
        return NextResponse.json(
          {
            success: false,
            error: 'BRANCH_ACCESS_DENIED',
            message: 'You don\'t have access to this branch',
            messageKey: 'errors.branchAccessDenied'
          },
          { status: 403 }
        )
      }
    }

    // Annuler le devis iCount si un booking est associé (en background)
    if (order.booking_id) {
      // Récupérer les infos du booking avant suppression
      const { data: booking } = await supabase
        .from('bookings')
        .select('icount_offer_id, branch_id')
        .eq('id', order.booking_id)
        .single()

      if (booking?.icount_offer_id) {
        cancelOfferDirectBackground(booking.icount_offer_id, booking.branch_id, 'Order deleted')
      }
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete order', messageKey: 'errors.deleteFailed' },
        { status: 500 }
      )
    }

    // Logger la suppression
    await logOrderAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: 'deleted',
      orderId: id,
      orderRef: order.request_reference,
      branchId: order.branch_id,
      details: {
        customerName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
        status: order.status,
        orderType: order.order_type
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
