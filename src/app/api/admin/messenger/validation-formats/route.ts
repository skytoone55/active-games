import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/admin/messenger/validation-formats
 * Récupère tous les formats de validation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient() as any

    const { data: formats, error } = await supabase
      .from('messenger_validation_formats')
      .select('*')
      .eq('is_active', true)
      .order('format_name')

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch formats' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: formats })
  } catch (error) {
    console.error('[Validation Formats API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/messenger/validation-formats
 * Crée un nouveau format de validation (custom)
 */
export async function POST(request: NextRequest) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    const { data: newFormat, error } = await supabase
      .from('messenger_validation_formats')
      .insert({
        format_code: body.format_code,
        format_name: body.format_name,
        validation_regex: body.validation_regex || null,
        validation_function: body.validation_function || null,
        error_message: body.error_message,
        description: body.description || null,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: newFormat })
  } catch (error) {
    console.error('[Validation Formats API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
