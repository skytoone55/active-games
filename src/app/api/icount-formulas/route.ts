/**
 * API Route pour gérer les formules iCount
 * GET: Liste des formules avec filtres
 * POST: Créer une nouvelle formule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export interface FormulaItem {
  product_code: string
  quantity: number | 'participants'
}

export interface ICountFormula {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  description: string | null
  booking_type: 'EVENT' | 'GAME'
  game_area: 'LASER' | 'ACTIVE' | 'BOTH' | null
  min_participants: number
  max_participants: number
  priority: number
  is_active: boolean
  items: FormulaItem[]
  created_at: string
  updated_at: string
}

/**
 * GET /api/icount-formulas
 * Liste les formules pour une branche
 */
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId') || searchParams.get('branch_id')
    const bookingType = searchParams.get('booking_type')
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

    let query = supabase
      .from('icount_formulas')
      .select('*')
      .eq('branch_id', branchId)
      .order('priority', { ascending: false })
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (bookingType) {
      query = query.eq('booking_type', bookingType)
    }

    const { data: formulas, error } = await query.returns<ICountFormula[]>()

    if (error) {
      console.error('[API icount-formulas] Error fetching formulas:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: formulas || [],
    })
  } catch (error) {
    console.error('[API icount-formulas] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/icount-formulas
 * Créer une nouvelle formule
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
      description,
      booking_type,
      game_area,
      min_participants,
      max_participants,
      priority,
      items,
    } = body

    if (!branch_id || !code || !name || !booking_type || !items) {
      return NextResponse.json(
        { success: false, error: 'branch_id, code, name, booking_type, and items are required' },
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
    const { data: formula, error } = await (supabase as any)
      .from('icount_formulas')
      .insert({
        branch_id,
        code,
        name,
        name_he: name_he || null,
        description: description || null,
        booking_type,
        game_area: game_area || null,
        min_participants: min_participants || 1,
        max_participants: max_participants || 999,
        priority: priority || 0,
        is_active: true,
        items: Array.isArray(items) ? items : [],
      })
      .select()
      .single()

    if (error) {
      console.error('[API icount-formulas] Error creating formula:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Formula code already exists for this branch' },
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
      data: formula,
    }, { status: 201 })
  } catch (error) {
    console.error('[API icount-formulas] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
