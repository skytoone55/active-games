/**
 * API Route pour gérer les appels téléphoniques
 * GET: Liste des appels avec filtres et pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/calls
 * Recherche et liste les appels avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('calls', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const query = searchParams.get('query') || ''
    const status = searchParams.get('status') || 'all'
    const direction = searchParams.get('direction') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'Branch ID required', messageKey: 'errors.branchRequired' },
        { status: 400 }
      )
    }

    // Vérifier l'accès branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branchId)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
        { status: 403 }
      )
    }

    const supabase = createServiceRoleClient()

    // Construction de la requête avec jointure contact
    let queryBuilder = supabase
      .from('calls')
      .select(`
        *,
        contact:contacts(
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('started_at', { ascending: false })

    // Filtres
    if (status !== 'all') {
      queryBuilder = queryBuilder.eq('status', status)
    }

    if (direction !== 'all') {
      queryBuilder = queryBuilder.eq('direction', direction)
    }

    if (query) {
      queryBuilder = queryBuilder.or(`from_number.ilike.%${query}%,to_number.ilike.%${query}%,notes.ilike.%${query}%`)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    queryBuilder = queryBuilder.range(from, to)

    const { data: calls, error, count } = await queryBuilder

    if (error) {
      console.error('Error fetching calls:', error)
      return NextResponse.json(
        { success: false, error: error.message, messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      success: true,
      calls: calls || [],
      total,
      page,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error('Error in GET /api/calls:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
