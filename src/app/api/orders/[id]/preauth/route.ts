/**
 * API Route pour gérer les pré-autorisations (J5) d'une commande
 * POST: Créer une pré-autorisation
 * DELETE: Annuler/libérer une pré-autorisation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { getPaymentProvider } from '@/lib/payment-provider'
import type { UserRole } from '@/lib/supabase/types'

interface PreauthRequest {
  amount: number
  cardInfo: {
    cc_number: string
    cc_validity: string
    cc_cvv: string
    cc_holder_id: string
    cc_holder_name?: string
  }
  saveCard?: boolean // Optionnel: sauvegarder aussi la carte
}

/**
 * POST /api/orders/[id]/preauth
 * Créer une pré-autorisation (J5)
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
    const body: PreauthRequest = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation de base
    if (!body.amount || body.amount < 5) {
      return NextResponse.json(
        { success: false, error: 'Minimum amount for preauthorization is 5₪' },
        { status: 400 }
      )
    }

    if (!body.cardInfo) {
      return NextResponse.json(
        { success: false, error: 'Card info required' },
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

    // Récupérer le provider de paiement
    const provider = await getPaymentProvider(order.branch_id)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    // Créer la pré-autorisation via iCount J5
    console.log('[PREAUTH] Creating J5 preapproval:', {
      amount: body.amount,
      hasCardInfo: !!body.cardInfo,
      ccLast4: body.cardInfo?.cc_number?.slice(-4),
      ccValidity: body.cardInfo?.cc_validity,
      ccValidityLength: body.cardInfo?.cc_validity?.length,
    })

    const j5Result = await provider.creditCard.createJ5Preapproval({
      cardInfo: body.cardInfo,
      amount: body.amount,
      currencyCode: 'ILS',
    })

    console.log('[PREAUTH] J5 result:', JSON.stringify(j5Result, null, 2))

    if (!j5Result.success || !j5Result.data) {
      console.log('[PREAUTH] Failed:', j5Result.error)
      return NextResponse.json(
        {
          success: false,
          error: j5Result.error?.message || 'Preauthorization failed',
          errorCode: j5Result.error?.code,
        },
        { status: 400 }
      )
    }

    // Stocker la pré-autorisation dans la commande
    const updateData: Record<string, unknown> = {
      preauth_code: j5Result.data.confirmation_code,
      preauth_amount: body.amount,
      preauth_cc_last4: j5Result.data.cc_last4,
      preauth_cc_type: j5Result.data.cc_type,
      preauth_created_at: new Date().toISOString(),
      preauth_created_by: user.id,
    }

    // Optionnel: sauvegarder la carte pour utilisation future
    let tokenId: number | undefined
    if (body.saveCard && order.contact_id) {
      try {
        const storeResult = await provider.creditCard.storeCard({
          customClientId: order.contact_id,
          email: order.customer_email || undefined,
          clientName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
          cardInfo: body.cardInfo,
        })

        if (storeResult.success && storeResult.data) {
          tokenId = storeResult.data.token_id

          // Mettre à jour le contact avec les infos de carte
          await supabase
            .from('contacts')
            .update({
              icount_cc_token_id: storeResult.data.token_id,
              cc_last4: storeResult.data.cc_last4,
              cc_type: storeResult.data.cc_type,
              cc_expiry: storeResult.data.cc_validity,
            })
            .eq('id', order.contact_id)
        }
      } catch (storeError) {
        // Log l'erreur mais ne pas faire échouer la pré-autorisation
        console.error('Error storing card:', storeError)
      }
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
        preauthCreated: true,
        amount: body.amount,
        confirmationCode: j5Result.data.confirmation_code,
        ccLast4: j5Result.data.cc_last4,
      },
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      preauth: {
        confirmationCode: j5Result.data.confirmation_code,
        transactionId: j5Result.data.transaction_id,
        amount: body.amount,
        ccLast4: j5Result.data.cc_last4,
        ccType: j5Result.data.cc_type,
        tokenId, // Retourné si la carte a été sauvegardée
      },
    })

  } catch (error) {
    console.error('Error creating preauthorization:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders/[id]/preauth
 * Récupérer la pré-autorisation existante
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: orderError } = await (supabase as any)
      .from('orders')
      .select('preauth_code, preauth_amount, preauth_cc_last4, preauth_cc_type, preauth_created_at')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!order.preauth_code) {
      return NextResponse.json({
        success: true,
        preauth: null,
      })
    }

    return NextResponse.json({
      success: true,
      preauth: {
        code: order.preauth_code,
        amount: order.preauth_amount,
        ccLast4: order.preauth_cc_last4,
        ccType: order.preauth_cc_type,
        createdAt: order.preauth_created_at,
      },
    })

  } catch (error) {
    console.error('Error fetching preauthorization:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]/preauth
 * Supprimer/libérer la pré-autorisation (elle expire naturellement mais on peut la marquer comme annulée)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, preauth_code, preauth_amount')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!order.preauth_code) {
      return NextResponse.json(
        { success: false, error: 'No preauthorization to cancel' },
        { status: 400 }
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

    // Supprimer la pré-autorisation de la commande
    // Note: La pré-autorisation J5 dans iCount expire naturellement après quelques jours
    // On la marque simplement comme annulée dans notre système
    await supabase
      .from('orders')
      .update({
        preauth_code: null,
        preauth_amount: null,
        preauth_cc_last4: null,
        preauth_cc_type: null,
        preauth_created_at: null,
        preauth_created_by: null,
        preauth_cancelled_at: new Date().toISOString(),
        preauth_cancelled_by: user.id,
      })
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
        preauthCancelled: true,
        previousAmount: order.preauth_amount,
      },
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      message: 'Preauthorization cancelled',
    })

  } catch (error) {
    console.error('Error cancelling preauthorization:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
