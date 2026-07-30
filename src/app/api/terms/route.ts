/**
 * API Route pour récupérer les Conditions Générales
 * GET /api/terms?lang=en|he|fr
 * Returns { game: string, event: string } avec le HTML des CGV
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// SÉCURITÉ : clé SERVEUR (service role) — cette route tourne côté serveur,
// la clé n'atteint jamais le navigateur. Requis depuis l'activation du RLS.
const getSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'en'

    // Valider la langue
    const validLangs = ['en', 'he', 'fr']
    const langCode = validLangs.includes(lang) ? lang : 'en'

    const supabase = getSupabase()

    // Récupérer les templates CGV pour games et events
    const gameCode = `terms_game_${langCode}`
    const eventCode = `terms_event_${langCode}`

    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('code, body_template')
      .in('code', [gameCode, eventCode])
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching terms:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch terms' },
        { status: 500 }
      )
    }

    // Organiser les résultats
    const result: { game: string | null; event: string | null } = {
      game: null,
      event: null
    }

    for (const template of templates || []) {
      if (template.code === gameCode) {
        result.game = template.body_template
      } else if (template.code === eventCode) {
        result.event = template.body_template
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in terms API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
