/**
 * iCount PayPages Webhook Handler
 * Receives IPN (Instant Payment Notifications) from iCount
 *
 * Called by iCount after payment completion (success/failure)
 * Documentation: ~/Desktop/claude/data/icount/PayPages-API.yaml (line 207-209)
 *
 * IMPORTANT: iCount retries 3x if we return non-200 status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * iCount PayPage webhook payload structure
 * Note: Structure may vary - validate fields exist before using
 */
interface PayPageWebhookPayload {
  // Sale identification
  sale_uniqid: string
  sale_sid?: string
  paypage_id?: number

  // Payment result
  status: 'completed' | 'failed' | 'cancelled' | string
  transaction_id?: string
  confirmation_code?: string

  // Document info (if invoice/receipt generated)
  doctype?: string
  docnum?: number
  doc_url?: string

  // Card info (masked)
  cc_last4?: string
  cc_type?: string

  // Amount
  amount: number
  currency?: string

  // Client
  client_name?: string
  email?: string
  phone?: string

  // Timestamp
  timestamp?: number

  // Error info (if failed)
  error_message?: string
  error_code?: string
}

/**
 * POST /api/webhooks/icount-paypage
 * Receive payment notification from iCount
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as PayPageWebhookPayload

    console.log('[ICOUNT-WEBHOOK] Received notification:', {
      sale_uniqid: payload.sale_uniqid,
      status: payload.status,
      amount: payload.amount,
    })

    // Validation de base
    if (!payload.sale_uniqid) {
      console.error('[ICOUNT-WEBHOOK] Missing sale_uniqid')
      return NextResponse.json(
        { error: 'Missing sale_uniqid' },
        { status: 400 }
      )
    }

    // TODO: Vérifier signature HMAC si iCount le fournit
    // const signature = request.headers.get('x-icount-signature')
    // if (!verifySignature(signature, payload)) { return 401 }

    // Trouver le payment par sale_uniqid (idempotence)
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*, orders(*)')
      .eq('icount_sale_uniqid', payload.sale_uniqid)
      .single()

    if (findError || !payment) {
      console.error('[ICOUNT-WEBHOOK] Payment not found for sale_uniqid:', payload.sale_uniqid)
      // Retourner 200 quand même pour éviter retry iCount
      return NextResponse.json({
        received: true,
        processed: false,
        reason: 'Payment not found'
      })
    }

    // Vérifier si déjà traité (idempotence - protection double webhook)
    if (payment.status === 'completed') {
      console.log(`[ICOUNT-WEBHOOK] Payment ${payment.id} already completed, ignoring`)
      return NextResponse.json({
        received: true,
        processed: true,
        reason: 'Already processed'
      })
    }

    // Vérifier montant (sécurité)
    if (payload.amount && Math.abs(payment.amount - payload.amount) > 0.01) {
      console.error('[ICOUNT-WEBHOOK] Amount mismatch:', {
        expected: payment.amount,
        received: payload.amount,
      })
      // Retourner 200 mais ne pas traiter
      return NextResponse.json({
        received: true,
        processed: false,
        reason: 'Amount mismatch'
      })
    }

    const now = new Date().toISOString()

    // Traiter selon le statut
    if (payload.status === 'completed') {
      console.log(`[ICOUNT-WEBHOOK] Payment ${payment.id} completed successfully`)

      // Mettre à jour payment
      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          icount_transaction_id: payload.transaction_id || null,
          icount_confirmation_code: payload.confirmation_code || null,
          icount_doctype: payload.doctype || null,
          icount_docnum: payload.docnum || null,
          icount_doc_url: payload.doc_url || null,
          cc_last4: payload.cc_last4 || null,
          cc_type: payload.cc_type || null,
          notes: payment.notes ? `${payment.notes}\nCompleted via webhook` : 'Completed via webhook',
          updated_at: now,
        })
        .eq('id', payment.id)

      if (updatePaymentError) {
        console.error('[ICOUNT-WEBHOOK] Failed to update payment:', updatePaymentError)
        // Retourner 500 pour que iCount retry
        return NextResponse.json(
          { error: 'Failed to update payment' },
          { status: 500 }
        )
      }

      // Mettre à jour order
      const order = payment.orders
      if (order) {
        const newPaidAmount = (order.paid_amount || 0) + payment.amount

        // Déterminer nouveau payment_status
        let newPaymentStatus: string = order.payment_status
        if (payment.payment_type === 'deposit') {
          newPaymentStatus = 'deposit_paid'
        } else if (payment.payment_type === 'full' || newPaidAmount >= order.total_amount) {
          newPaymentStatus = 'fully_paid'
        } else if (payment.payment_type === 'balance') {
          newPaymentStatus = 'fully_paid'
        }

        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            payment_status: newPaymentStatus,
            paid_amount: newPaidAmount,
            payment_method: 'card',
            paid_at: now,
            icount_transaction_id: payload.transaction_id || order.icount_transaction_id,
            icount_confirmation_code: payload.confirmation_code || order.icount_confirmation_code,
            cc_last4: payload.cc_last4 || order.cc_last4,
            cc_type: payload.cc_type || order.cc_type,
          })
          .eq('id', payment.order_id)

        if (updateOrderError) {
          console.error('[ICOUNT-WEBHOOK] Failed to update order:', updateOrderError)
          // Payment est marqué completed, mais order pas à jour
          // Acceptable - peut être corrigé manuellement
        } else {
          console.log(`[ICOUNT-WEBHOOK] Order ${payment.order_id} updated: ${newPaymentStatus}`)
        }
      }

      return NextResponse.json({
        received: true,
        processed: true,
        payment_id: payment.id,
        status: 'completed',
      })
    }

    // Échec ou annulation
    if (payload.status === 'failed' || payload.status === 'cancelled') {
      console.log(`[ICOUNT-WEBHOOK] Payment ${payment.id} ${payload.status}`)

      const failureReason = payload.error_message || `Payment ${payload.status}`

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'failed',
          notes: `${payment.notes || ''}\n${failureReason}`.trim(),
          updated_at: now,
        })
        .eq('id', payment.id)

      if (updateError) {
        console.error('[ICOUNT-WEBHOOK] Failed to update payment:', updateError)
        return NextResponse.json(
          { error: 'Failed to update payment' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        received: true,
        processed: true,
        payment_id: payment.id,
        status: 'failed',
      })
    }

    // Statut inconnu
    console.warn('[ICOUNT-WEBHOOK] Unknown status:', payload.status)
    return NextResponse.json({
      received: true,
      processed: false,
      reason: `Unknown status: ${payload.status}`
    })

  } catch (error) {
    console.error('[ICOUNT-WEBHOOK] Error processing webhook:', error)
    // Retourner 500 pour que iCount retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET - Health check
 * iCount peut appeler en GET pour vérifier l'URL
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'icount-paypage-webhook',
    timestamp: new Date().toISOString(),
  })
}
