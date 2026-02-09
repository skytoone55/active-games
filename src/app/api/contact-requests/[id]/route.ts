/**
 * API Route admin pour une demande de contact spécifique
 * GET: Détail d'une demande
 * PATCH: Marquer comme lu / créer contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/contact-requests/[id]
 * Retourne les détails d'une demande
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contactRequest, error } = await (supabase as any)
      .from('contact_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !contactRequest) {
      return NextResponse.json(
        { success: false, error: 'Contact request not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(contactRequest.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, contactRequest })

  } catch (error) {
    console.error('Error in GET /api/contact-requests/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/contact-requests/[id]
 * Met à jour une demande (marquer comme lu, associer un contact)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const { is_read, contact_id } = body

    const supabase = createServiceRoleClient()

    // Vérifier que la demande existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase as any)
      .from('contact_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Contact request not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existing.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (is_read !== undefined) {
      updateData.is_read = is_read
      if (is_read) {
        updateData.read_by = user.id
        updateData.read_at = new Date().toISOString()
      } else {
        updateData.read_by = null
        updateData.read_at = null
      }
    }

    if (contact_id !== undefined) {
      updateData.contact_id = contact_id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase as any)
      .from('contact_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contact request:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update contact request' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contactRequest: updated })

  } catch (error) {
    console.error('Error in PATCH /api/contact-requests/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
