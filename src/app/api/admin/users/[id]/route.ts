import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import type { UserRole } from '@/lib/supabase/types'

/**
 * PUT /api/admin/users/[id]
 * Modifie un utilisateur existant
 * 
 * Body: {
 *   first_name?: string
 *   last_name?: string
 *   phone?: string
 *   role?: 'branch_admin' | 'agent'
 *   branch_ids?: string[]
 * }
 * 
 * Permissions:
 * - super_admin: Peut modifier tous les utilisateurs
 * - branch_admin: Peut modifier uniquement les utilisateurs de ses branches (sauf lui-même)
 * - Ne peut pas modifier son propre rôle
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer le profil de l'utilisateur connecté
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profil introuvable' },
        { status: 404 }
      )
    }

    // Vérifier les permissions
    if (profile.role !== 'super_admin' && profile.role !== 'branch_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Empêcher la modification de son propre rôle
    if (targetUserId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas modifier votre propre rôle' },
        { status: 403 }
      )
    }

    // Récupérer l'utilisateur cible
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Si branch_admin, vérifier qu'il gère cet utilisateur
    if (profile.role === 'branch_admin') {
      const { data: adminBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      const { data: targetBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', targetUserId)

      const adminBranchIds = (adminBranches || []).map(b => b.branch_id)
      const targetBranchIds = (targetBranches || []).map(b => b.branch_id)

      const hasCommonBranch = targetBranchIds.some(id => adminBranchIds.includes(id))

      if (!hasCommonBranch) {
        return NextResponse.json(
          { success: false, error: 'Vous ne pouvez modifier que les utilisateurs de vos branches' },
          { status: 403 }
        )
      }
    }

    // Parser le body
    const body = await request.json()
    const { first_name, last_name, phone, role, branch_ids } = body

    // Préparer les updates
    const updates: any = {}

    if (first_name !== undefined) {
      if (!first_name.trim()) {
        return NextResponse.json(
          { success: false, error: 'Le prénom ne peut pas être vide' },
          { status: 400 }
        )
      }
      updates.first_name = first_name.trim()
    }

    if (last_name !== undefined) {
      updates.last_name = last_name.trim()
    }

    if (phone !== undefined) {
      if (!validateIsraeliPhone(phone)) {
        return NextResponse.json(
          { success: false, error: 'Format téléphone invalide (05XXXXXXXX)' },
          { status: 400 }
        )
      }
      updates.phone = formatIsraeliPhone(phone)
    }

    if (role !== undefined) {
      const validRoles: UserRole[] = ['branch_admin', 'agent']
      if (!validRoles.includes(role as UserRole)) {
        return NextResponse.json(
          { success: false, error: 'Rôle invalide' },
          { status: 400 }
        )
      }

      // Si branch_admin, ne peut modifier qu'en agent
      if (profile.role === 'branch_admin' && role !== 'agent') {
        return NextResponse.json(
          { success: false, error: 'Vous ne pouvez assigner que le rôle agent' },
          { status: 403 }
        )
      }

      updates.role = role as UserRole
    }

    // Mettre à jour le profil
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', targetUserId)

      if (updateError) {
        console.error('Error updating profile:', updateError)
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        )
      }
    }

    // Mettre à jour les branches si fourni
    if (branch_ids !== undefined && Array.isArray(branch_ids)) {
      if (branch_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Au moins une branche doit être assignée' },
          { status: 400 }
        )
      }

      // Si branch_admin, vérifier qu'il n'assigne que ses branches
      if (profile.role === 'branch_admin') {
        const { data: adminBranches } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', user.id)

        const adminBranchIds = (adminBranches || []).map(b => b.branch_id)
        const invalidBranches = branch_ids.filter(id => !adminBranchIds.includes(id))

        if (invalidBranches.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Vous ne pouvez assigner que vos propres branches' },
            { status: 403 }
          )
        }
      }

      // Supprimer les anciennes associations
      await supabase
        .from('user_branches')
        .delete()
        .eq('user_id', targetUserId)

      // Créer les nouvelles associations
      const branchAssignments = branch_ids.map(branchId => ({
        user_id: targetUserId,
        branch_id: branchId,
      }))

      const { error: branchAssignError } = await supabase
        .from('user_branches')
        .insert(branchAssignments)

      if (branchAssignError) {
        console.error('Error assigning branches:', branchAssignError)
        return NextResponse.json(
          { success: false, error: 'Erreur lors de l\'assignation des branches' },
          { status: 500 }
        )
      }
    }

    // Récupérer l'utilisateur mis à jour
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    const { data: branches } = await supabase
      .from('user_branches')
      .select('branch_id, branches(*)')
      .eq('user_id', targetUserId)

    const userBranches = (branches || []).map((ub: any) => ub.branches).filter(Boolean)

    return NextResponse.json(
      {
        success: true,
        user: {
          ...updatedProfile,
          branches: userBranches,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Supprime un utilisateur
 * 
 * Permissions:
 * - super_admin: Peut supprimer tous les utilisateurs (sauf lui-même)
 * - branch_admin: Peut supprimer uniquement les utilisateurs de ses branches (sauf lui-même)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params
    const supabase = await createClient()
    const supabaseAdmin = createServiceRoleClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Récupérer le profil de l'utilisateur connecté
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profil introuvable' },
        { status: 404 }
      )
    }

    // Vérifier les permissions
    if (profile.role !== 'super_admin' && profile.role !== 'branch_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Empêcher la suppression de soi-même
    if (targetUserId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 403 }
      )
    }

    // Vérifier que l'utilisateur existe
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Si branch_admin, vérifier qu'il gère cet utilisateur
    if (profile.role === 'branch_admin') {
      const { data: adminBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      const { data: targetBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', targetUserId)

      const adminBranchIds = (adminBranches || []).map(b => b.branch_id)
      const targetBranchIds = (targetBranches || []).map(b => b.branch_id)

      const hasCommonBranch = targetBranchIds.some(id => adminBranchIds.includes(id))

      if (!hasCommonBranch) {
        return NextResponse.json(
          { success: false, error: 'Vous ne pouvez supprimer que les utilisateurs de vos branches' },
          { status: 403 }
        )
      }
    }

    // Supprimer les associations user_branches
    await supabase
      .from('user_branches')
      .delete()
      .eq('user_id', targetUserId)

    // Supprimer le profil
    await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId)

    // Supprimer le compte Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

    if (deleteAuthError) {
      console.error('Error deleting user from Auth:', deleteAuthError)
      // Ne pas retourner d'erreur car le profil est déjà supprimé
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Utilisateur supprimé avec succès',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
