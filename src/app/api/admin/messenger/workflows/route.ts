import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/admin/messenger/workflows
 * Récupère tous les workflows
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient() as any

    const { data: workflows, error } = await supabase
      .from('messenger_workflows')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch workflows' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: workflows })
  } catch (error) {
    console.error('[Messenger Workflows API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/messenger/workflows
 * Crée un nouveau workflow
 */
export async function POST(request: NextRequest) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    // Si on active ce workflow, désactiver les autres
    if (body.is_active) {
      await supabase
        .from('messenger_workflows')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Tous
    }

    const { data: newWorkflow, error } = await supabase
      .from('messenger_workflows')
      .insert({
        name: body.name,
        description: body.description || null,
        is_active: body.is_active ?? false
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: newWorkflow })
  } catch (error) {
    console.error('[Messenger Workflows API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
