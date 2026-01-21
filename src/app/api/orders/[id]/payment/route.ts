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

    // Si paiement par carte, utiliser iCount
    if (body.paymentMethod === 'card') {
      console.log('[PAYMENT] Card payment requested:', {
        hasCardInfo: !!body.cardInfo,
        hasTokenId: !!body.tokenId,
        tokenId: body.tokenId,
        usePreauth: body.usePreauth,
        preauthCode: body.preauthCode,
      })

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

      // Effectuer le paiement via iCount
      console.log('[PAYMENT] Calling iCount billCard with:', {
        customClientId: order.contact_id,
        tokenId: body.tokenId,
        hasCardInfo: !!body.cardInfo,
        amount: body.amount,
        useJ5IfAvailable: body.useJ5,
      })

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

      console.log('[PAYMENT] iCount billCard result:', JSON.stringify(billResult, null, 2))

      if (!billResult.success || !billResult.data) {
        console.log('[PAYMENT] Payment failed:', billResult.error)
        return NextResponse.json(
          {
            success: false,
            error: billResult.error?.message || 'Card payment failed',
            errorCode: billResult.error?.code,
          },
          { status: 400 }
        )
      }

      paymentResult = {
        success: true,
        transactionId: billResult.data.transaction_id,
        confirmationCode: billResult.data.confirmation_code,
        ccLast4: billResult.data.cc_last4,
        ccType: billResult.data.cc_type,
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
      } else {
        // Log l'erreur mais on continue - le paiement a été effectué
        console.error('[PAYMENT] Failed to create iCount document:', docResult.error)
      }

      // Si demandé, sauvegarder la carte pour utilisation future
      if (body.saveCard && body.cardInfo && order.contact_id) {
        console.log('[PAYMENT] Attempting to store card for contact:', order.contact_id)
        try {
          const storeResult = await provider.creditCard.storeCard({
            customClientId: order.contact_id,
            email: order.customer_email || undefined,
            clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
            cardInfo: body.cardInfo,
          })

          console.log('[PAYMENT] Store card result:', JSON.stringify(storeResult, null, 2))

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
            } else {
              console.log('[PAYMENT] Card stored successfully, token:', storeResult.data.token_id)
            }
          } else {
            console.error('[PAYMENT] Store card failed:', storeResult.error)
          }
        } catch (storeError) {
          // Log l'erreur mais ne pas faire échouer le paiement
          console.error('[PAYMENT] Exception storing card:', storeError)
        }
      } else if (body.saveCard) {
        console.log('[PAYMENT] Cannot save card - missing:', {
          hasCardInfo: !!body.cardInfo,
          hasContactId: !!order.contact_id,
        })
      }
    }

    // Créer l'enregistrement de paiement
    const paymentData = {
      order_id: id,
      booking_id: order.booking_id,
      contact_id: order.contact_id,
      branch_id: order.branch_id,
      amount: body.amount,
      currency: 'ILS',
      payment_type: body.paymentType,
      payment_method: body.paymentMethod,
      status: 'completed',
      icount_transaction_id: paymentResult.transactionId,
      icount_confirmation_code: paymentResult.confirmationCode,
      icount_doctype: paymentResult.icountDoctype,
      icount_docnum: paymentResult.icountDocnum,
      icount_doc_url: paymentResult.icountDocUrl,
      cc_last4: paymentResult.ccLast4,
      cc_type: paymentResult.ccType,
      check_number: body.checkNumber,
      check_bank: body.checkBank,
      check_date: body.checkDate,
      transfer_reference: body.transferReference,
      notes: body.notes,
      processed_by: user.id,
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single()

    if (paymentError) {
      console.error('Error creating payment record:', paymentError)
      return NextResponse.json(
        { success: false, error: 'Failed to record payment' },
        { status: 500 }
      )
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
        id: payment.id,
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
