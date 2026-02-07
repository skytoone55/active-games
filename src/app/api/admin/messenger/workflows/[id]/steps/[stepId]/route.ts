import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * PUT /api/admin/messenger/workflows/[id]/steps/[stepId]
 * Met à jour une step
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id, stepId } = await params
    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    // Récupérer l'ancien module_ref pour détecter changement
    const { data: oldStep } = await supabase
      .from('messenger_workflow_steps')
      .select('module_ref, step_ref')
      .eq('id', stepId)
      .single()

    // Si on marque cette step comme entry_point, retirer le flag des autres
    if (body.is_entry_point === true) {
      await supabase
        .from('messenger_workflow_steps')
        .update({ is_entry_point: false })
        .eq('workflow_id', id)
        .neq('id', stepId)
    }

    const { data: updatedStep, error } = await supabase
      .from('messenger_workflow_steps')
      .update({
        step_name: body.step_name,
        module_ref: body.module_ref,
        is_entry_point: body.is_entry_point,
        order_index: body.order_index,
        updated_at: new Date().toISOString()
      })
      .eq('id', stepId)
      .select()
      .single()

    // Si module_ref a changé, supprimer tous les outputs de ce step
    if (oldStep && oldStep.module_ref !== body.module_ref) {
      await supabase
        .from('messenger_workflow_outputs')
        .delete()
        .eq('workflow_id', id)
        .eq('from_step_ref', oldStep.step_ref)
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updatedStep })
  } catch (error) {
    console.error('[Workflow Steps API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/messenger/workflows/[id]/steps/[stepId]
 * Supprime une step
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id, stepId } = await params
    const supabase = createServiceRoleClient() as any

    // Supprimer aussi les outputs associés
    await supabase
      .from('messenger_workflow_outputs')
      .delete()
      .eq('workflow_id', id)
      .eq('from_step_ref', (await supabase
        .from('messenger_workflow_steps')
        .select('step_ref')
        .eq('id', stepId)
        .single()).data?.step_ref || '')

    const { error } = await supabase
      .from('messenger_workflow_steps')
      .delete()
      .eq('id', stepId)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Workflow Steps API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
