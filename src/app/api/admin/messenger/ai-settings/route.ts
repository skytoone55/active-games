/**
 * API Messenger AI Settings - Admin
 * GET: Récupérer les paramètres AI du Messenger (provider, modèle, status des clés API)
 * PUT: Mettre à jour le provider et le modèle global
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

interface SystemSetting {
  key: string
  value: Record<string, unknown>
  updated_at?: string
}

// Providers et modèles disponibles (même liste que Clara AI)
const LLM_PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Rapide et économique' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Équilibré' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Le plus puissant' },
    ],
    envKey: 'ANTHROPIC_API_KEY',
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
}

// Valeurs par défaut
const DEFAULT_MESSENGER_AI_SETTINGS = {
  provider: 'anthropic' as 'anthropic' | 'openai' | 'gemini',
  model: 'claude-3-5-sonnet-20241022',
}

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
 * GET /api/admin/messenger/ai-settings
 * Récupère les settings AI du Messenger + status des clés API
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

    // Récupérer les settings AI du Messenger
    const { data: messengerAI } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'messenger_ai')
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

    // Merger les settings DB avec les defaults
    const mergedSettings = {
      ...DEFAULT_MESSENGER_AI_SETTINGS,
      ...(messengerAI?.value || {}),
    }

    return NextResponse.json({
      settings: mergedSettings,
      providers: LLM_PROVIDERS,
      apiKeys,
    })

  } catch (error) {
    console.error('[Messenger AI Settings API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/messenger/ai-settings
 * Met à jour le provider et le modèle global
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkSuperAdmin()
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, model } = body

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'provider and model are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Mettre à jour les settings
    await db
      .from('system_settings')
      .upsert({
        key: 'messenger_ai',
        value: { provider, model },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Messenger AI Settings API] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
