/**
 * API Route pour gérer une salle iCount spécifique
 * GET: Récupérer une salle
 * PUT: Mettre à jour une salle
 * DELETE: Supprimer une salle
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import type { ICountRoom } from '../route'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/icount-rooms/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: room, error } = await (supabase as any)
      .from('icount_rooms')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(room.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: room,
    })
  } catch (error) {
    console.error('[API icount-rooms] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/icount-rooms/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const { code, name, name_he, name_en, price, sort_order, is_active } = body

    const supabase = createServiceRoleClient()

    // Vérifier que la salle existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRoom, error: fetchError } = await (supabase as any)
      .from('icount_rooms')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRoom) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingRoom.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (name_he !== undefined) updateData.name_he = name_he
    if (name_en !== undefined) updateData.name_en = name_en
    if (price !== undefined) updateData.price = price
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (is_active !== undefined) updateData.is_active = is_active

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: room, error } = await (supabase as any)
      .from('icount_rooms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API icount-rooms] Error updating room:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Room code already exists for this branch' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: room,
    })
  } catch (error) {
    console.error('[API icount-rooms] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/icount-rooms/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Vérifier que la salle existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRoom, error: fetchError } = await (supabase as any)
      .from('icount_rooms')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRoom) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingRoom.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // Hard delete ou soft delete
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true'

    if (hardDelete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_rooms')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[API icount-rooms] Error deleting room:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // Soft delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_rooms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[API icount-rooms] Error deactivating room:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Room deleted' : 'Room deactivated',
    })
  } catch (error) {
    console.error('[API icount-rooms] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
