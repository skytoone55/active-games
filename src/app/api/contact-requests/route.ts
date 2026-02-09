/**
 * API Route admin pour les demandes de contact (leads)
 * GET: Liste des demandes de contact avec filtres
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/contact-requests
 * Liste les demandes de contact pour une branche
 * Query params:
 * - branchId (required)
 * - status: 'all' | 'unread' | 'read' (default: 'all')
 * - page (default: 1)
 * - pageSize (default: 20)
 * - countOnly: 'true' pour ne retourner que le count des non-lues
 */
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId')
    const status = searchParams.get('status') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const countOnly = searchParams.get('countOnly') === 'true'

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branchId)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    const supabase = createServiceRoleClient()

    // Mode countOnly - retourne juste le nombre de non-lues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (countOnly) {
      const { count, error } = await (supabase as any)
        .from('contact_requests')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('is_read', false)

      if (error) {
        console.error('Error counting contact requests:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to count contact requests' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, unreadCount: count || 0 })
    }

    // Mode liste
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('contact_requests')
      .select('*', { count: 'exact' })
      .eq('branch_id', branchId)

    if (status === 'unread') {
      query = query.eq('is_read', false)
    } else if (status === 'read') {
      query = query.eq('is_read', true)
    }

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data: requests, error, count } = await query

    if (error) {
      console.error('Error fetching contact requests:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contact requests' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      success: true,
      requests: requests || [],
      total,
      page,
      pageSize,
      totalPages
    })

  } catch (error) {
    console.error('Error in GET /api/contact-requests:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
