/**
 * API Clara Settings - Admin
 * GET: Récupérer les settings Clara (prompt, knowledge, model, etc.)
 * PUT: Mettre à jour les settings Clara
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CLARA_KNOWLEDGE } from '@/lib/clara/knowledge'
import { generatePublicSystemPrompt } from '@/lib/clara/prompts'

// Type for system_settings table (not in generated types)
interface SystemSetting {
  key: string
  value: Record<string, unknown>
  updated_at?: string
}

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
  max_conversation_messages: 150,
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

// Utilise le vrai prompt depuis prompts.ts (pas de duplication)
const DEFAULT_PUBLIC_PROMPT = generatePublicSystemPrompt()

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
    .single<{ role: string }>()

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Récupérer les settings Clara
    const { data: claraSettings } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'clara')
      .single() as { data: SystemSetting | null }

    // Récupérer le prompt personnalisé (si existe)
    const { data: promptSetting } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_public_prompt')
      .single() as { data: SystemSetting | null }

    // Récupérer la knowledge base personnalisée (si existe)
    const { data: knowledgeSetting } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_knowledge')
      .single() as { data: SystemSetting | null }

    // Récupérer les clés API de chaque provider (masquées)
    const apiKeys: Record<string, { configured: boolean; masked: string | null }> = {}

    for (const [providerId, provider] of Object.entries(LLM_PROVIDERS)) {
      const key = process.env[provider.envKey]
      apiKeys[providerId] = {
        configured: !!key,
        masked: key ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : null,
      }
    }

    // Merger les settings DB avec les defaults (DB values override defaults)
    const mergedSettings = {
      ...DEFAULT_CLARA_SETTINGS,
      ...(claraSettings?.value || {}),
      public_chat: {
        ...DEFAULT_CLARA_SETTINGS.public_chat,
        ...(claraSettings?.value as Record<string, unknown>)?.public_chat || {},
      },
      crm_chat: {
        ...DEFAULT_CLARA_SETTINGS.crm_chat,
        ...(claraSettings?.value as Record<string, unknown>)?.crm_chat || {},
      },
    }

    return NextResponse.json({
      settings: mergedSettings,
      customPrompt: (promptSetting?.value as { prompt?: string })?.prompt || null,
      customKnowledge: (knowledgeSetting?.value as { knowledge?: string })?.knowledge || null,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Reset settings si demandé
    if (resetSettings) {
      await db
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
      await db
        .from('system_settings')
        .delete()
        .eq('key', 'clara_public_prompt')

      return NextResponse.json({ success: true, message: 'Prompt reset to default' })
    }

    // Reset knowledge si demandé
    if (resetKnowledge) {
      await db
        .from('system_settings')
        .delete()
        .eq('key', 'clara_knowledge')

      return NextResponse.json({ success: true, message: 'Knowledge reset to default' })
    }

    // Mettre à jour les settings généraux
    if (settings) {
      await db
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
        await db
          .from('system_settings')
          .delete()
          .eq('key', 'clara_public_prompt')
      } else {
        await db
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
        await db
          .from('system_settings')
          .delete()
          .eq('key', 'clara_knowledge')
      } else {
        await db
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
