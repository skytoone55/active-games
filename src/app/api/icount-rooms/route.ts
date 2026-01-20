/**
 * API Route pour gérer les salles iCount
 * GET: Liste des salles
 * POST: Créer une salle
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export interface ICountRoom {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  price: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * GET /api/icount-rooms
 * Liste des salles pour une branche
 */
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('icount_rooms')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: rooms, error } = await query

    if (error) {
      console.error('[API icount-rooms] Error fetching rooms:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: rooms || [],
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
 * POST /api/icount-rooms
 * Créer une nouvelle salle
 */
export async function POST(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const body = await request.json()
    const {
      branch_id,
      code,
      name,
      name_he,
      name_en,
      price,
      sort_order,
      is_active,
    } = body

    if (!branch_id || !code || !name) {
      return NextResponse.json(
        { success: false, error: 'branch_id, code and name are required' },
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

    const supabase = createServiceRoleClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: room, error } = await (supabase as any)
      .from('icount_rooms')
      .insert({
        branch_id,
        code,
        name,
        name_he: name_he || null,
        name_en: name_en || null,
        price: price ?? 0,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('[API icount-rooms] Error creating room:', error)
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
    console.error('[API icount-rooms] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
