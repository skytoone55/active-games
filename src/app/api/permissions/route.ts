/**
 * API Permissions - Role Permissions Management
 *
 * GET /api/permissions - List all role permissions
 * PATCH /api/permissions - Update a permission (super_admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { logPermissionChange, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { UserRole, ResourceType } from '@/lib/supabase/types'

/**
 * GET /api/permissions
 * List role permissions
 * - Super admin: returns all permissions (for admin page)
 * - Other users: returns only permissions for their role (for UI visibility)
 */
export async function GET() {
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const userProfile = profile as { role: string }

    // Use service role client to fetch permissions
    const serviceClient = createServiceRoleClient()

    // Super admin gets all permissions (for the admin permissions page)
    // Other users get only their role's permissions (for UI visibility)
    let query = serviceClient
      .from('role_permissions')
      .select('*')
      .order('role')
      .order('resource')

    // Non-super_admin users only see their own role's permissions
    if (userProfile.role !== 'super_admin') {
      query = query.eq('role', userProfile.role)
    }

    const { data: permissions, error } = await query

    if (error) {
      console.error('Error fetching permissions:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch permissions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      permissions: permissions || []
    })

  } catch (error) {
    console.error('Error in permissions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/permissions
 * Update a permission (super_admin only)
 */
export async function PATCH(request: NextRequest) {
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

    // Only super_admin can update permissions
    if (userProfile.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only super admin can update permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, can_view, can_create, can_edit, can_delete } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Permission ID is required' },
        { status: 400 }
      )
    }

    // Use service role client to update
    const serviceClient = createServiceRoleClient()

    // Get current permission to log the change
    const { data: currentPerm, error: permError } = await serviceClient
      .from('role_permissions')
      .select('*')
      .eq('id', id)
      .single()

    if (permError || !currentPerm) {
      return NextResponse.json(
        { success: false, error: 'Permission not found' },
        { status: 404 }
      )
    }

    const currentPermission = currentPerm as {
      id: string
      role: string
      resource: string
      can_view: boolean
      can_create: boolean
      can_edit: boolean
      can_delete: boolean
    }

    // Build update object
    const updates: Record<string, boolean> = {}
    const changes: Record<string, boolean> = {}

    if (typeof can_view === 'boolean' && can_view !== currentPermission.can_view) {
      updates.can_view = can_view
      changes.can_view = can_view
    }
    if (typeof can_create === 'boolean' && can_create !== currentPermission.can_create) {
      updates.can_create = can_create
      changes.can_create = can_create
    }
    if (typeof can_edit === 'boolean' && can_edit !== currentPermission.can_edit) {
      updates.can_edit = can_edit
      changes.can_edit = can_edit
    }
    if (typeof can_delete === 'boolean' && can_delete !== currentPermission.can_delete) {
      updates.can_delete = can_delete
      changes.can_delete = can_delete
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to apply'
      })
    }

    const { error } = await (serviceClient as any)
      .from('role_permissions')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Error updating permission:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update permission' },
        { status: 500 }
      )
    }

    // Log the permission change
    const ipAddress = getClientIpFromHeaders(request.headers)
    await logPermissionChange({
      userId: user.id,
      userRole: userProfile.role as UserRole,
      userName: `${userProfile.first_name} ${userProfile.last_name}`,
      targetRole: currentPermission.role as UserRole,
      resource: currentPermission.resource as ResourceType,
      changes,
      ipAddress
    })

    return NextResponse.json({
      success: true,
      updated: true
    })

  } catch (error) {
    console.error('Error in permissions update API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
