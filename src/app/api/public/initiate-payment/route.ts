/**
 * API publique pour initier un paiement via iCount PayPages
 *
 * NOUVEAU FLUX (PCI-DSS compliant):
 * 1. Frontend appelle cette API avec order_id
 * 2. Cette API crée un payment 'pending' et génère sale_url
 * 3. Frontend redirige le client vers sale_url (page hébergée iCount)
 * 4. Client paie sur page iCount (sécurisé)
 * 5. iCount webhook notifie notre serveur du résultat
 * 6. Webhook met à jour payment + order
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPaymentProvider } from '@/lib/payment-provider'
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface InitiatePaymentRequest {
  order_id: string
  amount: number
  payment_type: 'deposit' | 'full' | 'balance'
}

interface InitiatePaymentResponse {
  success: boolean
  payment_id?: string
  payment_url?: string
  expires_at?: string
  error?: string
}

/**
 * POST /api/public/initiate-payment
 * Créer un payment et retourner l'URL de paiement hébergée
 */
export async function POST(request: NextRequest): Promise<NextResponse<InitiatePaymentResponse>> {
  // Rate limiting (5 req/min par IP)
  const clientIp = getClientIp(request.headers)
  const rateLimit = checkRateLimit(clientIp, 5, 60 * 1000)

  if (!rateLimit.success) {
    console.warn(`[INITIATE-PAYMENT] Rate limit exceeded for IP: ${clientIp}`)
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  try {
    const body: InitiatePaymentRequest = await request.json()
    const { order_id, amount, payment_type } = body

    // Validation
    if (!order_id || !amount || !payment_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (amount < 5) {
      return NextResponse.json(
        { success: false, error: 'Minimum payment amount is 5₪' },
        { status: 400 }
      )
    }

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Vérifier statut commande
    if (order.status === 'closed' || order.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'This order cannot receive payments' },
        { status: 400 }
      )
    }

    // Nettoyer les vieux payments expirés pour cet order (au lieu de CRON)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 10 * 60 * 1000)
    await supabase
      .from('payments')
      .update({ status: 'failed', notes: 'Payment link expired' })
      .eq('order_id', order_id)
      .eq('status', 'pending')
      .eq('payment_method', 'paypage')
      .lt('created_at', twoHoursAgo.toISOString())

    // Vérifier si paiement en cours existe
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('id, icount_sale_url, payment_expires_at, created_at')
      .eq('order_id', order_id)
      .eq('status', 'pending')
      .eq('payment_method', 'paypage')
      .limit(1)

    if (pendingPayments && pendingPayments.length > 0) {
      const pending = pendingPayments[0]
      const createdAt = new Date(pending.created_at)
      const ageMs = Date.now() - createdAt.getTime()

      // Si < 2min, retourner l'URL existante (éviter spam de payments)
      if (ageMs < 2 * 60 * 1000) {
        console.log(`[INITIATE-PAYMENT] Reusing existing payment ${pending.id}`)
        return NextResponse.json({
          success: true,
          payment_id: pending.id,
          payment_url: pending.icount_sale_url,
          expires_at: pending.payment_expires_at,
        })
      }

      // Si > 2min, supprimer (abandon)
      console.log(`[INITIATE-PAYMENT] Cleaning up stale payment ${pending.id}`)
      await supabase.from('payments').delete().eq('id', pending.id)
    }

    // Récupérer le provider iCount
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment service not configured' },
        { status: 500 }
      )
    }

    // Générer l'URL de paiement via PayPages
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'

    const saleResult = await provider.payPages.generateSale({
      paypage_id: 1, // TODO: Récupérer depuis branch_settings ou config
      currency_code: 'ILS',
      sum: amount,
      description: `${payment_type === 'deposit' ? 'Acompte' : 'Paiement'} réservation ${order.request_reference}`,

      // Client info
      client_name: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
      first_name: order.customer_first_name,
      last_name: order.customer_last_name || undefined,
      email: order.customer_email || undefined,
      phone: order.customer_phone || undefined,

      // URLs
      success_url: `${baseUrl}/payment/success?order_id=${order_id}`,
      failure_url: `${baseUrl}/payment/failure?order_id=${order_id}`,
      cancel_url: `${baseUrl}/payment/cancel?order_id=${order_id}`,
      ipn_url: `${baseUrl}/api/webhooks/icount-paypage`,

      page_lang: 'he',
      is_iframe: false,
    })

    if (!saleResult.success || !saleResult.data) {
      console.error('[INITIATE-PAYMENT] Failed to generate sale:', saleResult.error)
      return NextResponse.json(
        { success: false, error: saleResult.error?.message || 'Failed to create payment link' },
        { status: 500 }
      )
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 heures

    // Créer le payment dans la DB
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id,
        booking_id: order.booking_id,
        contact_id: order.contact_id,
        branch_id: order.branch_id,
        amount,
        currency: 'ILS',
        payment_type,
        payment_method: 'paypage',
        status: 'pending',
        icount_sale_uniqid: saleResult.data.sale_uniqid,
        icount_sale_url: saleResult.data.sale_url,
        icount_paypage_id: parseInt(saleResult.data.paypage_id),
        payment_expires_at: expiresAt.toISOString(),
        notes: 'Payment initiated via PayPages',
        processed_by: null, // Public payment
      })
      .select()
      .single()

    if (paymentError || !payment) {
      console.error('[INITIATE-PAYMENT] Failed to create payment:', paymentError)
      return NextResponse.json(
        { success: false, error: 'Failed to create payment record' },
        { status: 500 }
      )
    }

    console.log(`[INITIATE-PAYMENT] Payment created: ${payment.id}, sale_uniqid: ${saleResult.data.sale_uniqid}`)

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      payment_url: saleResult.data.sale_url,
      expires_at: expiresAt.toISOString(),
    })

  } catch (error) {
    console.error('[INITIATE-PAYMENT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
