/**
 * API Debug - Vérifier et corriger les settings
 * GET /api/debug/settings?branch_id=xxx
 * PATCH /api/debug/settings - Corriger les settings
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Corriger les settings
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (body.action === 'fix_duration') {
      // Corriger game_duration_minutes à 30 pour toutes les branches
      const { data, error } = await supabase
        .from('branch_settings')
        .update({ game_duration_minutes: 30 })
        .neq('game_duration_minutes', 30)
        .select()
      
      if (error) {
        return NextResponse.json({ error: 'Failed to update', details: error }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'game_duration_minutes mis à jour à 30 minutes',
        updated: data?.length || 0
      })
    }
    
    if (body.branch_id && body.settings) {
      // Mise à jour personnalisée
      const { data, error } = await supabase
        .from('branch_settings')
        .update(body.settings)
        .eq('branch_id', body.branch_id)
        .select()
      
      if (error) {
        return NextResponse.json({ error: 'Failed to update', details: error }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, updated: data })
    }
    
    return NextResponse.json({ error: 'Invalid request. Use action: "fix_duration" or provide branch_id + settings' }, { status: 400 })
    
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branchId = searchParams.get('branch_id')
  
  try {
    // Récupérer toutes les branches
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, name')
    
    if (branchesError) {
      return NextResponse.json({ error: 'Failed to fetch branches', details: branchesError }, { status: 500 })
    }
    
    // Récupérer tous les settings
    const { data: allSettings, error: settingsError } = await supabase
      .from('branch_settings')
      .select('*')
    
    if (settingsError) {
      return NextResponse.json({ error: 'Failed to fetch settings', details: settingsError }, { status: 500 })
    }
    
    // Si branch_id spécifié, filtrer
    const settings = branchId 
      ? allSettings?.filter(s => s.branch_id === branchId)
      : allSettings
    
    // Récupérer les salles laser
    const { data: laserRooms } = await supabase
      .from('laser_rooms')
      .select('*')
      .order('branch_id, sort_order')
    
    // Récupérer les salles event
    const { data: eventRooms } = await supabase
      .from('event_rooms')
      .select('*')
      .order('branch_id, sort_order')
    
    // Formater les settings pour affichage
    const formattedSettings = settings?.map(s => ({
      branch_id: s.branch_id,
      branch_name: branches?.find(b => b.id === s.branch_id)?.name || 'Unknown',
      game_duration_minutes: s.game_duration_minutes,
      event_total_duration_minutes: s.event_total_duration_minutes,
      event_buffer_before_minutes: s.event_buffer_before_minutes,
      event_buffer_after_minutes: s.event_buffer_after_minutes,
      max_concurrent_players: s.max_concurrent_players,
      laser_total_vests: s.laser_total_vests,
      laser_spare_vests: s.laser_spare_vests,
      laser_exclusive_threshold: s.laser_exclusive_threshold,
      opening_time: s.opening_time,
      closing_time: s.closing_time,
    }))
    
    return NextResponse.json({
      branches,
      settings: formattedSettings,
      laser_rooms: laserRooms,
      event_rooms: eventRooms,
      message: 'Configuration actuelle de la base de données'
    })
    
  } catch (error) {
    console.error('Debug settings error:', error)
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}
