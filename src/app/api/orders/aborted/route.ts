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

function generateShortReference(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Trouve ou crée un contact pour l'order ABORTED
 * Important pour la base de données marketing/relance
 */
async function findOrCreateContact(
  branchId: string,
  firstName: string,
  lastName: string | null,
  phone: string,
  email: string | null,
  source: string
): Promise<string | null> {
  if (!phone) return null

  console.log('[CREATE-ABORTED] findOrCreateContact - phone:', phone)

  // Chercher un contact existant par téléphone
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('branch_id_main', branchId)
    .eq('phone', phone)
    .single()

  if (existing) {
    console.log('[CREATE-ABORTED] Existing contact found:', existing.id)
    return existing.id
  }

  console.log('[CREATE-ABORTED] Creating new contact...')

  // Créer un nouveau contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      branch_id_main: branchId,
      first_name: firstName,
      last_name: lastName || '',
      phone,
      email: email || null,
      notes_client: `Contact créé depuis ${source === 'clara_chatbot' ? 'Clara chatbot' : 'formulaire public'} (order aborted)`,
      source: source === 'clara_chatbot' ? 'chatbot' : 'website',
      preferred_locale: 'he' // Par défaut hébreu, sera mis à jour si l'utilisateur change de langue
    })
    .select('id')
    .single()

  if (error || !newContact) {
    console.error('[CREATE-ABORTED] Error creating contact:', error)
    return null
  }

  console.log('[CREATE-ABORTED] New contact created:', newContact.id)
  return newContact.id
}

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
      requested_date,
      requested_time,
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

    // Trouver ou créer le contact pour la base marketing
    const contactId = await findOrCreateContact(
      branch_id,
      customer_first_name,
      customer_last_name,
      customer_phone,
      customer_email,
      source
    )

    console.log('[CREATE-ABORTED] Contact ID:', contactId)

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
        requested_date,
        requested_time,
        customer_first_name,
        customer_last_name,
        customer_phone,
        customer_email,
        contact_id: contactId,
        status: 'aborted',
        source,
        request_reference: generateShortReference(),
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
