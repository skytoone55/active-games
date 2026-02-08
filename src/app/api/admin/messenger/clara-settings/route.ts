import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// GET - Load global Clara settings (from first active workflow or defaults)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    // Get first active workflow's Clara settings as global defaults
    const { data: workflow, error } = await supabase
      .from('messenger_workflows')
      .select('clara_default_prompt, clara_fallback_action, clara_fallback_message')
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    // Return settings or defaults
    const settings = workflow || {
      clara_default_prompt: `Tu es Clara, l'assistante de réservation pour Active Games. Ton rôle est de guider le client naturellement à travers le processus de réservation.

OBJECTIF : Collecter toutes les informations nécessaires pour la réservation :
- Branche (lieu)
- Nom et téléphone du client
- Date et heure souhaitées
- Nombre de personnes
- Type d'activité

RÈGLES :
1. Sois naturelle et flexible dans la conversation
2. Tu peux collecter plusieurs informations en une seule fois si le client les donne
3. Si le client pose une question hors-sujet, réponds brièvement puis reviens à la réservation
4. Avant de vérifier la disponibilité, assure-toi d'avoir TOUTES les informations
5. Si tu rencontres un problème technique, indique que tu vas faire rappeler le client

IMPORTANT : Ne confirme JAMAIS une réservation sans avoir vérifié la disponibilité réelle.`,
      clara_fallback_action: 'escalate',
      clara_fallback_message: 'Je rencontre un problème technique. Un de nos conseillers va vous rappeler rapidement pour finaliser votre réservation. 📞'
    }

    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error('[Clara Settings GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Clara settings' },
      { status: 500 }
    )
  }
}

// PUT - Save global Clara settings (to all active workflows)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { clara_default_prompt, clara_fallback_action, clara_fallback_message } = body

    const supabase = createServiceRoleClient()

    // Update all active workflows with these settings
    const { error } = await supabase
      .from('messenger_workflows')
      .update({
        clara_default_prompt,
        clara_fallback_action,
        clara_fallback_message,
        updated_at: new Date().toISOString()
      })
      .eq('is_active', true)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Clara settings saved successfully'
    })
  } catch (error) {
    console.error('[Clara Settings PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save Clara settings' },
      { status: 500 }
    )
  }
}
