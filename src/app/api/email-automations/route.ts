/**
 * API Route: /api/email-automations
 *
 * GET: Liste des automations email
 * POST: Créer une nouvelle automation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyApiPermission } from '@/lib/permissions'

// GET: Récupérer la liste des automations
export async function GET() {
  const permCheck = await verifyApiPermission('settings', 'view')
  if (!permCheck.success) {
    return permCheck.errorResponse
  }

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: automations, error } = await (supabase as any)
    .from('email_automations')
    .select('*')
    .order('trigger_event', { ascending: true })
    .order('delay_minutes', { ascending: true })

  if (error) {
    console.error('Error fetching email automations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch automations' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: automations || []
  })
}

// POST: Créer une nouvelle automation
export async function POST(request: NextRequest) {
  const permCheck = await verifyApiPermission('settings', 'create')
  if (!permCheck.success) {
    return permCheck.errorResponse
  }

  const supabase = await createClient()

  try {
    const body = await request.json()
    const {
      name,
      description,
      trigger_event,
      template_code,
      delay_minutes = 0,
      conditions = {},
      enabled = true,
      max_sends = null,
      branch_id = null,
    } = body

    // Validation
    if (!name || !trigger_event || !template_code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, trigger_event, template_code' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: automation, error } = await (supabase as any)
      .from('email_automations')
      .insert({
        name,
        description: description || null,
        trigger_event,
        template_code,
        delay_minutes,
        conditions,
        enabled,
        max_sends,
        branch_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating email automation:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An automation with this trigger/template/branch combination already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create automation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: automation
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/email-automations:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
