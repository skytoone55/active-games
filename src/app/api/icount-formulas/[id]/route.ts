/**
 * API Route pour gérer une formule iCount spécifique
 * GET: Récupérer une formule
 * PUT: Mettre à jour une formule
 * DELETE: Supprimer une formule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import type { ICountFormula } from '../route'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/icount-formulas/[id]
 * Récupérer une formule par ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    const { data: formula, error } = await supabase
      .from('icount_formulas')
      .select('*')
      .eq('id', id)
      .single<ICountFormula>()

    if (error || !formula) {
      return NextResponse.json(
        { success: false, error: 'Formula not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(formula.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: formula,
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
 * PUT /api/icount-formulas/[id]
 * Mettre à jour une formule
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const {
      code,
      name,
      name_he,
      description,
      booking_type,
      game_area,
      min_participants,
      max_participants,
      priority,
      is_active,
      items,
    } = body

    const supabase = createServiceRoleClient()

    // Vérifier que la formule existe
    const { data: existingFormula, error: fetchError } = await supabase
      .from('icount_formulas')
      .select('*')
      .eq('id', id)
      .single<ICountFormula>()

    if (fetchError || !existingFormula) {
      return NextResponse.json(
        { success: false, error: 'Formula not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingFormula.branch_id)) {
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
    if (description !== undefined) updateData.description = description
    if (booking_type !== undefined) updateData.booking_type = booking_type
    if (game_area !== undefined) updateData.game_area = game_area
    if (min_participants !== undefined) updateData.min_participants = min_participants
    if (max_participants !== undefined) updateData.max_participants = max_participants
    if (priority !== undefined) updateData.priority = priority
    if (is_active !== undefined) updateData.is_active = is_active
    if (items !== undefined) updateData.items = Array.isArray(items) ? items : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formula, error } = await (supabase as any)
      .from('icount_formulas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API icount-formulas] Error updating formula:', error)
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
    })
  } catch (error) {
    console.error('[API icount-formulas] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/icount-formulas/[id]
 * Supprimer une formule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Vérifier que la formule existe
    const { data: existingFormula, error: fetchError } = await supabase
      .from('icount_formulas')
      .select('*')
      .eq('id', id)
      .single<ICountFormula>()

    if (fetchError || !existingFormula) {
      return NextResponse.json(
        { success: false, error: 'Formula not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingFormula.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // Hard delete ou soft delete selon le paramètre
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true'

    if (hardDelete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_formulas')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[API icount-formulas] Error deleting formula:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // Soft delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_formulas')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[API icount-formulas] Error deactivating formula:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Formula deleted' : 'Formula deactivated',
    })
  } catch (error) {
    console.error('[API icount-formulas] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
