/**
 * API Route: Vérification de cohérence des prix
 * GET /api/price-check
 *
 * Vérifie que toutes les données de prix sont cohérentes :
 * - formula.price_per_person == product.unit_price (pour EVENT)
 * - Chaque formule a un product_id valide
 * - Produits GAME (laser_*, active_*) existent pour chaque branche
 * - Salles ont des produits correspondants
 * - Uniformité des prix entre branches (sauf Glilot = laser only)
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

interface PriceIssue {
  severity: 'error' | 'warning' | 'info'
  branch: string
  category: string
  message: string
  details?: Record<string, unknown>
}

export async function GET() {
  // Seuls les admins peuvent voir le diagnostic
  const { success, errorResponse } = await verifyApiPermission('settings', 'view')
  if (!success) {
    return errorResponse
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any
  const issues: PriceIssue[] = []

  // 1. Charger toutes les données
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, slug')
    .order('name')

  const { data: products } = await supabase
    .from('icount_products')
    .select('*')
    .eq('is_active', true)
    .order('code')

  const { data: formulas } = await supabase
    .from('icount_event_formulas')
    .select('*')
    .eq('is_active', true)
    .order('game_type, min_participants')

  const { data: rooms } = await supabase
    .from('icount_rooms')
    .select('*')
    .eq('is_active', true)

  if (!branches || !products || !formulas || !rooms) {
    return NextResponse.json({
      success: false,
      error: 'Impossible de charger les données'
    }, { status: 500 })
  }

  // 2. Vérifications par branche
  for (const branch of branches) {
    const branchProducts = products.filter((p: { branch_id: string }) => p.branch_id === branch.id)
    const branchFormulas = formulas.filter((f: { branch_id: string }) => f.branch_id === branch.id)
    const branchRooms = rooms.filter((r: { branch_id: string }) => r.branch_id === branch.id)
    const isGlilot = branch.slug === 'glilot'

    // === CHECK: Produits GAME laser existent ===
    const requiredLaserCodes = ['laser_1', 'laser_2', 'laser_3', 'laser_4']
    for (const code of requiredLaserCodes) {
      const product = branchProducts.find((p: { code: string }) => p.code === code)
      if (!product) {
        issues.push({
          severity: 'error',
          branch: branch.name,
          category: 'Produits GAME',
          message: `Produit "${code}" manquant`,
        })
      }
    }

    // === CHECK: Produits GAME active existent (sauf Glilot) ===
    if (!isGlilot) {
      const requiredActiveCodes = ['active_30', 'active_60', 'active_90', 'active_120']
      for (const code of requiredActiveCodes) {
        const product = branchProducts.find((p: { code: string }) => p.code === code)
        if (!product) {
          issues.push({
            severity: 'error',
            branch: branch.name,
            category: 'Produits GAME',
            message: `Produit "${code}" manquant`,
          })
        }
      }
    }

    // === CHECK: Formules EVENT existent ===
    if (branchFormulas.length === 0) {
      issues.push({
        severity: 'error',
        branch: branch.name,
        category: 'Formules EVENT',
        message: 'Aucune formule EVENT configurée',
      })
    }

    // === CHECK: Chaque formule a un product_id valide et prix cohérent ===
    for (const formula of branchFormulas) {
      // product_id existe ?
      if (!formula.product_id) {
        issues.push({
          severity: 'error',
          branch: branch.name,
          category: 'Formules EVENT',
          message: `Formule "${formula.name}" n'a pas de produit lié (product_id null)`,
        })
        continue
      }

      // Produit existe et est actif ?
      const linkedProduct = branchProducts.find((p: { id: string }) => p.id === formula.product_id)
      if (!linkedProduct) {
        issues.push({
          severity: 'error',
          branch: branch.name,
          category: 'Formules EVENT',
          message: `Formule "${formula.name}" → produit introuvable (id: ${formula.product_id})`,
        })
        continue
      }

      // Prix cohérent ?
      const formulaPrice = parseFloat(formula.price_per_person)
      const productPrice = parseFloat(linkedProduct.unit_price)
      if (formulaPrice !== productPrice) {
        issues.push({
          severity: 'error',
          branch: branch.name,
          category: 'Cohérence prix',
          message: `"${formula.name}": formule=${formulaPrice}₪ vs produit=${productPrice}₪`,
          details: {
            formula_id: formula.id,
            product_id: linkedProduct.id,
            product_code: linkedProduct.code,
            formula_price: formulaPrice,
            product_price: productPrice,
          }
        })
      }
    }

    // === CHECK: Glilot n'a pas de formules ACTIVE ou BOTH ===
    if (isGlilot) {
      const nonLaserFormulas = branchFormulas.filter(
        (f: { game_type: string }) => f.game_type !== 'LASER'
      )
      if (nonLaserFormulas.length > 0) {
        issues.push({
          severity: 'error',
          branch: branch.name,
          category: 'Glilot laser-only',
          message: `${nonLaserFormulas.length} formule(s) non-laser active(s) (Glilot = laser uniquement)`,
        })
      }

      const nonLaserProducts = branchProducts.filter(
        (p: { code: string }) =>
          (p.code.startsWith('active_') || p.code.startsWith('event_active_') || p.code.startsWith('event_both_'))
      )
      if (nonLaserProducts.length > 0) {
        issues.push({
          severity: 'warning',
          branch: branch.name,
          category: 'Glilot laser-only',
          message: `${nonLaserProducts.length} produit(s) non-laser encore actif(s)`,
        })
      }
    }

    // === CHECK: Salles ont un prix cohérent ===
    for (const room of branchRooms) {
      const roomPrice = parseFloat(room.price)
      if (roomPrice <= 0) {
        issues.push({
          severity: 'warning',
          branch: branch.name,
          category: 'Salles',
          message: `Salle "${room.name}" a un prix de 0₪`,
        })
      }
    }
  }

  // 3. Vérifications inter-branches (uniformité Rishon ↔ Petah Tikva)
  const rishonProducts = products.filter(
    (p: { branch_id: string }) => p.branch_id === branches.find((b: { slug: string }) => b.slug === 'rishon-lezion')?.id
  )
  const ptProducts = products.filter(
    (p: { branch_id: string }) => p.branch_id === branches.find((b: { slug: string }) => b.slug === 'petah-tikva')?.id
  )

  // Comparer les prix des produits GAME entre Rishon et Petah Tikva
  const gameCodes = ['laser_1', 'laser_2', 'laser_3', 'laser_4', 'active_30', 'active_60', 'active_90', 'active_120']
  for (const code of gameCodes) {
    const rishonProduct = rishonProducts.find((p: { code: string }) => p.code === code)
    const ptProduct = ptProducts.find((p: { code: string }) => p.code === code)

    if (rishonProduct && ptProduct) {
      const rishonPrice = parseFloat(rishonProduct.unit_price)
      const ptPrice = parseFloat(ptProduct.unit_price)
      if (rishonPrice !== ptPrice) {
        issues.push({
          severity: 'warning',
          branch: 'Rishon ↔ Petah Tikva',
          category: 'Uniformité prix',
          message: `"${code}": Rishon=${rishonPrice}₪ vs PT=${ptPrice}₪`,
        })
      }
    }
  }

  // Comparer les formules EVENT entre Rishon et Petah Tikva
  const rishonFormulas = formulas.filter(
    (f: { branch_id: string }) => f.branch_id === branches.find((b: { slug: string }) => b.slug === 'rishon-lezion')?.id
  )
  const ptFormulas = formulas.filter(
    (f: { branch_id: string }) => f.branch_id === branches.find((b: { slug: string }) => b.slug === 'petah-tikva')?.id
  )

  for (const rf of rishonFormulas) {
    const matchingPt = ptFormulas.find(
      (pf: { game_type: string; min_participants: number; max_participants: number }) =>
        pf.game_type === rf.game_type &&
        pf.min_participants === rf.min_participants &&
        pf.max_participants === rf.max_participants
    )

    if (!matchingPt) {
      issues.push({
        severity: 'warning',
        branch: 'Petah Tikva',
        category: 'Uniformité formules',
        message: `Formule "${rf.name}" existe à Rishon mais pas à Petah Tikva`,
      })
    } else {
      const rishonPrice = parseFloat(rf.price_per_person)
      const ptPrice = parseFloat(matchingPt.price_per_person)
      if (rishonPrice !== ptPrice) {
        issues.push({
          severity: 'warning',
          branch: 'Rishon ↔ Petah Tikva',
          category: 'Uniformité formules',
          message: `"${rf.name}": Rishon=${rishonPrice}₪ vs PT=${ptPrice}₪`,
        })
      }
    }
  }

  // 4. Résumé
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length

  return NextResponse.json({
    success: true,
    status: errorCount > 0 ? 'errors' : warningCount > 0 ? 'warnings' : 'ok',
    summary: {
      errors: errorCount,
      warnings: warningCount,
      total_issues: issues.length,
      branches_checked: branches.length,
      products_checked: products.length,
      formulas_checked: formulas.length,
      rooms_checked: rooms.length,
    },
    issues,
    checked_at: new Date().toISOString(),
  })
}
