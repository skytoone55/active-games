/**
 * API Route: /api/email-automations/[id]
 *
 * PUT: Mettre à jour une automation
 * DELETE: Supprimer une automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyApiPermission } from '@/lib/permissions'

// PUT: Mettre à jour une automation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await verifyApiPermission('settings', 'edit')
  if (!permCheck.success) {
    return permCheck.errorResponse
  }

  const { id } = await params
  const supabase = await createClient()

  try {
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    // Seuls les champs fournis sont mis à jour
    const allowedFields = [
      'name', 'description', 'trigger_event', 'template_code',
      'delay_minutes', 'conditions', 'enabled', 'max_sends', 'branch_id'
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: automation, error } = await (supabase as any)
      .from('email_automations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating email automation:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update automation' },
        { status: 500 }
      )
    }

    if (!automation) {
      return NextResponse.json(
        { success: false, error: 'Automation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: automation
    })

  } catch (error) {
    console.error('Error in PUT /api/email-automations/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Supprimer une automation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await verifyApiPermission('settings', 'delete')
  if (!permCheck.success) {
    return permCheck.errorResponse
  }

  const { id } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('email_automations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting email automation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete automation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
