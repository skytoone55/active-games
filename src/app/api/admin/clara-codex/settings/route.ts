import { NextRequest, NextResponse } from 'next/server'
import { verifyApiPermission } from '@/lib/permissions'
import {
  getClaraCodexModels,
  getClaraCodexSettings,
  saveClaraCodexSettings,
  normalizeClaraCodexSettings,
} from '@/lib/clara-codex'

export async function GET() {
  try {
    const { success, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success) return errorResponse!

    const record = await getClaraCodexSettings()

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        is_active: record.is_active,
        settings: record.settings,
        models: getClaraCodexModels(),
      },
    })
  } catch (error) {
    console.error('[Clara Codex Settings API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Clara Codex settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success) return errorResponse!

    const body = await request.json()
    const isActive = body?.is_active === true
    const settings = normalizeClaraCodexSettings(body?.settings || {})

    const saved = await saveClaraCodexSettings({
      is_active: isActive,
      settings,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: saved.id,
        is_active: saved.is_active,
        settings: saved.settings,
      },
    })
  } catch (error) {
    console.error('[Clara Codex Settings API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save Clara Codex settings' },
      { status: 500 }
    )
  }
}
