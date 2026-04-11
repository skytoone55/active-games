/**
 * API Route — Online order settings per branch (admin)
 * GET  /api/branch-online-settings?branch_id=xxx
 * PATCH /api/branch-online-settings  { branch_id, online_orders_enabled, active_game_enabled, laser_enabled }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { verifyApiPermission } = await import('@/lib/permissions')
    const { success, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success) return errorResponse

    const branchId = request.nextUrl.searchParams.get('branch_id')
    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('branch_settings')
      .select('online_orders_enabled, active_game_enabled, laser_enabled')
      .eq('branch_id', branchId)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      settings: {
        online_orders_enabled: data?.online_orders_enabled ?? true,
        active_game_enabled:   data?.active_game_enabled   ?? true,
        laser_enabled:         data?.laser_enabled         ?? true,
      }
    })
  } catch (err) {
    console.error('GET /api/branch-online-settings error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { verifyApiPermission } = await import('@/lib/permissions')
    const { success, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success) return errorResponse

    const body = await request.json()
    const { branch_id, online_orders_enabled, active_game_enabled, laser_enabled } = body

    if (!branch_id) {
      return NextResponse.json({ success: false, error: 'branch_id required' }, { status: 400 })
    }

    const updatePayload: Record<string, boolean> = {}
    if (typeof online_orders_enabled === 'boolean') updatePayload.online_orders_enabled = online_orders_enabled
    if (typeof active_game_enabled   === 'boolean') updatePayload.active_game_enabled   = active_game_enabled
    if (typeof laser_enabled         === 'boolean') updatePayload.laser_enabled         = laser_enabled

    const { error } = await supabase
      .from('branch_settings')
      .update(updatePayload)
      .eq('branch_id', branch_id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('PATCH /api/branch-online-settings error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
