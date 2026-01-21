/**
 * API Route pour rembourser un paiement
 * POST: Annuler le document iCount et rembourser la CB associée
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { getPaymentProvider } from '@/lib/payment-provider'
import type { UserRole } from '@/lib/supabase/types'
import type { ICountDocType } from '@/lib/payment-provider/icount/documents'

interface RefundRequest {
  payment_id: string
  reason?: string
}

/**
 * POST /api/orders/[id]/refund
 * Rembourser un paiement spécifique
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id: orderId } = await params
    const body: RefundRequest = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation
    if (!body.payment_id) {
      return NextResponse.json(
        { success: false, error: 'Payment ID required' },
        { status: 400 }
      )
    }

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && order.branch_id) {
      if (!user.branchIds.includes(order.branch_id)) {
        return NextResponse.json(
          { success: false, error: 'Branch access denied' },
          { status: 403 }
        )
      }
    }

    // Récupérer le paiement
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', body.payment_id)
      .eq('order_id', orderId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Vérifier que le paiement n'est pas déjà remboursé
    if (payment.status === 'refunded') {
      return NextResponse.json(
        { success: false, error: 'Payment already refunded' },
        { status: 400 }
      )
    }

    // Vérifier qu'on a un document iCount pour ce paiement
    if (!payment.icount_doctype || !payment.icount_docnum) {
      return NextResponse.json(
        { success: false, error: 'No iCount document associated with this payment. Cannot refund.' },
        { status: 400 }
      )
    }

    // Vérifier que c'était un paiement CB (seuls les CB peuvent être remboursés via iCount)
    if (payment.payment_method !== 'card') {
      return NextResponse.json(
        { success: false, error: 'Only card payments can be refunded via iCount' },
        { status: 400 }
      )
    }

    // Récupérer le provider de paiement
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    // Annuler le document iCount avec remboursement CB
    console.log('[REFUND] Cancelling document with refund:', payment.icount_doctype, payment.icount_docnum)

    const cancelResult = await provider.documents.cancelDocumentWithRefund(
      payment.icount_doctype as ICountDocType,
      payment.icount_docnum,
      body.reason || `Refund requested by ${user.profile.first_name} ${user.profile.last_name}`
    )

    if (!cancelResult.success) {
      console.error('[REFUND] Failed to cancel document:', cancelResult.error)
      return NextResponse.json(
        {
          success: false,
          error: cancelResult.error?.message || 'Failed to process refund',
          errorCode: cancelResult.error?.code,
        },
        { status: 400 }
      )
    }

    console.log('[REFUND] Document cancelled and refund processed')

    // Mettre à jour le paiement comme remboursé
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_reason: body.reason,
        refunded_by: user.id,
      })
      .eq('id', body.payment_id)

    if (updatePaymentError) {
      console.error('[REFUND] Error updating payment status:', updatePaymentError)
    }

    // Mettre à jour la commande
    const newPaidAmount = Math.max(0, (order.paid_amount || 0) - payment.amount)
    const totalAmount = order.total_amount || 0

    let newPaymentStatus = 'unpaid'
    if (newPaidAmount >= totalAmount && totalAmount > 0) {
      newPaymentStatus = 'fully_paid'
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'deposit_paid'
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        paid_amount: newPaidAmount,
        payment_status: newPaymentStatus,
      })
      .eq('id', orderId)

    if (updateOrderError) {
      console.error('[REFUND] Error updating order:', updateOrderError)
    }

    // Logger l'action
    await logOrderAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: 'updated',
      orderId,
      orderRef: order.request_reference,
      branchId: order.branch_id,
      details: {
        refundProcessed: true,
        paymentId: body.payment_id,
        amount: payment.amount,
        reason: body.reason,
        newPaymentStatus,
        totalPaid: newPaidAmount,
      },
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      refund: {
        paymentId: body.payment_id,
        amount: payment.amount,
        status: 'refunded',
      },
      order: {
        id: orderId,
        paymentStatus: newPaymentStatus,
        paidAmount: newPaidAmount,
      },
    })

  } catch (error) {
    console.error('[REFUND] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
