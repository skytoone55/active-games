/**
 * API Admin pour initier un paiement via iCount PayPages
 *
 * Version sécurisée PCI-DSS pour paiements admin
 * Utilise PayPages au lieu de débit direct
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { getPaymentProvider } from '@/lib/payment-provider'

interface InitiateAdminPaymentRequest {
  amount: number
  paymentType: 'full' | 'deposit' | 'balance'
  notes?: string
}

/**
 * POST /api/orders/[id]/payment-admin
 * Initier un paiement carte via PayPages pour l'admin
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

    const { id } = await params
    const body: InitiateAdminPaymentRequest = await request.json()
    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!body.paymentType || !['full', 'deposit', 'balance'].includes(body.paymentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment type' },
        { status: 400 }
      )
    }

    // Récupérer la commande
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: orderError } = await (supabase as any)
      .from('orders')
      .select('*')
      .eq('id', id)
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

    // Vérifier si la commande est fermée
    if (order.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'Cannot add payment to a closed order' },
        { status: 400 }
      )
    }

    // Nettoyer vieux payments expirés
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 10 * 60 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('payments')
      .update({ status: 'failed', notes: 'Payment link expired' })
      .eq('order_id', id)
      .eq('status', 'pending')
      .eq('payment_method', 'paypage')
      .lt('created_at', twoHoursAgo.toISOString())

    // Vérifier payments en cours
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingPayments } = await (supabase as any)
      .from('payments')
      .select('id, icount_sale_url, payment_expires_at, created_at')
      .eq('order_id', id)
      .eq('status', 'pending')
      .eq('payment_method', 'paypage')
      .limit(1)

    if (pendingPayments && pendingPayments.length > 0) {
      const pending = pendingPayments[0]
      const createdAt = new Date(pending.created_at)
      const ageMs = Date.now() - createdAt.getTime()

      if (ageMs < 2 * 60 * 1000) {
        return NextResponse.json({
          success: true,
          payment_id: pending.id,
          payment_url: pending.icount_sale_url,
          expires_at: pending.payment_expires_at,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('payments').delete().eq('id', pending.id)
    }

    // Récupérer provider
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    // Générer PayPage
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'

    const saleResult = await provider.payPages.generateSale({
      paypage_id: 1,
      currency_code: 'ILS',
      sum: body.amount,
      description: `${body.paymentType === 'deposit' ? 'Acompte' : 'Paiement'} commande ${order.request_reference}`,

      client_name: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
      first_name: order.customer_first_name,
      last_name: order.customer_last_name || undefined,
      email: order.customer_email || undefined,
      phone: order.customer_phone || undefined,

      success_url: `${baseUrl}/admin/orders?payment_success=true&order_id=${id}`,
      failure_url: `${baseUrl}/admin/orders?payment_failure=true&order_id=${id}`,
      cancel_url: `${baseUrl}/admin/orders?payment_cancel=true&order_id=${id}`,
      ipn_url: `${baseUrl}/api/webhooks/icount-paypage`,

      page_lang: 'he',
      is_iframe: true, // Pour affichage en iframe dans admin
    })

    if (!saleResult.success || !saleResult.data) {
      return NextResponse.json(
        { success: false, error: saleResult.error?.message || 'Failed to create payment link' },
        { status: 500 }
      )
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)

    // Créer payment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payment, error: paymentError } = await (supabase as any)
      .from('payments')
      .insert({
        order_id: id,
        booking_id: order.booking_id,
        contact_id: order.contact_id,
        branch_id: order.branch_id,
        amount: body.amount,
        currency: 'ILS',
        payment_type: body.paymentType,
        payment_method: 'paypage',
        status: 'pending',
        icount_sale_uniqid: saleResult.data.sale_uniqid,
        icount_sale_url: saleResult.data.sale_url,
        icount_paypage_id: parseInt(saleResult.data.paypage_id),
        payment_expires_at: expiresAt.toISOString(),
        notes: body.notes || 'Admin payment via PayPages',
        processed_by: user.id,
      })
      .select()
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Failed to create payment record' },
        { status: 500 }
      )
    }

    // Log l'action
    await logOrderAction({
      userId: user.id,
      userRole: user.role,
      userName: `${user.profile.first_name} ${user.profile.last_name}`.trim() || user.email,
      action: 'updated',
      orderId: id,
      orderRef: order.request_reference,
      branchId: order.branch_id,
      details: {
        payment_initiated: true,
        amount: body.amount,
        payment_type: body.paymentType,
        method: 'paypage'
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      payment_url: saleResult.data.sale_url,
      expires_at: expiresAt.toISOString(),
      is_iframe: true,
    })

  } catch (error) {
    console.error('[PAYMENT-ADMIN] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
