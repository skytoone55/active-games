import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { syncFAQEmbedding } from '@/lib/clara-codex/agents/info/embeddings'
import type { Database } from '@/lib/supabase/types'

/**
 * PUT /api/admin/messenger/faq/[id]
 * Met à jour une FAQ
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    const updateData: Database['public']['Tables']['messenger_faq']['Update'] = {
      category: body.category,
      question: body.question,
      answer: body.answer,
      order_index: body.order_index,
      is_active: body.is_active,
      updated_at: new Date().toISOString()
    }

    const { data: updatedFaq, error } = await supabase
      .from('messenger_faq')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Auto-regenerate embedding after update (fire-and-forget)
    if (updatedFaq?.id && body.question && body.answer) {
      syncFAQEmbedding(supabase, updatedFaq.id, body.question, body.answer).catch((err) =>
        console.error('[Messenger FAQ API] Embedding sync error:', err)
      )
    }

    return NextResponse.json({ success: true, data: updatedFaq })
  } catch (error) {
    console.error('[Messenger FAQ API] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/messenger/faq/[id]
 * Supprime une FAQ
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceRoleClient() as any

    const { error } = await supabase
      .from('messenger_faq')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Messenger FAQ API] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
