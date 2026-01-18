/**
 * API Logs - Activity Logs Management
 *
 * GET /api/logs - List logs with filters
 * DELETE /api/logs - Delete logs (super_admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logLogDeletion, getClientIpFromHeaders } from '@/lib/activity-logger'

/**
 * GET /api/logs
 * List activity logs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier les permissions via le système de permissions de la base de données
    const { success, user, errorResponse } = await verifyApiPermission('logs', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const supabase = await createClient()
    const userProfile = { role: user.role }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branch_id')
    const actionType = searchParams.get('action_type')
    const targetType = searchParams.get('target_type')
    const userRole = searchParams.get('user_role')
    const userId = searchParams.get('user_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Use service role client to bypass RLS for more flexible querying
    const serviceClient = createServiceRoleClient()

    let query = serviceClient
      .from('activity_logs')
      .select(`
        *,
        branch:branches(id, name, name_en)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters

    // For non-super_admin, always filter by their branches
    if (userProfile.role !== 'super_admin') {
      // Get user's branches from the already loaded user data
      const branchIds = user.branchIds || []
      if (branchIds.length > 0) {
        query = query.in('branch_id', branchIds)
      } else {
        // No branches = no logs
        return NextResponse.json({
          success: true,
          logs: [],
          total: 0
        })
      }
    } else if (branchId) {
      // Super admin can filter by specific branch
      query = query.eq('branch_id', branchId)
    }

    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    if (targetType) {
      query = query.eq('target_type', targetType)
    }

    if (userRole) {
      query = query.eq('user_role', userRole)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString())
    }

    if (dateTo) {
      // Add 1 day to include the entire end date
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('created_at', endDate.toISOString())
    }

    if (search) {
      // Search in user_name, target_name, or details
      query = query.or(`user_name.ilike.%${search}%,target_name.ilike.%${search}%`)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch logs' },
        { status: 500 }
      )
    }

    // Get total count for pagination (without limit/offset)
    let countQuery = serviceClient
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })

    if (userProfile.role !== 'super_admin') {
      const branchIds = user.branchIds || []
      if (branchIds.length > 0) {
        countQuery = countQuery.in('branch_id', branchIds)
      }
    } else if (branchId) {
      countQuery = countQuery.eq('branch_id', branchId)
    }

    const { count } = await countQuery

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || 0
    })

  } catch (error) {
    console.error('Error in logs API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/logs
 * Delete activity logs (super_admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const userProfile = profile as { role: string; first_name: string; last_name: string }

    // Only super_admin can delete logs
    if (userProfile.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only super admin can delete logs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No log IDs provided' },
        { status: 400 }
      )
    }

    // Use service role client to delete
    const serviceClient = createServiceRoleClient()

    const { error } = await serviceClient
      .from('activity_logs')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error deleting logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete logs' },
        { status: 500 }
      )
    }

    // Log this deletion action
    const ipAddress = getClientIpFromHeaders(request.headers)
    await logLogDeletion({
      userId: user.id,
      userRole: userProfile.role as 'super_admin',
      userName: `${userProfile.first_name} ${userProfile.last_name}`,
      deletedLogIds: ids,
      ipAddress
    })

    return NextResponse.json({
      success: true,
      deleted_count: ids.length
    })

  } catch (error) {
    console.error('Error in logs delete API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
