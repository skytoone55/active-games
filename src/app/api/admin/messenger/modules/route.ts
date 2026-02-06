import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/admin/messenger/modules
 * Récupère tous les modules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient() as any

    const { data: modules, error } = await supabase
      .from('messenger_modules')
      .select('*')
      .order('category')
      .order('name')

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch modules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: modules })
  } catch (error) {
    console.error('[Messenger Modules API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/messenger/modules
 * Crée un nouveau module
 */
export async function POST(request: NextRequest) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    const { data: newModule, error } = await supabase
      .from('messenger_modules')
      .insert({
        ref_code: body.ref_code,
        name: body.name,
        module_type: body.module_type,
        content: body.content,
        params: body.params || {},
        validation_format_code: body.validation_format_code || null,
        custom_error_message: body.custom_error_message || null,
        choices: body.choices || null,
        llm_config: body.llm_config || null,
        category: body.category || 'general',
        is_active: body.is_active ?? true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: newModule })
  } catch (error) {
    console.error('[Messenger Modules API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
