/**
 * API publique pour payer l'acompte d'une réservation
 *
 * Cette API est appelée APRÈS la création de la commande (via /api/orders)
 * Elle effectue le débit immédiat de l'acompte via iCount
 *
 * FLUX:
 * 1. Frontend crée la commande (order_id retourné)
 * 2. Frontend appelle cette API avec les infos CB
 * 3. Cette API débite la carte via iCount
 * 4. Si succès: met à jour order avec payment_status
 * 5. Si échec: retourne erreur (la commande reste valide mais non payée)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPaymentProvider } from '@/lib/payment-provider'
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter'
import type { CreditCardInfo } from '@/lib/payment-provider/icount/credit-card'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PayDepositRequest {
  order_id: string
  amount: number
  card_info: {
    cc_number: string
    cc_validity: string // Format MMYY
    cc_cvv: string
    cc_holder_id: string
    cc_holder_name?: string
  }
}

/**
 * POST /api/public/pay-deposit
 * Payer l'acompte d'une commande existante
 */
export async function POST(request: NextRequest) {
  // Rate limiting pour les requêtes publiques (5 req/min par IP)
  const clientIp = getClientIp(request.headers)
  const rateLimit = checkRateLimit(clientIp, 5, 60 * 1000)

  if (!rateLimit.success) {
    console.warn(`[PAY-DEPOSIT] Rate limit exceeded for IP: ${clientIp}`)
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  try {
    const body: PayDepositRequest = await request.json()

    const { order_id, amount, card_info } = body

    // Validation de base
    if (!order_id || !amount || !card_info) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!card_info.cc_number || !card_info.cc_validity || !card_info.cc_cvv || !card_info.cc_holder_id) {
      return NextResponse.json(
        { success: false, error: 'Incomplete card information' },
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

    // Vérifier que la commande peut être payée
    if (order.status === 'closed' || order.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'This order cannot receive payments' },
        { status: 400 }
      )
    }

    // Vérifier que l'acompte n'a pas déjà été payé
    if (order.payment_status === 'deposit_paid' || order.payment_status === 'fully_paid') {
      return NextResponse.json(
        { success: false, error: 'Deposit already paid' },
        { status: 400 }
      )
    }

    // PROTECTION DOUBLE PAIEMENT: Vérifier qu'il n'y a pas de paiement en cours
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('id, created_at')
      .eq('order_id', order_id)
      .eq('status', 'pending')
      .limit(1)

    if (pendingPayments && pendingPayments.length > 0) {
      const pendingPayment = pendingPayments[0]
      const createdAt = new Date(pendingPayment.created_at)
      const now = new Date()
      const ageMs = now.getTime() - createdAt.getTime()

      // Si le paiement pending a moins de 2 minutes, bloquer
      if (ageMs < 2 * 60 * 1000) {
        console.warn(`[PAY-DEPOSIT] Blocked duplicate payment attempt for order ${order_id}`)
        return NextResponse.json(
          { success: false, error: 'A payment is already being processed' },
          { status: 409 }
        )
      } else {
        // Si le paiement pending est trop vieux (>2min), c'est probablement un abandon
        console.warn(`[PAY-DEPOSIT] Cleaning up stale pending payment ${pendingPayment.id}`)
        await supabase.from('payments').delete().eq('id', pendingPayment.id)
      }
    }

    // Récupérer le provider de paiement pour cette branche
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment service not configured for this branch' },
        { status: 500 }
      )
    }

    // Préparer les infos carte
    const cardInfoForPayment: CreditCardInfo = {
      cc_number: card_info.cc_number.replace(/\s/g, ''),
      cc_validity: card_info.cc_validity.replace(/[^0-9]/g, ''),
      cc_cvv: card_info.cc_cvv,
      cc_holder_id: card_info.cc_holder_id.replace(/[^0-9]/g, ''),
      cc_holder_name: card_info.cc_holder_name,
    }

    // Effectuer le paiement via iCount
    console.log('[PAY-DEPOSIT] Billing card for order:', order_id, 'amount:', amount)

    const billResult = await provider.creditCard.billCard({
      customClientId: order.contact_id || undefined,
      email: order.customer_email || undefined,
      clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
      cardInfo: cardInfoForPayment,
      amount,
      currencyCode: 'ILS',
      description: `Acompte réservation ${order.request_reference}`,
      isTest: false, // Production
    })

    console.log('[PAY-DEPOSIT] Bill result:', JSON.stringify(billResult, null, 2))

    if (!billResult.success || !billResult.data) {
      console.log('[PAY-DEPOSIT] Payment failed:', billResult.error)
      return NextResponse.json(
        {
          success: false,
          error: billResult.error?.message || 'Payment failed',
          errorCode: billResult.error?.code,
        },
        { status: 400 }
      )
    }

    // Paiement réussi - créer le document iCount (invrec)
    console.log('[PAY-DEPOSIT] Creating iCount document for payment')

    // Parser la validité pour extraire mois/année
    const validity = card_info.cc_validity.replace(/[^0-9]/g, '')
    const expMonth = parseInt(validity.slice(0, 2), 10)
    const expYear = 2000 + parseInt(validity.slice(2, 4), 10)

    const docResult = await provider.documents.createInvoiceReceipt({
      custom_client_id: order.contact_id || undefined,
      client_name: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
      email: order.customer_email || undefined,
      phone: order.customer_phone || undefined,
      items: [{
        description: `Acompte réservation ${order.request_reference}`,
        quantity: 1,
        unitprice_incvat: amount,
      }],
      cc: {
        sum: amount,
        card_type: billResult.data.cc_type,
        card_number: billResult.data.cc_last4,
        confirmation_code: billResult.data.confirmation_code,
        exp_month: expMonth,
        exp_year: expYear,
        holder_id: card_info.cc_holder_id,
        holder_name: card_info.cc_holder_name || `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
        num_of_payments: 1,
      },
      sanity_string: `dep_${order_id.slice(0, 20)}`,
      doc_lang: 'he',
    })

    let icountDoctype: string | null = null
    let icountDocnum: number | null = null
    let icountDocUrl: string | null = null

    if (docResult.success && docResult.data) {
      console.log('[PAY-DEPOSIT] iCount document created:', docResult.data.doctype, docResult.data.docnum)
      icountDoctype = docResult.data.doctype
      icountDocnum = docResult.data.docnum
      icountDocUrl = docResult.data.doc_url || null
    } else {
      // Log l'erreur mais on continue - le paiement a été effectué
      console.error('[PAY-DEPOSIT] Failed to create iCount document:', docResult.error)
    }

    // Créer l'enregistrement de paiement
    const paymentData = {
      order_id,
      booking_id: order.booking_id,
      contact_id: order.contact_id,
      branch_id: order.branch_id,
      amount,
      currency: 'ILS',
      payment_type: 'deposit',
      payment_method: 'card',
      status: 'completed',
      icount_transaction_id: billResult.data.transaction_id,
      icount_confirmation_code: billResult.data.confirmation_code,
      icount_doctype: icountDoctype,
      icount_docnum: icountDocnum,
      icount_doc_url: icountDocUrl,
      cc_last4: billResult.data.cc_last4,
      cc_type: billResult.data.cc_type,
      notes: 'Online deposit payment',
      processed_by: null, // Paiement automatique
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single()

    if (paymentError) {
      // Le paiement a été effectué mais on n'arrive pas à l'enregistrer
      // C'est grave - on log et on continue quand même
      console.error('[PAY-DEPOSIT] Error recording payment:', paymentError)
    }

    // Mettre à jour la commande
    const updateData = {
      paid_amount: (order.paid_amount || 0) + amount,
      deposit_amount: amount,
      payment_status: 'deposit_paid',
      payment_method: 'card',
      paid_at: new Date().toISOString(),
      icount_transaction_id: billResult.data.transaction_id,
      icount_confirmation_code: billResult.data.confirmation_code,
      cc_last4: billResult.data.cc_last4,
      cc_type: billResult.data.cc_type,
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id)

    if (updateError) {
      console.error('[PAY-DEPOSIT] Error updating order:', updateError)
    }

    // Retourner le succès
    return NextResponse.json({
      success: true,
      payment: {
        id: payment?.id,
        amount,
        confirmationCode: billResult.data.confirmation_code,
        ccLast4: billResult.data.cc_last4,
        ccType: billResult.data.cc_type,
        icountDocnum,
        icountDocUrl,
      },
      order: {
        id: order_id,
        reference: order.request_reference,
        paymentStatus: 'deposit_paid',
      },
    })

  } catch (error) {
    console.error('[PAY-DEPOSIT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
