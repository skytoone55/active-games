/**
 * API Route publique pour les demandes de contact (leads)
 * POST: Créer une nouvelle demande de contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/public/contact-requests
 * Crée une demande de contact depuis le formulaire public
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, message, branch_id } = body

    // Validation des champs requis
    if (!name || !phone || !message || !branch_id) {
      return NextResponse.json(
        { success: false, error: 'name, phone, message and branch_id are required' },
        { status: 400 }
      )
    }

    // Validation basique de l'email si fourni
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    const supabase = createServiceRoleClient()

    // Vérifier que la branche existe et est active
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, name')
      .eq('id', branch_id)
      .eq('is_active', true)
      .single()

    if (branchError || !branch) {
      return NextResponse.json(
        { success: false, error: 'Invalid branch' },
        { status: 400 }
      )
    }

    // Créer la demande de contact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contactRequest, error } = await (supabase as any)
      .from('contact_requests')
      .insert({
        branch_id,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        message: message.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact request:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create contact request' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contactRequest }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/public/contact-requests:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
