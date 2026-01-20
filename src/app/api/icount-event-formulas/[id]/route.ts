/**
 * API Route pour gérer une formule EVENT iCount spécifique
 * GET: Récupérer une formule
 * PUT: Mettre à jour une formule
 * DELETE: Supprimer une formule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { ensureEventProductForFormula, updateEventProductPrice, deleteEventProduct } from '@/lib/icount-sync'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/icount-event-formulas/[id]
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
    const { data: formula, error } = await (supabase as any)
      .from('icount_event_formulas')
      .select('*')
      .eq('id', id)
      .single()

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
    console.error('[API icount-event-formulas] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/icount-event-formulas/[id]
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
      name,
      game_type,
      min_participants,
      max_participants,
      price_per_person,
      room_id,
      priority,
      is_active,
    } = body

    const supabase = createServiceRoleClient()

    // Vérifier que la formule existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingFormula, error: fetchError } = await (supabase as any)
      .from('icount_event_formulas')
      .select('*')
      .eq('id', id)
      .single()

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

    // Valider game_type si fourni
    if (game_type && !['LASER', 'ACTIVE', 'BOTH'].includes(game_type)) {
      return NextResponse.json(
        { success: false, error: 'game_type must be LASER, ACTIVE or BOTH' },
        { status: 400 }
      )
    }

    // Check for overlapping ranges if min/max/game_type is changing
    const newMin = min_participants ?? existingFormula.min_participants
    const newMax = max_participants ?? existingFormula.max_participants
    const newGameType = game_type ?? existingFormula.game_type

    if (newMin > newMax) {
      return NextResponse.json(
        { success: false, error: 'min_participants cannot be greater than max_participants' },
        { status: 400 }
      )
    }

    // Only check for overlaps if ranges or game_type changed
    const rangeOrTypeChanged =
      min_participants !== undefined ||
      max_participants !== undefined ||
      game_type !== undefined

    if (rangeOrTypeChanged) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingFormulas } = await (supabase as any)
        .from('icount_event_formulas')
        .select('id, name, game_type, min_participants, max_participants')
        .eq('branch_id', existingFormula.branch_id)
        .eq('is_active', true)
        .neq('id', id) // Exclude current formula

      if (existingFormulas) {
        for (const existing of existingFormulas) {
          // Each game_type creates a separate product, so only check same game_type
          // LASER, ACTIVE, and BOTH are 3 different product types
          if (newGameType === existing.game_type) {
            // Check if participant ranges overlap
            const rangesOverlap = newMin <= existing.max_participants && existing.min_participants <= newMax

            if (rangesOverlap) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Range ${newMin}-${newMax} overlaps with existing ${newGameType} formula "${existing.name}" (${existing.min_participants}-${existing.max_participants})`
                },
                { status: 400 }
              )
            }
          }
        }
      }
    }

    // Construire l'objet de mise à jour
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (game_type !== undefined) updateData.game_type = game_type
    if (min_participants !== undefined) updateData.min_participants = min_participants
    if (max_participants !== undefined) updateData.max_participants = max_participants
    if (price_per_person !== undefined) updateData.price_per_person = price_per_person
    if (room_id !== undefined) updateData.room_id = room_id || null
    if (priority !== undefined) updateData.priority = priority
    if (is_active !== undefined) updateData.is_active = is_active

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formula, error } = await (supabase as any)
      .from('icount_event_formulas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API icount-event-formulas] Error updating formula:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Handle product price sync when price_per_person changes
    let productSyncResult = null
    const priceChanged = price_per_person !== undefined && price_per_person !== existingFormula.price_per_person
    const tierChanged = (
      (game_type !== undefined && game_type !== existingFormula.game_type) ||
      (min_participants !== undefined && min_participants !== existingFormula.min_participants) ||
      (max_participants !== undefined && max_participants !== existingFormula.max_participants)
    )

    if (formula.product_id && priceChanged && !tierChanged) {
      // Just update the price on the existing linked product
      console.log('[API icount-event-formulas] Updating product price:', formula.product_id, price_per_person)
      productSyncResult = await updateEventProductPrice(
        formula.product_id,
        price_per_person,
        formula.branch_id
      )
    } else if (tierChanged || !formula.product_id) {
      // Tier changed or no product linked - need to ensure correct product exists
      console.log('[API icount-event-formulas] Tier changed or no product, ensuring product exists')
      const productResult = await ensureEventProductForFormula({
        id: formula.id,
        branch_id: formula.branch_id,
        name: formula.name,
        game_type: formula.game_type,
        min_participants: formula.min_participants,
        max_participants: formula.max_participants,
        price_per_person: formula.price_per_person,
      })

      if (productResult.success && productResult.productId && productResult.productId !== formula.product_id) {
        // Link new product to formula
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('icount_event_formulas')
          .update({ product_id: productResult.productId })
          .eq('id', formula.id)

        formula.product_id = productResult.productId
        console.log('[API icount-event-formulas] Linked new product:', productResult.productCode)
      }
      productSyncResult = productResult
    }

    return NextResponse.json({
      success: true,
      data: formula,
      productSync: productSyncResult,
    })
  } catch (error) {
    console.error('[API icount-event-formulas] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/icount-event-formulas/[id]
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingFormula, error: fetchError } = await (supabase as any)
      .from('icount_event_formulas')
      .select('*')
      .eq('id', id)
      .single()

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

    // Hard delete ou soft delete
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true'

    // Delete or deactivate the associated product first
    let productDeleted = false
    if (existingFormula.product_id) {
      console.log('[API icount-event-formulas] Deleting associated product:', existingFormula.product_id)
      const deleteResult = await deleteEventProduct(existingFormula.product_id, existingFormula.branch_id)
      productDeleted = deleteResult.success
      if (!deleteResult.success) {
        console.warn('[API icount-event-formulas] Failed to delete product:', deleteResult.error)
      }
    }

    if (hardDelete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_event_formulas')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[API icount-event-formulas] Error deleting formula:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // Soft delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_event_formulas')
        .update({ is_active: false, product_id: null, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[API icount-event-formulas] Error deactivating formula:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Formula deleted' : 'Formula deactivated',
      productDeleted,
    })
  } catch (error) {
    console.error('[API icount-event-formulas] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
