/**
 * API Route — Order notification emails per branch
 * GET  /api/branch-notification?branch_id=xxx  — fetch notification emails
 * PATCH /api/branch-notification               — update notification emails
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { verifyApiPermission } = await import('@/lib/permissions')
    const { success, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success) return errorResponse

    const branchId = request.nextUrl.searchParams.get('branch_id')
    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('branch_settings')
      .select('order_notification_emails')
      .eq('branch_id', branchId)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      emails: (data?.order_notification_emails as string[]) || []
    })
  } catch (err) {
    console.error('GET /api/branch-notification error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { verifyApiPermission } = await import('@/lib/permissions')
    const { success, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success) return errorResponse

    const body = await request.json()
    const { branch_id, emails } = body

    if (!branch_id || !Array.isArray(emails)) {
      return NextResponse.json({ success: false, error: 'branch_id and emails array required' }, { status: 400 })
    }

    // Validate each entry is a string that looks like an email
    const cleaned = emails.map((e: unknown) => String(e).trim()).filter(e => e.includes('@'))

    const { error } = await supabase
      .from('branch_settings')
      .update({ order_notification_emails: cleaned })
      .eq('branch_id', branch_id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emails: cleaned })
  } catch (err) {
    console.error('PATCH /api/branch-notification error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
