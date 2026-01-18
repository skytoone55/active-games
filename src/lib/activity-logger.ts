/**
 * Activity Logger - Server-side utility for logging user actions
 *
 * This module provides functions to log user actions to the activity_logs table.
 * It should be used in API routes to track all significant user actions.
 *
 * @example
 * // In an API route
 * import { logActivity } from '@/lib/activity-logger'
 *
 * await logActivity({
 *   userId: user.id,
 *   userRole: user.role,
 *   userName: user.full_name,
 *   actionType: 'booking_created',
 *   targetType: 'booking',
 *   targetId: booking.id,
 *   targetName: booking.reference_code,
 *   branchId: booking.branch_id,
 *   details: { participants: booking.participants_count }
 * })
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { ActionType, TargetType, UserRole, Json, ActivityLogInsert } from '@/lib/supabase/types'

export interface LogActivityParams {
  // Who performed the action
  userId: string | null
  userRole: UserRole
  userName: string

  // What action was performed
  actionType: ActionType

  // What entity was affected (optional for some actions like login/logout)
  targetType?: TargetType
  targetId?: string
  targetName?: string

  // Context
  branchId?: string | null

  // Additional details (JSON)
  details?: Record<string, unknown>

  // IP address (optional)
  ipAddress?: string
}

/**
 * Log a user activity to the database
 * This function should be called from API routes after successful actions
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    userId,
    userRole,
    userName,
    actionType,
    targetType,
    targetId,
    targetName,
    branchId,
    details = {},
    ipAddress,
  } = params

  try {
    const supabase = createServiceRoleClient()

    const logEntry: ActivityLogInsert = {
      user_id: userId,
      user_role: userRole,
      user_name: userName,
      action_type: actionType,
      target_type: targetType || null,
      target_id: targetId || null,
      target_name: targetName || null,
      branch_id: branchId || null,
      details: details as Json,
      ip_address: ipAddress || null,
    }

    // @ts-expect-error - Supabase SSR typing limitation with insert
    const { error } = await supabase.from('activity_logs').insert(logEntry)

    if (error) {
      // Log error but don't throw - we don't want logging failures to break the app
      console.error('[ActivityLogger] Failed to log activity:', error)
    }
  } catch (error) {
    // Fail silently - logging should never break the main flow
    console.error('[ActivityLogger] Error:', error)
  }
}

/**
 * Helper to get the IP address from Next.js request headers
 */
export function getClientIpFromHeaders(headers: Headers): string | undefined {
  // Try different headers in order of reliability
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return undefined
}

/**
 * Convenience function to log booking-related actions
 */
export async function logBookingAction(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  action: 'created' | 'updated' | 'cancelled' | 'deleted'
  bookingId: string
  bookingRef: string
  branchId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  const actionTypeMap: Record<string, ActionType> = {
    created: 'booking_created',
    updated: 'booking_updated',
    cancelled: 'booking_cancelled',
    deleted: 'booking_deleted',
  }

  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: actionTypeMap[params.action],
    targetType: 'booking',
    targetId: params.bookingId,
    targetName: params.bookingRef,
    branchId: params.branchId,
    details: params.details,
    ipAddress: params.ipAddress,
  })
}

/**
 * Convenience function to log order-related actions
 */
export async function logOrderAction(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  action: 'confirmed' | 'cancelled' | 'deleted'
  orderId: string
  orderRef: string
  branchId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  const actionTypeMap: Record<string, ActionType> = {
    confirmed: 'order_confirmed',
    cancelled: 'order_cancelled',
    deleted: 'order_deleted',
  }

  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: actionTypeMap[params.action],
    targetType: 'order',
    targetId: params.orderId,
    targetName: params.orderRef,
    branchId: params.branchId,
    details: params.details,
    ipAddress: params.ipAddress,
  })
}

/**
 * Convenience function to log contact-related actions
 */
export async function logContactAction(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  action: 'created' | 'updated' | 'archived' | 'deleted'
  contactId: string
  contactName: string
  branchId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  const actionTypeMap: Record<string, ActionType> = {
    created: 'contact_created',
    updated: 'contact_updated',
    archived: 'contact_archived',
    deleted: 'contact_deleted',
  }

  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: actionTypeMap[params.action],
    targetType: 'contact',
    targetId: params.contactId,
    targetName: params.contactName,
    branchId: params.branchId,
    details: params.details,
    ipAddress: params.ipAddress,
  })
}

/**
 * Convenience function to log user-related actions
 */
export async function logUserAction(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  action: 'created' | 'updated' | 'deleted' | 'login' | 'logout'
  targetUserId?: string
  targetUserName?: string
  branchId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  const actionTypeMap: Record<string, ActionType> = {
    created: 'user_created',
    updated: 'user_updated',
    deleted: 'user_deleted',
    login: 'user_login',
    logout: 'user_logout',
  }

  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: actionTypeMap[params.action],
    targetType: 'user',
    targetId: params.targetUserId,
    targetName: params.targetUserName,
    branchId: params.branchId,
    details: params.details,
    ipAddress: params.ipAddress,
  })
}

/**
 * Convenience function to log permission changes
 */
export async function logPermissionChange(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  targetRole: UserRole
  resource: string
  changes: Record<string, boolean>
  ipAddress?: string
}): Promise<void> {
  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: 'permission_changed',
    targetType: 'settings',
    targetName: `${params.targetRole}:${params.resource}`,
    details: {
      role: params.targetRole,
      resource: params.resource,
      changes: params.changes,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Convenience function to log log deletions
 */
export async function logLogDeletion(params: {
  userId: string | null
  userRole: UserRole
  userName: string
  deletedLogIds: string[]
  ipAddress?: string
}): Promise<void> {
  await logActivity({
    userId: params.userId,
    userRole: params.userRole,
    userName: params.userName,
    actionType: 'log_deleted',
    targetType: 'log',
    details: {
      deleted_count: params.deletedLogIds.length,
      deleted_ids: params.deletedLogIds,
    },
    ipAddress: params.ipAddress,
  })
}
