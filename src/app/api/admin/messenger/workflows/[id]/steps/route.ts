import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * POST /api/admin/messenger/workflows/[id]/steps
 * Crée une nouvelle step dans le workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    // Vérifier si c'est la première step du workflow
    const { data: existingSteps } = await supabase
      .from('messenger_workflow_steps')
      .select('id')
      .eq('workflow_id', id)

    const isFirstStep = !existingSteps || existingSteps.length === 0

    // Si c'est la première step, elle devient automatiquement entry_point
    // Si on force is_entry_point=true, retirer le flag des autres steps
    if (body.is_entry_point === true && !isFirstStep) {
      await supabase
        .from('messenger_workflow_steps')
        .update({ is_entry_point: false })
        .eq('workflow_id', id)
    }

    const { data: newStep, error } = await supabase
      .from('messenger_workflow_steps')
      .insert({
        workflow_id: id,
        step_ref: body.step_ref,
        step_name: body.step_name,
        module_ref: body.module_ref,
        is_entry_point: isFirstStep ? true : (body.is_entry_point || false),
        order_index: body.order_index || 0
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: newStep })
  } catch (error) {
    console.error('[Workflow Steps API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
