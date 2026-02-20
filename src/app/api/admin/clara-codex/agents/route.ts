import { NextRequest, NextResponse } from 'next/server'
import { verifyApiPermission } from '@/lib/permissions'
import { getAgentConfigs, saveAgentConfigs, normalizeAllAgentConfigs } from '@/lib/clara-codex/agents/settings'
import { getClaraCodexModels, getClaraCodexSettings, saveClaraCodexSettings } from '@/lib/clara-codex/settings'

export async function GET() {
  try {
    const { success, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success) return errorResponse!

    const agents = await getAgentConfigs()
    const models = getClaraCodexModels()

    // Also load global prompt settings from the main settings record
    const codexSettings = await getClaraCodexSettings()
    const promptSettings = {
      custom_prompt: codexSettings.settings.custom_prompt || '',
      enforce_email_for_link: codexSettings.settings.enforce_email_for_link !== false,
    }

    return NextResponse.json({ success: true, data: { agents, models, promptSettings } })
  } catch (error) {
    console.error('[Clara Codex Agents API] GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load agent configs' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success) return errorResponse!

    const body = await request.json()
    const normalized = normalizeAllAgentConfigs(body?.agents || {})
    const saved = await saveAgentConfigs(normalized)

    // Also save global prompt settings if provided
    if (body?.promptSettings) {
      const codexSettings = await getClaraCodexSettings()
      const updatedSettings = { ...codexSettings.settings }
      if (typeof body.promptSettings.custom_prompt === 'string') {
        updatedSettings.custom_prompt = body.promptSettings.custom_prompt
      }
      if (typeof body.promptSettings.enforce_email_for_link === 'boolean') {
        updatedSettings.enforce_email_for_link = body.promptSettings.enforce_email_for_link
      }
      await saveClaraCodexSettings({
        is_active: codexSettings.is_active,
        settings: updatedSettings,
      })
    }

    return NextResponse.json({ success: true, data: { agents: saved } })
  } catch (error) {
    console.error('[Clara Codex Agents API] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save agent configs' }, { status: 500 })
  }
}
