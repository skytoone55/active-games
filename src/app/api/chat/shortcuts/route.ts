/**
 * Chat Shortcuts API
 * CRUD for per-user message shortcut buttons in WhatsApp chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// GET - Fetch all shortcuts for the current user
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('chat_shortcuts')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('[Shortcuts API] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST - Create a new shortcut
export async function POST(request: NextRequest) {
  try {
    const { userId, label, message, emoji } = await request.json()

    if (!userId || !label?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'userId, label and message required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get max order_index for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('chat_shortcuts')
      .select('order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('chat_shortcuts')
      .insert({
        user_id: userId,
        label: label.trim(),
        message: message.trim(),
        emoji: emoji || '',
        order_index: nextOrder,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[Shortcuts API] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PUT - Update an existing shortcut
export async function PUT(request: NextRequest) {
  try {
    const { id, userId, label, message, emoji } = await request.json()

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {}
    if (label !== undefined) updates.label = label.trim()
    if (message !== undefined) updates.message = message.trim()
    if (emoji !== undefined) updates.emoji = emoji

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('chat_shortcuts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[Shortcuts API] PUT error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE - Remove a shortcut
export async function DELETE(request: NextRequest) {
  try {
    const { id, userId } = await request.json()

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('chat_shortcuts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Shortcuts API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
