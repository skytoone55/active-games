import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * POST /api/admin/messenger/workflows/[id]/outputs
 * Crée ou met à jour les outputs d'une step
 * Body: { from_step_ref, outputs: [{ output_type, destination_type, destination_ref }] }
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

    // Supprimer les anciens outputs de cette step
    await supabase
      .from('messenger_workflow_outputs')
      .delete()
      .eq('workflow_id', id)
      .eq('from_step_ref', body.from_step_ref)

    // Créer les nouveaux outputs
    if (body.outputs && body.outputs.length > 0) {
      const outputsToInsert = body.outputs.map((output: any, index: number) => ({
        workflow_id: id,
        from_step_ref: body.from_step_ref,
        output_type: output.output_type,
        output_label: output.output_label || null,
        destination_type: output.destination_type,
        destination_ref: output.destination_ref || null,
        priority: index
      }))

      const { data: newOutputs, error } = await supabase
        .from('messenger_workflow_outputs')
        .insert(outputsToInsert)
        .select()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data: newOutputs })
    }

    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    console.error('[Workflow Outputs API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/messenger/workflows/[id]/outputs
 * Supprime tous les outputs d'une step
 * Query: ?from_step_ref=XXX
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const fromStepRef = searchParams.get('from_step_ref')

    if (!fromStepRef) {
      return NextResponse.json(
        { success: false, error: 'from_step_ref is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient() as any

    const { error } = await supabase
      .from('messenger_workflow_outputs')
      .delete()
      .eq('workflow_id', id)
      .eq('from_step_ref', fromStepRef)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Workflow Outputs API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
