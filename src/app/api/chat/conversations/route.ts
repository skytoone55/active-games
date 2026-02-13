/**
 * Chat Conversations API
 * GET - List WhatsApp conversations with last message preview
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission, getUserAuthorizedBranches } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { success, errorResponse, user } = await verifyApiPermission('chat', 'view')
    if (!success || !user) return errorResponse!

    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const status = searchParams.get('status') || 'active'
    const branchId = searchParams.get('branchId')
    const includeUnassigned = searchParams.get('includeUnassigned') === 'true'

    // Server-side: determine allowed branches from user's actual permissions (not from URL params)
    const authorizedBranches = await getUserAuthorizedBranches(user.id, user.role)
    const allowedBranchIds = authorizedBranches.map(b => b.id)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const offset = (page - 1) * pageSize
    const countOnly = searchParams.get('countOnly') === 'true'
    const countFilter = searchParams.get('countFilter') // 'unread' or 'needs_human'

    // ─── countOnly mode: return only count (no data), much faster ───
    if (countOnly) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let countQuery = (supabase as any)
        .from('whatsapp_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)

      // Apply branch filter (server-validated)
      if (branchId === 'unassigned') {
        countQuery = countQuery.is('branch_id', null)
      } else if (branchId === 'all' && allowedBranchIds.length > 0) {
        const orParts = allowedBranchIds.map((id: string) => `branch_id.eq.${id}`)
        if (includeUnassigned) orParts.push('branch_id.is.null')
        countQuery = countQuery.or(orParts.join(','))
      } else if (branchId && branchId !== 'all') {
        // Verify the requested branch is in user's allowed list
        if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
          return NextResponse.json({ count: 0 })
        }
        countQuery = countQuery.eq('branch_id', branchId)
      }

      // Apply count-specific filters
      if (countFilter === 'unread') {
        countQuery = countQuery.gt('unread_count', 0)
      } else if (countFilter === 'needs_human') {
        countQuery = countQuery.eq('needs_human', true)
      }

      const { count, error } = await countQuery
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ count: count || 0 })
    }

    // ─── Normal mode: return full data ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('whatsapp_conversations')
      .select('*, contacts:contact_id(id, first_name, last_name, phone, email), branch:branch_id(id, name, name_en)', { count: 'exact' })
      .eq('status', status)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (branchId === 'unassigned') {
      // Show only conversations with no branch assigned
      query = query.is('branch_id', null)
    } else if (branchId === 'all' && allowedBranchIds.length > 0) {
      // "All" but scoped to user's server-validated branches
      const orParts = allowedBranchIds.map((id: string) => `branch_id.eq.${id}`)
      if (includeUnassigned) {
        orParts.push('branch_id.is.null')
      }
      query = query.or(orParts.join(','))
    } else if (branchId && branchId !== 'all') {
      // Verify the requested branch is in user's allowed list
      if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
        return NextResponse.json({ conversations: [], total: 0, page, pageSize })
      }
      query = query.eq('branch_id', branchId)
    }
    // When branchId is 'all' with no allowedBranchIds, user is super_admin — show everything

    if (search) {
      query = query.or(`phone.ilike.%${search}%,contact_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[CHAT API] Error fetching conversations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      conversations: data || [],
      total: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
