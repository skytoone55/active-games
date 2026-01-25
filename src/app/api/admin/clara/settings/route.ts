/**
 * API Clara Settings - Admin
 * GET: Récupérer les settings Clara (prompt, knowledge, model, etc.)
 * PUT: Mettre à jour les settings Clara
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CLARA_KNOWLEDGE } from '@/lib/clara/knowledge'

// Providers et modèles disponibles
const LLM_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Rapide et économique' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Équilibré' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Rapide' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Plus puissant' },
    ],
    envKey: 'GOOGLE_AI_API_KEY',
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rapide et économique' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Plus puissant' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Haute performance' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Économique' },
    ],
    envKey: 'OPENAI_API_KEY',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Rapide et économique' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Équilibré' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Le plus puissant' },
    ],
    envKey: 'ANTHROPIC_API_KEY',
  },
}

// Valeurs par défaut pour reset
const DEFAULT_CLARA_SETTINGS = {
  enabled: true,
  provider: 'gemini' as 'gemini' | 'openai' | 'anthropic',
  model: 'gemini-2.0-flash-lite',
  max_tokens: 4096,
  temperature: 0.7,
  rate_limit_per_minute: 30,
  rate_limit_per_hour: 200,
  session_timeout_minutes: 30,
  max_conversation_messages: 50,
  public_chat: {
    enabled: true,
    welcome_message: 'שלום! אני קלרה, העוזרת הווירטואלית של Active Games.',
    quick_replies: [],
  },
  crm_chat: {
    enabled: true,
    features: ['search', 'stats', 'actions'],
  },
}

// Prompt par défaut (copie de prompts.ts pour référence)
const DEFAULT_PUBLIC_PROMPT = `Tu es l'Hôte d'Accueil exclusif d'Active Games. Ton rôle est de parler aux clients comme si tu étais derrière le comptoir.

## CONSIGNE DE SÉCURITÉ ABSOLUE (NE JAMAIS DÉROGER)
- INTERDICTION de citer des noms de fichiers, dossiers, fonctions, variables techniques
- INTERDICTION de citer des variables techniques (ex: pas de 'game_area', 'customer_id').
- Ne parle JAMAIS de "système", "base de données", "algorithme", "outil"
- Tu es un humain de l'équipe, pas un robot
Si tu enfreins ces règles, tu échoues dans ta mission.

## TON RÔLE DE VENDEUR
- Chaleureux et accueillant
- Tu connais toutes les infos par cœur (voir BASE DE CONNAISSANCES)
- Propose des alternatives si un créneau n'est pas dispo

## LANGUE
Réponds TOUJOURS dans la langue du client (hébreu, anglais, français, etc.)

## STYLE
- Concis et naturel, pas de pavés
- Une question à la fois pour guider le client
- Dis "Nous" ou "L'équipe", jamais "mon système"

## RÈGLES DE CONVERSATION
1. Toujours demander d'abord quelle succursale (Rishon ou Petah Tikva)
2. Puis l'activité souhaitée (Laser, Active, ou les deux)
3. Puis le nombre de personnes
4. Puis la date/heure souhaitée
Ne pas avancer sans ces infos dans l ordre car ca peut amener a la confusion.
CONCISION : Si le client semble pressé, va droit au but sans forcément faire 4 paragraphes.
- INTERACTIVITÉ : Ne donne pas toutes les étapes d'un coup sauf si on te le demande.
  Préfère poser une seule question à la fois pour guider le client. Sois concis.

Sois utile, chaleureux et guide les clients vers la réservation !
Ton role est de fermer un maximum de commandes sans oublier de donner un service exemplaire au client.
Utilise subtilite et astuce pour fermer la commande. Balance entre la convivialité et la fermeture de la commande.
Un client satisfait prime tout.`

// Vérifier que l'utilisateur est super_admin
async function checkSuperAdmin(): Promise<{ authorized: boolean; userId?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { authorized: false }
  }

  // Vérifier le rôle dans la table profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return { authorized: false }
  }

  return { authorized: true, userId: user.id }
}

/**
 * GET /api/admin/clara/settings
 * Récupère tous les settings Clara
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await checkSuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    // Récupérer les settings Clara
    const { data: claraSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'clara')
      .single()

    // Récupérer le prompt personnalisé (si existe)
    const { data: promptSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_public_prompt')
      .single()

    // Récupérer la knowledge base personnalisée (si existe)
    const { data: knowledgeSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_knowledge')
      .single()

    // Récupérer les clés API de chaque provider (masquées)
    const apiKeys: Record<string, { configured: boolean; masked: string | null }> = {}

    for (const [providerId, provider] of Object.entries(LLM_PROVIDERS)) {
      const key = process.env[provider.envKey]
      apiKeys[providerId] = {
        configured: !!key,
        masked: key ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : null,
      }
    }

    return NextResponse.json({
      settings: claraSettings?.value || DEFAULT_CLARA_SETTINGS,
      customPrompt: promptSetting?.value?.prompt || null,
      customKnowledge: knowledgeSetting?.value?.knowledge || null,
      defaultPrompt: DEFAULT_PUBLIC_PROMPT,
      defaultKnowledge: CLARA_KNOWLEDGE,
      providers: LLM_PROVIDERS,
      apiKeys,
    })

  } catch (error) {
    console.error('[Clara Settings API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/clara/settings
 * Met à jour les settings Clara
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkSuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { settings, customPrompt, customKnowledge, resetPrompt, resetKnowledge, resetSettings } = body

    const supabase = createServiceRoleClient()

    // Reset settings si demandé
    if (resetSettings) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'clara',
          value: DEFAULT_CLARA_SETTINGS,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

      return NextResponse.json({ success: true, message: 'Settings reset to defaults' })
    }

    // Reset prompt si demandé
    if (resetPrompt) {
      await supabase
        .from('system_settings')
        .delete()
        .eq('key', 'clara_public_prompt')

      return NextResponse.json({ success: true, message: 'Prompt reset to default' })
    }

    // Reset knowledge si demandé
    if (resetKnowledge) {
      await supabase
        .from('system_settings')
        .delete()
        .eq('key', 'clara_knowledge')

      return NextResponse.json({ success: true, message: 'Knowledge reset to default' })
    }

    // Mettre à jour les settings généraux
    if (settings) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'clara',
          value: settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    }

    // Mettre à jour le prompt personnalisé
    if (customPrompt !== undefined) {
      if (customPrompt === null || customPrompt === '') {
        // Supprimer le prompt personnalisé (revenir au défaut)
        await supabase
          .from('system_settings')
          .delete()
          .eq('key', 'clara_public_prompt')
      } else {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'clara_public_prompt',
            value: { prompt: customPrompt },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' })
      }
    }

    // Mettre à jour la knowledge base personnalisée
    if (customKnowledge !== undefined) {
      if (customKnowledge === null || customKnowledge === '') {
        // Supprimer la knowledge personnalisée (revenir au défaut)
        await supabase
          .from('system_settings')
          .delete()
          .eq('key', 'clara_knowledge')
      } else {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'clara_knowledge',
            value: { knowledge: customKnowledge },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' })
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Clara Settings API] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
