import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * PUT /api/admin/messenger/modules/[id]
 * Met à jour un module
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

    const { data: updatedModule, error } = await supabase
      .from('messenger_modules')
      .update({
        name: body.name,
        module_type: body.module_type,
        content: body.content,
        params: body.params,
        validation_format_code: body.validation_format_code || null,
        custom_error_message: body.custom_error_message || null,
        choices: body.choices || null,
        llm_config: body.llm_config || null,
        success_message: body.success_message || null,
        failure_message: body.failure_message || null,
        category: body.category,
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

    return NextResponse.json({ success: true, data: updatedModule })
  } catch (error) {
    console.error('[Messenger Modules API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/messenger/modules/[id]
 * Supprime un module
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
      .from('messenger_modules')
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
    console.error('[Messenger Modules API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
