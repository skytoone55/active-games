import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import { logUserAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { UserWithBranches, UserRole, Role } from '@/lib/supabase/types'

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
 * GET /api/admin/users
 * Liste tous les utilisateurs avec leurs branches
 *
 * Permissions (basées sur hiérarchie dynamique):
 * - Utilisateurs avec level < 5: Voient TOUS les utilisateurs
 * - Utilisateurs avec level >= 5: Voient uniquement les utilisateurs de leurs branches
 * - Le filtrage dépend aussi de la permission 'users.can_view'
 */
export async function GET(request: NextRequest) {
  try {
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

    const userProfile = profile as { role: string; role_id?: string | null; id: string; created_by?: string | null }

    // Créer un client service role
    const serviceClient = createServiceRoleClient()

    // Récupérer le niveau hiérarchique de l'utilisateur
    const { level: userLevel, role: userRoleData } = await getUserLevel(serviceClient, user.id)

    // Vérifier que l'utilisateur a un rôle avec permissions suffisantes
    // Les utilisateurs avec level >= 8 (agents par défaut) n'ont pas accès à la liste des utilisateurs
    if (userLevel >= 8) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    let users: UserWithBranches[] = []

    // Les utilisateurs avec level < 5 (super_admin, superviseurs...) voient tous les utilisateurs
    if (userLevel < 5) {
      // Super admin voit tous les utilisateurs
      const { data: allProfiles, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<Array<{ id: string; role: string; created_by?: string | null; first_name?: string; last_name?: string; phone?: string; created_at?: string }>>()

      if (usersError) {
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la récupération des utilisateurs' },
          { status: 500 }
        )
      }

      // Pour chaque utilisateur, récupérer ses branches et son email
      for (const profileData of allProfiles || []) {
        // Récupérer l'email depuis auth.users
        const { data: authUser } = await serviceClient.auth.admin.getUserById(profileData.id)

        const { data: userBranches } = await supabase
          .from('user_branches')
          .select('branch_id, branches(*)')
          .eq('user_id', profileData.id)

        const branches = (userBranches || []).map((ub: any) => ub.branches).filter(Boolean)

        // Récupérer le créateur
        let creator = null
        if (profileData.created_by) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileData.created_by)
            .single()
          creator = creatorProfile
        }

        users.push({
          ...profileData,
          email: authUser?.user?.email || profileData.id,
          branches,
          creator,
        } as UserWithBranches)
      }
    } else {
      // Utilisateurs avec level >= 5 (branch_admin, etc.) voient seulement les utilisateurs de leurs branches
      // 1. Récupérer les branches de l'utilisateur
      const { data: adminBranches, error: branchesError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      if (branchesError || !adminBranches || adminBranches.length === 0) {
        // Même sans branches, l'utilisateur doit se voir lui-même
        const { data: authUser } = await serviceClient.auth.admin.getUserById(user.id)

        // Récupérer le créateur si existe
        let creator = null
        if (userProfile.created_by) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userProfile.created_by)
            .single()
          creator = creatorProfile
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profileObj = profile as any
        users.push({
          ...profileObj,
          email: authUser?.user?.email || user.id,
          branches: [],
          creator,
        } as UserWithBranches)

        return NextResponse.json(
          { success: true, users },
          { status: 200 }
        )
      }

      const branchIds = adminBranches.map((b: { branch_id: string }) => b.branch_id)

      // 2. Récupérer tous les user_branches pour ces branches (sans profiles, car pas de FK directe)
      const { data: userBranchesData, error: userBranchesError } = await supabase
        .from('user_branches')
        .select('user_id, branch_id, branches(*)')
        .in('branch_id', branchIds)
        .returns<Array<{ user_id: string; branch_id: string; branches: any }>>()

      if (userBranchesError) {
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la récupération des utilisateurs' },
          { status: 500 }
        )
      }

      // 3. Extraire les user_ids uniques (y compris le branch_admin lui-même)
      const userIds = Array.from(new Set([
        user.id, // S'assurer que le branch_admin est inclus
        ...(userBranchesData || []).map(ub => ub.user_id)
      ]))

      // 4. Récupérer tous les profiles de ces utilisateurs
      const { data: userProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
        .returns<Array<{ id: string; role: string; created_by?: string | null; first_name?: string; last_name?: string; phone?: string; created_at?: string }>>()

      if (profilesError) {
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la récupération des profils' },
          { status: 500 }
        )
      }

      // 5. Créer un Map pour accéder rapidement aux profiles
      const profilesMap = new Map((userProfiles || []).map(p => [p.id, p]))

      // 6. Grouper par utilisateur
      const userMap = new Map<string, UserWithBranches>()

      // Pour chaque utilisateur, construire l'objet UserWithBranches
      for (const userId of userIds) {
        const userProfile = profilesMap.get(userId)
        if (!userProfile) continue

        // Récupérer l'email depuis auth.users
        const { data: authUser } = await serviceClient.auth.admin.getUserById(userId)
        
        // Récupérer les branches de cet utilisateur depuis userBranchesData
        const userBranches = (userBranchesData || [])
          .filter(ub => ub.user_id === userId)
          .map(ub => ub.branches)
          .filter(Boolean)

        // Récupérer le créateur
        let creator = null
        if (userProfile.created_by) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userProfile.created_by)
            .single()
          creator = creatorProfile
        }

        userMap.set(userId, {
          ...userProfile,
          email: authUser?.user?.email || userId,
          branches: userBranches as any[],
          creator,
        } as UserWithBranches)
      }

      users = Array.from(userMap.values())
    }

    return NextResponse.json(
      {
        success: true,
        users,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur
 *
 * Body: {
 *   email: string
 *   first_name: string
 *   last_name: string
 *   phone: string
 *   role_id: string (UUID du rôle)
 *   branch_ids: string[]
 *   password?: string (optionnel, généré automatiquement si absent)
 * }
 *
 * Permissions (basées sur hiérarchie dynamique):
 * - Un utilisateur peut créer des utilisateurs avec un rôle de level > son level
 * - Restriction par branches: ne peut assigner que ses propres branches (sauf level < 5)
 */
export async function POST(request: NextRequest) {
  try {
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

    // Récupérer le niveau hiérarchique de l'utilisateur connecté
    const { level: userLevel } = await getUserLevel(supabaseAdmin, user.id)

    // Vérifier que l'utilisateur a le droit de créer des utilisateurs (level < 8)
    if (userLevel >= 8) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Parser le body
    const body = await request.json()
    const { email, first_name, last_name, phone, role_id, role, branch_ids, password } = body

    // Support du role_id OU role (rétrocompatibilité)
    const targetRoleId = role_id

    // Validations
    if (!email || !first_name || !last_name || !phone || (!role_id && !role) || !branch_ids || branch_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis (email, first_name, last_name, phone, role_id, branch_ids)' },
        { status: 400 }
      )
    }

    // Valider l'email
    if (!validateEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email invalide' },
        { status: 400 }
      )
    }

    // Valider le téléphone
    if (!validateIsraeliPhone(phone)) {
      return NextResponse.json(
        { success: false, error: 'Format téléphone invalide (05XXXXXXXX)' },
        { status: 400 }
      )
    }

    // Récupérer le rôle cible (par role_id ou par name pour rétrocompatibilité)
    let targetRole: Role | null = null

    if (targetRoleId) {
      const { data } = await supabaseAdmin
        .from('roles')
        .select('*')
        .eq('id', targetRoleId)
        .single()
      targetRole = data
    } else if (role) {
      // Rétrocompatibilité: chercher par nom
      const { data } = await supabaseAdmin
        .from('roles')
        .select('*')
        .eq('name', role)
        .single()
      targetRole = data
    }

    if (!targetRole) {
      return NextResponse.json(
        { success: false, error: 'Rôle invalide ou introuvable' },
        { status: 400 }
      )
    }

    // Vérifier la hiérarchie: l'utilisateur ne peut assigner que des rôles de niveau > son niveau
    if (!canManageLevel(userLevel, targetRole.level)) {
      return NextResponse.json(
        { success: false, error: `Vous ne pouvez créer que des utilisateurs avec un niveau hiérarchique inférieur au vôtre (${userLevel})` },
        { status: 403 }
      )
    }

    // Vérifier que l'utilisateur ne peut pas créer de super_admin (level 1)
    if (targetRole.level === 1) {
      return NextResponse.json(
        { success: false, error: 'Impossible de créer un utilisateur avec le rôle super_admin' },
        { status: 403 }
      )
    }

    // Si level >= 5, vérifier qu'il n'assigne que ses propres branches
    if (userLevel >= 5) {
      const { data: adminBranches } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      const adminBranchIds = (adminBranches || []).map((b: { branch_id: string }) => b.branch_id)
      const invalidBranches = branch_ids.filter((id: string) => !adminBranchIds.includes(id))

      if (invalidBranches.length > 0) {
        // Récupérer les noms des branches invalides pour un message plus clair
        const { data: invalidBranchNames } = await supabase
          .from('branches')
          .select('name')
          .in('id', invalidBranches)

        const branchNames = (invalidBranchNames || []).map((b: { name: string }) => b.name).join(', ')

        return NextResponse.json(
          {
            success: false,
            error: `Vous ne pouvez assigner que vos propres branches. Branches non autorisées: ${branchNames || invalidBranches.join(', ')}`
          },
          { status: 403 }
        )
      }
    }

    // Générer un mot de passe temporaire si non fourni
    const userPassword = password || `AG${Math.random().toString(36).slice(2, 10).toUpperCase()}`
    const formattedPhone = formatIsraeliPhone(phone)

    // Créer le compte Supabase Auth avec service role
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: userPassword,
      email_confirm: true, // Compte directement confirmé, pas besoin d'email de confirmation
    })

    if (createUserError || !newUser.user) {
      return NextResponse.json(
        { success: false, error: createUserError?.message || 'Erreur lors de la création du compte' },
        { status: 500 }
      )
    }

    // Créer le profil avec role et role_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile, error: profileInsertError } = await (supabase as any)
      .from('profiles')
      .insert({
        id: newUser.user.id,
        role: targetRole.name,
        role_id: targetRole.id,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: formattedPhone,
        created_by: user.id,
      })
      .select()
      .single()

    if (profileInsertError) {
      // Rollback: supprimer le user Auth
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création du profil' },
        { status: 500 }
      )
    }

    // Créer les associations user_branches
    const branchAssignments = branch_ids.map((branchId: string) => ({
      user_id: newUser.user.id,
      branch_id: branchId,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: branchAssignError } = await (supabase as any)
      .from('user_branches')
      .insert(branchAssignments)

    if (branchAssignError) {
      // Rollback: supprimer profil et user Auth
      await supabase.from('profiles').delete().eq('id', newUser.user.id)
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'assignation des branches' },
        { status: 500 }
      )
    }

    // Récupérer l'utilisateur complet avec ses branches
    const { data: branches } = await supabase
      .from('user_branches')
      .select('branch_id, branches(*)')
      .eq('user_id', newUser.user.id)

    const userBranches = (branches || []).map((ub: any) => ub.branches).filter(Boolean)

    const createdUser: UserWithBranches = {
      ...(newProfile || {}),
      branches: userBranches,
      creator: profile || null,
    } as UserWithBranches

    // Logger la création de l'utilisateur
    const ipAddress = getClientIpFromHeaders(request.headers)
    await logUserAction({
      userId: user.id,
      userRole: profile.role as UserRole,
      userName: `${(profile as any).first_name || ''} ${(profile as any).last_name || ''}`.trim(),
      action: 'created',
      targetUserId: newUser.user.id,
      targetUserName: `${first_name} ${last_name}`.trim(),
      details: {
        targetUserRole: targetRole.name,
        targetRoleId: targetRole.id,
        email: email.trim(),
        phone: formattedPhone,
        branchIds: branch_ids
      },
      ipAddress
    })

    return NextResponse.json(
      {
        success: true,
        user: createdUser,
        temporaryPassword: userPassword, // Retourner le mot de passe temporaire
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
