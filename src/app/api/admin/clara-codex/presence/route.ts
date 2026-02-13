import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/permissions'
import { upsertCodexAgentPresence } from '@/lib/clara-codex'

export async function POST(_request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (!user || error) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Super admin should not be considered "available human" for Codex routing.
    if (user.role === 'super_admin') {
      return NextResponse.json({ success: true, ignored: true })
    }

    await upsertCodexAgentPresence({
      userId: user.id,
      role: user.role,
      branchIds: user.branchIds || [],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Clara Codex Presence API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update presence' },
      { status: 500 }
    )
  }
}
