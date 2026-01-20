/**
 * API Route pour synchroniser tous les produits avec iCount
 * POST: Synchronise tous les produits actifs de la branche avec iCount
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiPermission } from '@/lib/permissions'
import { syncAllProductsToICount } from '@/lib/icount-sync'

/**
 * POST /api/icount-products/sync
 * Synchronise tous les produits de la branche avec iCount
 */
export async function POST(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const body = await request.json()
    const { branch_id } = body

    if (!branch_id) {
      return NextResponse.json(
        { success: false, error: 'branch_id is required' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    console.log('[API icount-products/sync] Syncing all products for branch:', branch_id)

    // Sync all products
    const result = await syncAllProductsToICount(branch_id)

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    console.error('[API icount-products/sync] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
