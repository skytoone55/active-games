import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/admin/messenger/settings
 * Récupère la configuration globale du messenger
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient() as any

    const { data: settings, error } = await supabase
      .from('messenger_settings')
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('[Messenger Settings API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/messenger/settings
 * Met à jour la configuration globale du messenger
 */
export async function PUT(request: NextRequest) {
  try {
    // Vérifier les permissions
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    // Récupérer le settings existant
    const { data: existingSettings } = await supabase
      .from('messenger_settings')
      .select('id')
      .single()

    if (!existingSettings) {
      return NextResponse.json(
        { success: false, error: 'Settings not found' },
        { status: 404 }
      )
    }

    // Mettre à jour
    const { data: updatedSettings, error } = await supabase
      .from('messenger_settings')
      .update({
        is_active: body.is_active ?? undefined,
        welcome_delay_seconds: body.welcome_delay_seconds ?? undefined,
        settings: body.settings ?? undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingSettings.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updatedSettings })
  } catch (error) {
    console.error('[Messenger Settings API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
