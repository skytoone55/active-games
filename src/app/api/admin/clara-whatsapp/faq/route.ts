import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { syncFAQEmbedding } from '@/lib/clara-codex/agents/info/embeddings'

/**
 * GET /api/admin/clara-whatsapp/faq
 * Récupère toutes les FAQ
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient() as any

    const { data: faqs, error } = await supabase
      .from('clara_whatsapp_faq')
      .select('*')
      .order('category')
      .order('order_index')

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch FAQs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: faqs })
  } catch (error) {
    console.error('[Clara WhatsApp FAQ API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/clara-whatsapp/faq
 * Crée une nouvelle FAQ
 */
export async function POST(request: NextRequest) {
  try {
    const { success: hasPermission, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!hasPermission) {
      return errorResponse || NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createServiceRoleClient() as any

    const { data: newFaq, error } = await supabase
      .from('clara_whatsapp_faq')
      .insert({
        category: body.category || 'general',
        question: body.question,
        answer: body.answer,
        order_index: body.order_index || 0,
        is_active: body.is_active ?? true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Auto-generate embedding for the new FAQ (fire-and-forget)
    if (newFaq?.id) {
      syncFAQEmbedding(supabase, newFaq.id, body.question, body.answer).catch((err) =>
        console.error('[Clara WhatsApp FAQ API] Embedding sync error:', err)
      )
    }

    return NextResponse.json({ success: true, data: newFaq })
  } catch (error) {
    console.error('[Clara WhatsApp FAQ API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
