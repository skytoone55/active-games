/**
 * API Route pour gérer les produits iCount
 * GET: Liste des produits avec filtres
 * POST: Créer un nouveau produit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { syncProductToICountBackground } from '@/lib/icount-sync'

export interface ICountProduct {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  unit_price: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * GET /api/icount-products
 * Liste les produits pour une branche
 */
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId') || searchParams.get('branch_id')
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
      .from('icount_products')
      .select('*')
      .eq('branch_id', branchId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: products, error } = await query.returns<ICountProduct[]>()

    if (error) {
      console.error('[API icount-products] Error fetching products:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: products || [],
    })
  } catch (error) {
    console.error('[API icount-products] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/icount-products
 * Créer un nouveau produit
 */
export async function POST(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const body = await request.json()
    const { branch_id, code, name, name_he, name_en, unit_price, sort_order } = body

    if (!branch_id || !code || !name || unit_price === undefined) {
      return NextResponse.json(
        { success: false, error: 'branch_id, code, name, and unit_price are required' },
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
    const { data: product, error } = await (supabase as any)
      .from('icount_products')
      .insert({
        branch_id,
        code,
        name,
        name_he: name_he || null,
        name_en: name_en || null,
        unit_price: parseFloat(unit_price),
        sort_order: sort_order || 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[API icount-products] Error creating product:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Product code already exists for this branch' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Sync to iCount in background (non-blocking)
    syncProductToICountBackground(product)

    return NextResponse.json({
      success: true,
      data: product,
    }, { status: 201 })
  } catch (error) {
    console.error('[API icount-products] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
