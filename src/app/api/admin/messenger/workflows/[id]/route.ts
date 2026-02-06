import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/admin/messenger/workflows/[id]
 * Récupère un workflow avec ses steps et outputs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient() as any

    // Récupérer le workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('messenger_workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Récupérer les steps
    const { data: steps, error: stepsError } = await supabase
      .from('messenger_workflow_steps')
      .select('*')
      .eq('workflow_id', id)
      .order('order_index')

    // Récupérer les outputs
    const { data: outputs, error: outputsError } = await supabase
      .from('messenger_workflow_outputs')
      .select('*')
      .eq('workflow_id', id)
      .order('from_step_ref')
      .order('priority')

    if (stepsError || outputsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch workflow data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        workflow,
        steps: steps || [],
        outputs: outputs || []
      }
    })
  } catch (error) {
    console.error('[Messenger Workflows API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/messenger/workflows/[id]
 * Met à jour un workflow
 */
export async function PUT(
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

    // Si on active ce workflow, désactiver les autres
    if (body.is_active) {
      await supabase
        .from('messenger_workflows')
        .update({ is_active: false })
        .neq('id', id)
    }

    const { data: updatedWorkflow, error } = await supabase
      .from('messenger_workflows')
      .update({
        name: body.name,
        description: body.description,
        is_active: body.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updatedWorkflow })
  } catch (error) {
    console.error('[Messenger Workflows API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/messenger/workflows/[id]
 * Supprime un workflow (et ses steps/outputs via CASCADE)
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
    const supabase = createServiceRoleClient() as any

    const { error } = await supabase
      .from('messenger_workflows')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Messenger Workflows API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
