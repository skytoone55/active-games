/**
 * API Route pour pré-autoriser une carte (J5 / empreinte)
 * POST: Créer une pré-autorisation sans débiter
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { getPaymentProvider } from '@/lib/payment-provider'
import type { UserRole } from '@/lib/supabase/types'

interface AuthorizeCardRequest {
  amount: number
  cardInfo: {
    cc_number: string
    cc_validity: string
    cc_cvv: string
    cc_holder_id: string
    cc_holder_name?: string
  }
  // Optionally store the card for future use
  storeCard?: boolean
}

/**
 * POST /api/orders/[id]/authorize-card
 * Create a J5 preauthorization (card imprint)
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
    const body: AuthorizeCardRequest = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation
    if (!body.amount || body.amount < 5) {
      return NextResponse.json(
        { success: false, error: 'Amount must be at least 5 ILS for J5 preauthorization' },
        { status: 400 }
      )
    }

    if (!body.cardInfo || !body.cardInfo.cc_number || !body.cardInfo.cc_validity || !body.cardInfo.cc_cvv || !body.cardInfo.cc_holder_id) {
      return NextResponse.json(
        { success: false, error: 'Complete card information required' },
        { status: 400 }
      )
    }

    // Get order
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

    // Verify branch access
    if (user.role !== 'super_admin' && order.branch_id) {
      if (!user.branchIds.includes(order.branch_id)) {
        return NextResponse.json(
          { success: false, error: 'Branch access denied' },
          { status: 403 }
        )
      }
    }

    // Get payment provider
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    // Create J5 preauthorization
    const j5Result = await provider.creditCard.createJ5Preapproval({
      cardInfo: body.cardInfo,
      amount: body.amount,
      currencyCode: 'ILS',
    })

    if (!j5Result.success || !j5Result.data) {
      return NextResponse.json(
        {
          success: false,
          error: j5Result.error?.message || 'Card authorization failed',
          errorCode: j5Result.error?.code,
        },
        { status: 400 }
      )
    }

    // Optionally store the card for future use
    let storedCardTokenId: number | undefined
    if (body.storeCard && order.contact_id) {
      const storeResult = await provider.creditCard.storeCard({
        customClientId: order.contact_id,
        email: order.customer_email || undefined,
        clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
        cardInfo: body.cardInfo,
      })

      if (storeResult.success && storeResult.data) {
        storedCardTokenId = storeResult.data.token_id

        // Update contact with stored card info
        await supabase
          .from('contacts')
          .update({
            icount_cc_token_id: storedCardTokenId,
            cc_last4: storeResult.data.cc_last4,
            cc_type: storeResult.data.cc_type,
            cc_validity: storeResult.data.cc_validity,
            cc_holder_name: body.cardInfo.cc_holder_name,
          })
          .eq('id', order.contact_id)
      }
    }

    // Update order with J5 info
    await supabase
      .from('orders')
      .update({
        payment_status: 'card_authorized',
        icount_j5_code: j5Result.data.confirmation_code,
        cc_last4: j5Result.data.cc_last4,
        cc_type: j5Result.data.cc_type,
        total_amount: order.total_amount || body.amount,
      })
      .eq('id', id)

    // Log the action
    await logOrderAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: 'updated',
      orderId: id,
      orderRef: order.request_reference,
      branchId: order.branch_id,
      details: {
        cardAuthorized: true,
        amount: body.amount,
        ccLast4: j5Result.data.cc_last4,
        ccType: j5Result.data.cc_type,
        cardStored: !!storedCardTokenId,
      },
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      authorization: {
        confirmationCode: j5Result.data.confirmation_code,
        amount: body.amount,
        ccLast4: j5Result.data.cc_last4,
        ccType: j5Result.data.cc_type,
      },
      cardStored: !!storedCardTokenId,
      message: 'Card authorized successfully. Amount will not be charged until payment is processed.',
    })

  } catch (error) {
    console.error('Error authorizing card:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
