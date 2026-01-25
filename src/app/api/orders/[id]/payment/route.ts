/**
 * API Route pour gérer les paiements d'une commande
 * POST: Enregistrer un paiement (carte, espèces, chèque, virement)
 * GET: Récupérer l'historique des paiements
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { getPaymentProvider } from '@/lib/payment-provider'
import type { UserRole } from '@/lib/supabase/types'

interface PaymentRequest {
  amount: number
  paymentType: 'full' | 'deposit' | 'balance'
  paymentMethod: 'card' | 'cash' | 'transfer' | 'check'
  // Pour les paiements par carte
  cardInfo?: {
    cc_number: string
    cc_validity: string
    cc_cvv: string
    cc_holder_id: string
    cc_holder_name?: string
  }
  tokenId?: number // Utiliser un token de carte stockée
  saveCard?: boolean // Sauvegarder la carte pour utilisation future
  useJ5?: boolean // Débiter une pré-autorisation existante
  usePreauth?: boolean // Utiliser une pré-autorisation existante
  preauthCode?: string // Code de la pré-autorisation
  // Pour les chèques
  checkNumber?: string
  checkBank?: string
  checkDate?: string
  // Pour les virements
  transferReference?: string
  // Notes
  notes?: string
  // Test mode (ne pas débiter réellement)
  isTest?: boolean
}

/**
 * GET /api/orders/[id]/payment
 * Récupérer l'historique des paiements
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Récupérer la commande
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: orderError } = await (supabase as any)
      .from('orders')
      .select('*, payments(*)')
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

    return NextResponse.json({
      success: true,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount,
      depositAmount: order.deposit_amount,
      paidAmount: order.paid_amount,
      payments: order.payments || [],
    })

  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders/[id]/payment
 * Enregistrer un paiement
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
    const body: PaymentRequest = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation de base
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

    if (!body.paymentMethod || !['card', 'cash', 'transfer', 'check'].includes(body.paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      )
    }

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
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
        { success: false, error: 'Cannot add payment to a closed order', messageKey: 'errors.orderClosed' },
        { status: 400 }
      )
    }

    // PROTECTION DOUBLE PAIEMENT: Vérifier qu'il n'y a pas de paiement en cours
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('id, created_at')
      .eq('order_id', id)
      .eq('status', 'pending')
      .limit(1)

    if (pendingPayments && pendingPayments.length > 0) {
      const pendingPayment = pendingPayments[0]
      const createdAt = new Date(pendingPayment.created_at)
      const now = new Date()
      const ageMs = now.getTime() - createdAt.getTime()

      // Si le paiement pending a moins de 2 minutes, bloquer
      if (ageMs < 2 * 60 * 1000) {
        console.warn(`[PAYMENT] Blocked duplicate payment attempt for order ${id}`)
        return NextResponse.json(
          { success: false, error: 'A payment is already being processed for this order', messageKey: 'errors.paymentInProgress' },
          { status: 409 }
        )
      } else {
        // Si le paiement pending est trop vieux (>2min), c'est probablement un abandon
        // On le supprime pour permettre un nouveau paiement
        console.warn(`[PAYMENT] Cleaning up stale pending payment ${pendingPayment.id} for order ${id}`)
        await supabase.from('payments').delete().eq('id', pendingPayment.id)
      }
    }

    let paymentResult: {
      success: boolean
      transactionId?: string
      confirmationCode?: string
      ccLast4?: string
      ccType?: string
      tokenId?: number
      icountDoctype?: string
      icountDocnum?: number
      icountDocUrl?: string
      error?: string
    } = { success: true }

    // Préparer les données de paiement de base
    const basePaymentData = {
      order_id: id,
      booking_id: order.booking_id,
      contact_id: order.contact_id,
      branch_id: order.branch_id,
      amount: body.amount,
      currency: 'ILS',
      payment_type: body.paymentType,
      payment_method: body.paymentMethod,
      check_number: body.checkNumber,
      check_bank: body.checkBank,
      check_date: body.checkDate,
      transfer_reference: body.transferReference,
      notes: body.notes,
      processed_by: user.id,
    }

    // Si paiement par carte, utiliser iCount
    if (body.paymentMethod === 'card') {
      console.log('[PAYMENT] Card payment requested')

      if (!body.cardInfo && !body.tokenId) {
        console.log('[PAYMENT] ERROR: No card info and no token provided')
        return NextResponse.json(
          { success: false, error: 'Card info or token required for card payment' },
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

      // ÉTAPE 1: Créer un enregistrement payment en status 'pending' AVANT le paiement
      const { data: pendingPayment, error: pendingError } = await supabase
        .from('payments')
        .insert({
          ...basePaymentData,
          status: 'pending',
        })
        .select()
        .single()

      if (pendingError || !pendingPayment) {
        console.error('[PAYMENT] Failed to create pending payment record:', pendingError)
        return NextResponse.json(
          { success: false, error: 'Failed to initialize payment' },
          { status: 500 }
        )
      }

      console.log('[PAYMENT] Pending payment created:', pendingPayment.id)

      // ÉTAPE 2: Effectuer le paiement via iCount
      const billResult = await provider.creditCard.billCard({
        customClientId: order.contact_id || undefined,
        email: order.customer_email || undefined,
        clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
        tokenId: body.tokenId,
        cardInfo: body.cardInfo,
        amount: body.amount,
        currencyCode: 'ILS',
        useJ5IfAvailable: body.useJ5,
        description: `Paiement commande ${order.request_reference}`,
        isTest: body.isTest,
      })

      if (!billResult.success || !billResult.data) {
        console.log('[PAYMENT] Payment failed, removing pending record')
        // Supprimer l'enregistrement pending car le paiement a échoué
        await supabase.from('payments').delete().eq('id', pendingPayment.id)
        return NextResponse.json(
          {
            success: false,
            error: billResult.error?.message || 'Card payment failed',
            errorCode: billResult.error?.code,
          },
          { status: 400 }
        )
      }

      console.log('[PAYMENT] iCount payment successful, confirmation:', billResult.data.confirmation_code)

      paymentResult = {
        success: true,
        transactionId: billResult.data.transaction_id,
        confirmationCode: billResult.data.confirmation_code,
        ccLast4: billResult.data.cc_last4,
        ccType: billResult.data.cc_type,
      }

      // ÉTAPE 3: Mettre à jour le payment pending avec les infos iCount
      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          icount_transaction_id: billResult.data.transaction_id,
          icount_confirmation_code: billResult.data.confirmation_code,
          cc_last4: billResult.data.cc_last4,
          cc_type: billResult.data.cc_type,
        })
        .eq('id', pendingPayment.id)

      if (updatePaymentError) {
        // CRITIQUE: Le paiement a été effectué mais on n'arrive pas à mettre à jour
        // On log l'erreur mais on continue car l'argent a été débité
        console.error('[PAYMENT] CRITICAL: Payment completed but failed to update record:', updatePaymentError)
        console.error('[PAYMENT] Payment ID:', pendingPayment.id, 'Transaction:', billResult.data.transaction_id)
      }

      // Créer le document iCount (invrec) pour ce paiement
      console.log('[PAYMENT] Creating iCount document for payment')

      // Parser la validité pour extraire mois/année si on a les infos carte
      let expMonth: number | undefined
      let expYear: number | undefined
      if (body.cardInfo?.cc_validity) {
        const validity = body.cardInfo.cc_validity.replace(/[^0-9]/g, '')
        expMonth = parseInt(validity.slice(0, 2), 10)
        expYear = 2000 + parseInt(validity.slice(2, 4), 10)
      }

      const docResult = await provider.documents.createInvoiceReceipt({
        custom_client_id: order.contact_id || undefined,
        client_name: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
        email: order.customer_email || undefined,
        phone: order.customer_phone || undefined,
        items: [{
          description: `${body.paymentType === 'deposit' ? 'Acompte' : 'Paiement'} commande ${order.request_reference}`,
          quantity: 1,
          unitprice_incvat: body.amount,
        }],
        cc: {
          sum: body.amount,
          card_type: billResult.data.cc_type,
          card_number: billResult.data.cc_last4,
          confirmation_code: billResult.data.confirmation_code,
          exp_month: expMonth,
          exp_year: expYear,
          holder_id: body.cardInfo?.cc_holder_id,
          holder_name: body.cardInfo?.cc_holder_name || `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
          num_of_payments: 1,
        },
        sanity_string: `pay_${id.slice(0, 10)}_${Date.now()}`,
        doc_lang: 'he',
      })

      if (docResult.success && docResult.data) {
        console.log('[PAYMENT] iCount document created:', docResult.data.doctype, docResult.data.docnum)
        paymentResult.icountDoctype = docResult.data.doctype
        paymentResult.icountDocnum = docResult.data.docnum
        paymentResult.icountDocUrl = docResult.data.doc_url

        // Mettre à jour le payment avec les infos du document
        await supabase
          .from('payments')
          .update({
            icount_doctype: docResult.data.doctype,
            icount_docnum: docResult.data.docnum,
            icount_doc_url: docResult.data.doc_url,
          })
          .eq('id', pendingPayment.id)
      } else {
        // Log l'erreur mais on continue - le paiement a été effectué
        console.error('[PAYMENT] Failed to create iCount document:', docResult.error)
      }

      // Si demandé, sauvegarder la carte pour utilisation future
      if (body.saveCard && body.cardInfo && order.contact_id) {
        console.log('[PAYMENT] Attempting to store card for contact')
        try {
          const storeResult = await provider.creditCard.storeCard({
            customClientId: order.contact_id,
            email: order.customer_email || undefined,
            clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
            cardInfo: body.cardInfo,
          })

          if (storeResult.success && storeResult.data) {
            paymentResult.tokenId = storeResult.data.token_id

            // Mettre à jour le contact avec les infos de carte
            const { error: updateError } = await supabase
              .from('contacts')
              .update({
                icount_cc_token_id: storeResult.data.token_id,
                cc_last4: storeResult.data.cc_last4,
                cc_type: storeResult.data.cc_type,
                cc_expiry: storeResult.data.cc_validity,
              })
              .eq('id', order.contact_id)

            if (updateError) {
              console.error('[PAYMENT] Error updating contact with card:', updateError)
            }
          } else {
            console.error('[PAYMENT] Store card failed:', storeResult.error)
          }
        } catch (storeError) {
          // Log l'erreur mais ne pas faire échouer le paiement
          console.error('[PAYMENT] Exception storing card:', storeError)
        }
      }

      // Pour les paiements carte, on utilise le pendingPayment.id déjà créé
      // Pas besoin de créer un nouveau payment

    }

    // Pour les paiements NON-CARTE (cash, transfer, check) : créer directement en completed
    let paymentId: string | undefined
    if (body.paymentMethod !== 'card') {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          ...basePaymentData,
          status: 'completed',
        })
        .select()
        .single()

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
        return NextResponse.json(
          { success: false, error: 'Failed to record payment' },
          { status: 500 }
        )
      }
      paymentId = payment.id
    }

    // Calculer le nouveau montant payé
    const newPaidAmount = (order.paid_amount || 0) + body.amount
    const totalAmount = order.total_amount || 0

    // Déterminer le nouveau statut de paiement
    let newPaymentStatus = order.payment_status
    if (newPaidAmount >= totalAmount && totalAmount > 0) {
      newPaymentStatus = 'fully_paid'
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'deposit_paid'
    }

    // Mettre à jour la commande
    const updateData: Record<string, unknown> = {
      paid_amount: newPaidAmount,
      payment_status: newPaymentStatus,
      payment_method: body.paymentMethod,
      paid_at: new Date().toISOString(),
    }

    if (paymentResult.transactionId) {
      updateData.icount_transaction_id = paymentResult.transactionId
    }
    if (paymentResult.confirmationCode) {
      updateData.icount_confirmation_code = paymentResult.confirmationCode
    }
    if (paymentResult.ccLast4) {
      updateData.cc_last4 = paymentResult.ccLast4
      updateData.cc_type = paymentResult.ccType
    }

    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)

    // Logger l'action
    await logOrderAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: 'updated',
      orderId: id,
      orderRef: order.request_reference,
      branchId: order.branch_id,
      details: {
        paymentAdded: true,
        amount: body.amount,
        paymentType: body.paymentType,
        paymentMethod: body.paymentMethod,
        newPaymentStatus,
        totalPaid: newPaidAmount,
      },
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentId,
        amount: body.amount,
        paymentType: body.paymentType,
        paymentMethod: body.paymentMethod,
        confirmationCode: paymentResult.confirmationCode,
      },
      orderPaymentStatus: newPaymentStatus,
      totalPaid: newPaidAmount,
      remaining: Math.max(0, totalAmount - newPaidAmount),
    })

  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
