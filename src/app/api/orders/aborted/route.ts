/**
 * API pour créer une commande ABORTED
 *
 * Utilisé quand :
 * - Client remplit le formulaire de réservation jusqu'à l'étape 6 (prénom/tél)
 * - Clara génère un lien de réservation
 *
 * Status ABORTED = client a montré un intérêt réel mais n'a pas payé
 * Permet de tracker les abandons et potentiellement relancer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      branch_id,
      order_type,
      participants_count,
      game_area,
      number_of_games,
      event_type,
      scheduled_date,
      scheduled_time,
      customer_first_name,
      customer_last_name,
      customer_phone,
      customer_email,
      source = 'public_booking' // ou 'clara_chatbot'
    } = body

    console.log('[CREATE-ABORTED] Creating aborted order:', {
      branch_id,
      order_type,
      participants_count,
      customer_first_name,
      customer_phone,
      source
    })

    // Créer la commande avec statut ABORTED
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        branch_id,
        order_type,
        participants_count,
        game_area,
        number_of_games,
        event_type,
        scheduled_date,
        scheduled_time,
        customer_first_name,
        customer_last_name,
        customer_phone,
        customer_email,
        status: 'aborted',
        source,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[CREATE-ABORTED] Error creating order:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('[CREATE-ABORTED] Order created:', order.id)

    return NextResponse.json({
      success: true,
      order_id: order.id,
      message: 'Aborted order created successfully'
    })

  } catch (error) {
    console.error('[CREATE-ABORTED] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
