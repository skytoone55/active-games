import { NextRequest, NextResponse } from 'next/server'
import { verifyApiPermission } from '@/lib/permissions'
import { getAgentConfigs, saveAgentConfigs, normalizeAllAgentConfigs } from '@/lib/clara-codex/agents/settings'
import { getClaraCodexModels } from '@/lib/clara-codex/settings'

export async function GET() {
  try {
    const { success, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success) return errorResponse!

    const agents = await getAgentConfigs()
    const models = getClaraCodexModels()

    return NextResponse.json({ success: true, data: { agents, models } })
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

    return NextResponse.json({ success: true, data: { agents: saved } })
  } catch (error) {
    console.error('[Clara Codex Agents API] PUT error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save agent configs' }, { status: 500 })
  }
}
