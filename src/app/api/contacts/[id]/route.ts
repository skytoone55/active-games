import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactStatus } from '@/lib/supabase/types'

/**
 * GET /api/contacts/[id]
 * Récupère un contact spécifique
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single<Contact>()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching contact:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contact' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/contacts/[id]
 * Met à jour un contact spécifique
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.first_name !== undefined) updateData.first_name = body.first_name?.trim()
    if (body.last_name !== undefined) updateData.last_name = body.last_name?.trim() || null
    if (body.phone !== undefined) updateData.phone = body.phone?.trim()
    if (body.email !== undefined) updateData.email = body.email?.trim() || null
    if (body.notes_client !== undefined) updateData.notes_client = body.notes_client?.trim() || null
    if (body.alias !== undefined) updateData.alias = body.alias?.trim() || null
    if (body.source !== undefined) updateData.source = body.source

    // Gestion du status (archivage/désarchivage)
    if (body.status !== undefined) {
      updateData.status = body.status as ContactStatus
      if (body.status === 'archived') {
        updateData.archived_at = new Date().toISOString()
        if (body.archived_reason !== undefined) {
          updateData.archived_reason = body.archived_reason?.trim() || null
        }
      } else if (body.status === 'active') {
        updateData.archived_at = null
        updateData.archived_reason = null
      }
    }

    // updated_at sera mis à jour automatiquement par le trigger
    updateData.updated_at = new Date().toISOString()

    // @ts-ignore - Supabase typing issue with dynamic updates
    const { data: contact, error } = await (supabase
      .from('contacts') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single<Contact>()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 }
        )
      }
      console.error('Error updating contact:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to update contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/contacts/[id]
 * Archive un contact (soft delete) - pas de hard delete via UI
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Soft delete = archivage (pas de hard delete via UI en v1)
    const { error } = await (supabase
      .from('contacts') as any)
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found' },
          { status: 404 }
        )
      }
      console.error('Error archiving contact:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to archive contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error archiving contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to archive contact' },
      { status: 500 }
    )
  }
}
