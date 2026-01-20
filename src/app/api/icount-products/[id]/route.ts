/**
 * API Route pour gérer un produit iCount spécifique
 * GET: Récupérer un produit
 * PUT: Mettre à jour un produit
 * DELETE: Supprimer un produit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { syncProductToICountBackground } from '@/lib/icount-sync'
import type { ICountProduct } from '../route'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/icount-products/[id]
 * Récupérer un produit par ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    const { data: product, error } = await supabase
      .from('icount_products')
      .select('*')
      .eq('id', id)
      .single<ICountProduct>()

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(product.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: product,
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
 * PUT /api/icount-products/[id]
 * Mettre à jour un produit
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const { code, name, name_he, name_en, unit_price, is_active, sort_order } = body

    const supabase = createServiceRoleClient()

    // Vérifier que le produit existe
    const { data: existingProduct, error: fetchError } = await supabase
      .from('icount_products')
      .select('*')
      .eq('id', id)
      .single<ICountProduct>()

    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingProduct.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // Construire l'objet de mise à jour
    const updateData: Partial<ICountProduct> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    }

    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (name_he !== undefined) updateData.name_he = name_he
    if (name_en !== undefined) updateData.name_en = name_en
    if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price)
    if (is_active !== undefined) updateData.is_active = is_active
    if (sort_order !== undefined) updateData.sort_order = sort_order

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: product, error } = await (supabase as any)
      .from('icount_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API icount-products] Error updating product:', error)
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
    })
  } catch (error) {
    console.error('[API icount-products] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/icount-products/[id]
 * Supprimer un produit (soft delete via is_active = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('settings', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Vérifier que le produit existe
    const { data: existingProduct, error: fetchError } = await supabase
      .from('icount_products')
      .select('*')
      .eq('id', id)
      .single<ICountProduct>()

    if (fetchError || !existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(existingProduct.branch_id)) {
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
        .from('icount_products')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[API icount-products] Error deleting product:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // Soft delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('icount_products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[API icount-products] Error deactivating product:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Product deleted' : 'Product deactivated',
    })
  } catch (error) {
    console.error('[API icount-products] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
