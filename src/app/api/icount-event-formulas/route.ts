/**
 * API Route pour gérer les formules EVENT iCount
 * GET: Liste des formules
 * POST: Créer une formule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { ensureEventProductForFormula } from '@/lib/icount-sync'

export interface ICountEventFormula {
  id: string
  branch_id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
  room_id: string | null
  is_active: boolean
  priority: number
  product_id: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/icount-event-formulas
 * Liste des formules EVENT pour une branche
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
    const gameType = searchParams.get('gameType') // Filter by game_type

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
      .from('icount_event_formulas')
      .select('*')
      .eq('branch_id', branchId)
      .order('priority', { ascending: false })
      .order('min_participants', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (gameType) {
      query = query.eq('game_type', gameType)
    }

    const { data: formulas, error } = await query

    if (error) {
      console.error('[API icount-event-formulas] Error fetching formulas:', error)
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
    console.error('[API icount-event-formulas] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/icount-event-formulas
 * Créer une nouvelle formule EVENT
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
      name,
      game_type,
      min_participants,
      max_participants,
      price_per_person,
      room_id,
      priority,
      is_active,
    } = body

    if (!branch_id || !name || !game_type || price_per_person === undefined) {
      return NextResponse.json(
        { success: false, error: 'branch_id, name, game_type and price_per_person are required' },
        { status: 400 }
      )
    }

    // Valider game_type
    if (!['LASER', 'ACTIVE', 'BOTH'].includes(game_type)) {
      return NextResponse.json(
        { success: false, error: 'game_type must be LASER, ACTIVE or BOTH' },
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

    // Validate participant ranges don't overlap with existing formulas
    const newMin = min_participants ?? 1
    const newMax = max_participants ?? 999

    if (newMin > newMax) {
      return NextResponse.json(
        { success: false, error: 'min_participants cannot be greater than max_participants' },
        { status: 400 }
      )
    }

    // Check for overlapping ranges with same game_type (or BOTH)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingFormulas } = await (supabase as any)
      .from('icount_event_formulas')
      .select('id, name, game_type, min_participants, max_participants')
      .eq('branch_id', branch_id)
      .eq('is_active', true)

    if (existingFormulas) {
      for (const existing of existingFormulas) {
        // Each game_type creates a separate product, so only check same game_type
        // LASER, ACTIVE, and BOTH are 3 different product types
        if (game_type === existing.game_type) {
          // Check if participant ranges overlap
          // Two ranges [a,b] and [c,d] overlap if a <= d AND c <= b
          const rangesOverlap = newMin <= existing.max_participants && existing.min_participants <= newMax

          if (rangesOverlap) {
            return NextResponse.json(
              {
                success: false,
                error: `Range ${newMin}-${newMax} overlaps with existing ${game_type} formula "${existing.name}" (${existing.min_participants}-${existing.max_participants})`
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: formula, error } = await (supabase as any)
      .from('icount_event_formulas')
      .insert({
        branch_id,
        name,
        game_type,
        min_participants: min_participants ?? 1,
        max_participants: max_participants ?? 999,
        price_per_person,
        room_id: room_id || null,
        priority: priority ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error('[API icount-event-formulas] Error creating formula:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Auto-create/link product for this formula
    const productResult = await ensureEventProductForFormula({
      id: formula.id,
      branch_id: formula.branch_id,
      name: formula.name,
      game_type: formula.game_type,
      min_participants: formula.min_participants,
      max_participants: formula.max_participants,
      price_per_person: formula.price_per_person,
    })

    if (productResult.success && productResult.productId) {
      // Link product to formula
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: linkError } = await (supabase as any)
        .from('icount_event_formulas')
        .update({ product_id: productResult.productId })
        .eq('id', formula.id)

      if (linkError) {
        console.warn('[API icount-event-formulas] Failed to link product to formula:', linkError)
      } else {
        formula.product_id = productResult.productId
        console.log('[API icount-event-formulas] Linked product:', productResult.productCode, 'to formula:', formula.id)
      }
    }

    return NextResponse.json({
      success: true,
      data: formula,
      product: productResult.success ? {
        id: productResult.productId,
        code: productResult.productCode,
        created: productResult.created,
      } : null,
    })
  } catch (error) {
    console.error('[API icount-event-formulas] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
