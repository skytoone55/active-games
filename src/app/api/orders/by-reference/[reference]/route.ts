/**
 * API publique pour récupérer une commande par sa référence
 * Utilisé pour charger les commandes ABORTED depuis le lien du messenger
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/orders/by-reference/[reference]
 * Récupère une commande par sa référence (request_reference)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params

    if (!reference) {
      return NextResponse.json(
        { success: false, error: 'Reference is required' },
        { status: 400 }
      )
    }

    // Chercher la commande par référence
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('request_reference', reference.toUpperCase())
      .single()

    if (error || !order) {
      console.error('[Get Order by Reference] Order not found:', reference, error)
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Ne retourner que les commandes ABORTED (sécurité)
    if (order.status !== 'aborted') {
      return NextResponse.json(
        { success: false, error: 'Order is not available for completion' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      order
    })
  } catch (error) {
    console.error('[Get Order by Reference] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
