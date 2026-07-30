/**
 * API publique — Paramètres de réservation en ligne par branche (sans auth)
 * GET /api/public/branch-online-settings?branch_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// SÉCURITÉ : clé SERVEUR (service role) — jamais exposée au navigateur.
// Requis depuis l'activation du RLS qui bloque l'accès anonyme direct à la base.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const branchId   = request.nextUrl.searchParams.get('branch_id')
    const branchSlug = request.nextUrl.searchParams.get('slug')

    if (!branchId && !branchSlug) {
      return NextResponse.json({ success: false, error: 'branch_id or slug required' }, { status: 400 })
    }

    // Résoudre le slug en branch_id si nécessaire
    let resolvedBranchId = branchId
    if (!resolvedBranchId && branchSlug) {
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('slug', branchSlug)
        .single()
      resolvedBranchId = branch?.id || null
    }

    if (!resolvedBranchId) {
      return NextResponse.json({
        success: true,
        settings: { online_orders_enabled: true, active_game_enabled: true, laser_enabled: true }
      })
    }

    const { data, error } = await supabase
      .from('branch_settings')
      .select('online_orders_enabled, active_game_enabled, laser_enabled')
      .eq('branch_id', resolvedBranchId)
      .single()

    if (error) {
      // En cas d'erreur, on autorise tout par défaut (fail-open)
      return NextResponse.json({
        success: true,
        settings: { online_orders_enabled: true, active_game_enabled: true, laser_enabled: true }
      })
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
    console.error('GET /api/public/branch-online-settings error:', err)
    return NextResponse.json({
      success: true,
      settings: { online_orders_enabled: true, active_game_enabled: true, laser_enabled: true }
    })
  }
}
