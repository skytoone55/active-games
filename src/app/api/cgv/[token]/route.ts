import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Database } from '@/lib/supabase/types'

type OrderRow = Database['public']['Tables']['orders']['Row']
type BranchRow = Database['public']['Tables']['branches']['Row']

// GET: Récupérer les infos de la commande pour affichage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createServiceRoleClient()

    // Récupérer la commande par token
    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`
        id,
        request_reference,
        customer_first_name,
        customer_last_name,
        requested_date,
        requested_time,
        participants_count,
        event_type,
        cgv_validated_at,
        branch_id
      `)
      .eq('cgv_token', token)
      .single()

    const order = orderData as Pick<OrderRow, 'id' | 'request_reference' | 'customer_first_name' | 'customer_last_name' | 'requested_date' | 'requested_time' | 'participants_count' | 'event_type' | 'cgv_validated_at' | 'branch_id'> | null

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Lien invalide ou expiré' },
        { status: 404 }
      )
    }

    // Récupérer le nom de la branche
    let branchName = 'Laser City'
    if (order.branch_id) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', order.branch_id)
        .single()
      const branch = branchData as Pick<BranchRow, 'name'> | null
      if (branch) branchName = branch.name
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        request_reference: order.request_reference,
        customer_first_name: order.customer_first_name,
        customer_last_name: order.customer_last_name,
        requested_date: order.requested_date,
        requested_time: order.requested_time,
        participants_count: order.participants_count,
        event_type: order.event_type,
        cgv_validated_at: order.cgv_validated_at,
        branch_name: branchName
      }
    })

  } catch (error) {
    console.error('[CGV] Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST: Valider les CGV
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    if (!body.accepted) {
      return NextResponse.json(
        { success: false, error: 'Vous devez accepter les CGV' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Vérifier que la commande existe et n'est pas déjà validée
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('id, cgv_validated_at, request_reference, branch_id')
      .eq('cgv_token', token)
      .single()

    const order = orderData as Pick<OrderRow, 'id' | 'cgv_validated_at' | 'request_reference' | 'branch_id'> | null

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Lien invalide ou expiré' },
        { status: 404 }
      )
    }

    if (order.cgv_validated_at) {
      return NextResponse.json({
        success: true,
        message: 'CGV déjà validées'
      })
    }

    // Mettre à jour la commande
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('orders')
      .update({
        cgv_validated_at: new Date().toISOString(),
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[CGV] Error updating order:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la validation' },
        { status: 500 }
      )
    }

    // Logger l'action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('activity_logs').insert({
        user_id: null,
        user_role: 'agent',
        user_name: 'Client',
        action_type: 'order_updated',
        target_type: 'order',
        target_id: order.id,
        target_name: order.request_reference,
        branch_id: order.branch_id,
        details: {
          action: 'cgv_accepted',
          validated_at: new Date().toISOString()
        }
      })
    } catch (logError) {
      console.error('[CGV] Error logging action:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'CGV validées avec succès'
    })

  } catch (error) {
    console.error('[CGV] Error validating CGV:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
