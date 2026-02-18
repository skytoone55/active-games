import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { syncAllFAQEmbeddings } from '@/lib/clara-codex/agents/info/embeddings'

/**
 * POST /api/admin/messenger/faq/sync-embeddings
 * Synchronise les embeddings de toutes les FAQ actives
 */
export async function POST(request: NextRequest) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient() as any
    const result = await syncAllFAQEmbeddings(supabase)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[FAQ Sync Embeddings] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
