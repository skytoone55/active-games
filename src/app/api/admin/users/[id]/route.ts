import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import { logUserAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { UserRole, Profile, ProfileUpdate, Role } from '@/lib/supabase/types'

/**
 * Helper: Récupère le niveau hiérarchique d'un utilisateur
 * Retourne le level du rôle (1 = plus haut, 10 = plus bas)
 */
async function getUserLevel(serviceClient: ReturnType<typeof createServiceRoleClient>, userId: string): Promise<{ level: number; role: Role | null }> {
  // Récupérer le profil avec role_id
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role, role_id')
    .eq('id', userId)
    .single()

  if (!profile) {
    return { level: 10, role: null }
  }

  // Récupérer le rôle par role_id ou par name
  let roleData: Role | null = null

  if (profile.role_id) {
    const { data } = await serviceClient
      .from('roles')
      .select('*')
      .eq('id', profile.role_id)
      .single()
    roleData = data
  }

  if (!roleData && profile.role) {
    const { data } = await serviceClient
      .from('roles')
      .select('*')
      .eq('name', profile.role)
      .single()
    roleData = data
  }

  return {
    level: roleData?.level ?? 10,
    role: roleData
  }
}

/**
 * Helper: Vérifie si un utilisateur peut gérer un rôle cible
 * Règle: userLevel doit être < targetLevel (niveau plus bas = plus de pouvoir)
 */
function canManageLevel(userLevel: number, targetLevel: number): boolean {
  return userLevel < targetLevel
}

/**
 * PUT /api/admin/users/[id]
 * Modifie un utilisateur existant
 *
 * Body: {
 *   first_name?: string
 *   last_name?: string
 *   phone?: string
 *   email?: string
 *   password?: string
 *   role_id?: string (UUID du rôle)
 *   branch_ids?: string[]
 * }
 *
 * Permissions (basées sur hiérarchie dynamique):
 * - Un utilisateur peut modifier des utilisateurs avec un rôle de level > son level
 * - Ne peut pas modifier son propre rôle ou branches
 * - Restriction par branches pour level >= 5
 */
export async function PUT(
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
      .single<Profile>()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profil introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le niveau hiérarchique de l'utilisateur connecté
    const { level: userLevel } = await getUserLevel(supabaseAdmin, user.id)
    const userRole = profile.role as UserRole

    // Vérifier que l'utilisateur a le droit de modifier des utilisateurs (level < 8)
    if (userLevel >= 8) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Parser le body pour vérifier les modifications demandées
    const body = await request.json()
    const { first_name, last_name, phone, email, password, role_id, role, branch_ids } = body

    // Si l'utilisateur modifie son propre compte
    const isSelfEdit = targetUserId === user.id
    if (isSelfEdit) {
      // Autoriser uniquement la modification des infos de contact (prénom, nom, téléphone)
      // Interdire la modification du rôle ou des branches
      if (role_id !== undefined || role !== undefined || branch_ids !== undefined) {
        return NextResponse.json(
          { success: false, error: 'Vous ne pouvez pas modifier votre propre rôle ou vos branches' },
          { status: 403 }
        )
      }
    }

    // Récupérer l'utilisateur cible
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single<Profile>()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le niveau hiérarchique de l'utilisateur cible
    const { level: targetLevel } = await getUserLevel(supabaseAdmin, targetUserId)

    // Vérifier la hiérarchie: l'utilisateur ne peut modifier que des utilisateurs de niveau > son niveau
    if (!isSelfEdit && !canManageLevel(userLevel, targetLevel)) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez modifier que des utilisateurs avec un niveau hiérarchique inférieur au vôtre' },
        { status: 403 }
      )
    }

    // Si level >= 5 et pas soi-même, vérifier qu'il gère cet utilisateur via les branches
    if (userLevel >= 5 && !isSelfEdit) {
      const { data: adminBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)
        .returns<Array<{ branch_id: string }>>()

      const { data: targetBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', targetUserId)
        .returns<Array<{ branch_id: string }>>()

      const adminBranchIds = (adminBranches || []).map((b: { branch_id: string }) => b.branch_id)
      const targetBranchIds = (targetBranches || []).map((b: { branch_id: string }) => b.branch_id)

      const hasCommonBranch = targetBranchIds.some(id => adminBranchIds.includes(id))

      if (!hasCommonBranch) {
        return NextResponse.json(
          { success: false, error: 'Vous ne pouvez modifier que les utilisateurs de vos branches' },
          { status: 403 }
        )
      }
    }

    // Préparer les updates
    const updates: ProfileUpdate = {}

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

    // Gérer le changement de rôle (par role_id ou role pour rétrocompatibilité)
    if (role_id !== undefined || role !== undefined) {
      // Récupérer le nouveau rôle cible
      let newTargetRole: Role | null = null

      if (role_id) {
        const { data } = await supabaseAdmin
          .from('roles')
          .select('*')
          .eq('id', role_id)
          .single()
        newTargetRole = data
      } else if (role) {
        // Rétrocompatibilité: chercher par nom
        const { data } = await supabaseAdmin
          .from('roles')
          .select('*')
          .eq('name', role)
          .single()
        newTargetRole = data
      }

      if (!newTargetRole) {
        return NextResponse.json(
          { success: false, error: 'Rôle invalide ou introuvable' },
          { status: 400 }
        )
      }

      // Vérifier la hiérarchie: ne peut assigner que des rôles de niveau > son niveau
      if (!canManageLevel(userLevel, newTargetRole.level)) {
        return NextResponse.json(
          { success: false, error: `Vous ne pouvez assigner que des rôles avec un niveau hiérarchique inférieur au vôtre (${userLevel})` },
          { status: 403 }
        )
      }

      // Interdire d'assigner le level 1 (super_admin)
      if (newTargetRole.level === 1) {
        return NextResponse.json(
          { success: false, error: 'Impossible d\'assigner le rôle super_admin' },
          { status: 403 }
        )
      }

      updates.role = newTargetRole.name as UserRole
      updates.role_id = newTargetRole.id
    }

    const authUpdates: { email?: string; password?: string } = {}

    if (email !== undefined && email.trim()) {
      // Vérifier que l'email est valide
      if (!validateEmail(email.trim())) {
        return NextResponse.json(
          { success: false, error: 'Format email invalide' },
          { status: 400 }
        )
      }

      // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
      if (existingUser?.user?.email !== email.trim()) {
        // L'email change, vérifier qu'il n'est pas déjà utilisé
        // Note: Supabase vérifie automatiquement l'unicité de l'email
        authUpdates.email = email.trim()
      }
    }

    if (password !== undefined && password.trim()) {
      // Vérifier que le mot de passe a au moins 6 caractères
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' },
          { status: 400 }
        )
      }
      authUpdates.password = password
    }

    // Mettre à jour l'utilisateur Auth si nécessaire
    if (Object.keys(authUpdates).length > 0) {
      const { data: updatedAuthUser, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        authUpdates
      )

      if (authUpdateError) {
        console.error('Error updating auth user:', authUpdateError)
        return NextResponse.json(
          { success: false, error: authUpdateError.message || 'Erreur lors de la mise à jour de l\'identifiant ou du mot de passe' },
          { status: 500 }
        )
      }
    }

    // Mettre à jour le profil
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        // @ts-expect-error - Supabase typage strict ne permet pas les updates partiels dynamiques
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

      // Si level >= 5, vérifier qu'il n'assigne que ses branches
      if (userLevel >= 5) {
        const { data: adminBranches } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', user.id)

        const adminBranchIds = (adminBranches || []).map((b: { branch_id: string }) => b.branch_id)
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: branchAssignError } = await (supabase as any)
        .from('user_branches')
        .insert(branchAssignments)

      if (branchAssignError) {
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
      .single<Profile>()

    const { data: branches } = await supabase
      .from('user_branches')
      .select('branch_id, branches(*)')
      .eq('user_id', targetUserId)

    const userBranches = (branches || []).map((ub: any) => ub.branches).filter(Boolean)

    // Logger la modification de l'utilisateur
    const ipAddress = getClientIpFromHeaders(request.headers)
    const changedFields = [
      ...Object.keys(updates),
      ...Object.keys(authUpdates),
      ...(branch_ids !== undefined ? ['branches'] : [])
    ]

    await logUserAction({
      userId: user.id,
      userRole: userRole,
      userName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      action: 'updated',
      targetUserId: targetUserId,
      targetUserName: `${updatedProfile?.first_name || targetProfile?.first_name || ''} ${updatedProfile?.last_name || targetProfile?.last_name || ''}`.trim(),
      details: {
        targetUserRole: updatedProfile?.role || targetProfile?.role,
        changedFields,
        emailChanged: authUpdates.email !== undefined,
        passwordChanged: authUpdates.password !== undefined,
        roleChanged: updates.role !== undefined,
        branchesChanged: branch_ids !== undefined
      },
      ipAddress
    })

    return NextResponse.json(
      {
        success: true,
        user: {
          ...(updatedProfile || {}),
          branches: userBranches,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    void error
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
 * Permissions (basées sur hiérarchie dynamique):
 * - Un utilisateur peut supprimer des utilisateurs avec un rôle de level > son level
 * - Ne peut pas se supprimer soi-même
 * - Restriction par branches pour level >= 5
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
      .single<Profile>()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profil introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le niveau hiérarchique de l'utilisateur connecté
    const { level: userLevel } = await getUserLevel(supabaseAdmin, user.id)
    const userRole = profile.role as UserRole

    // Vérifier que l'utilisateur a le droit de supprimer des utilisateurs (level < 8)
    if (userLevel >= 8) {
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
      .single<Profile>()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le niveau hiérarchique de l'utilisateur cible
    const { level: targetLevel } = await getUserLevel(supabaseAdmin, targetUserId)

    // Vérifier la hiérarchie: l'utilisateur ne peut supprimer que des utilisateurs de niveau > son niveau
    if (!canManageLevel(userLevel, targetLevel)) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez supprimer que des utilisateurs avec un niveau hiérarchique inférieur au vôtre' },
        { status: 403 }
      )
    }

    // Si level >= 5, vérifier qu'il gère cet utilisateur via les branches
    if (userLevel >= 5) {
      const { data: adminBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      const { data: targetBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', targetUserId)

      const adminBranchIds = (adminBranches || []).map((b: { branch_id: string }) => b.branch_id)
      const targetBranchIds = (targetBranches || []).map((b: { branch_id: string }) => b.branch_id)

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

    // Logger la suppression de l'utilisateur
    const ipAddress = getClientIpFromHeaders(request.headers)
    await logUserAction({
      userId: user.id,
      userRole: userRole,
      userName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      action: 'deleted',
      targetUserId: targetUserId,
      targetUserName: `${targetProfile.first_name || ''} ${targetProfile.last_name || ''}`.trim(),
      details: {
        targetUserRole: targetProfile.role,
        deletedUserEmail: 'redacted' // On ne loggue pas l'email supprimé pour RGPD
      },
      ipAddress
    })

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
