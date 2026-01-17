import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import type { UserWithBranches, UserRole } from '@/lib/supabase/types'

/**
 * GET /api/admin/users
 * Liste tous les utilisateurs avec leurs branches
 * 
 * Permissions:
 * - super_admin: Voit TOUS les utilisateurs
 * - branch_admin: Voit uniquement les utilisateurs de sa/ses branche(s)
 * - agent: Accès refusé
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

    const userProfile = profile as { role: string; id: string; created_by?: string | null }

    // Vérifier les permissions (super_admin ou branch_admin)
    if (userProfile.role !== 'super_admin' && userProfile.role !== 'branch_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    let users: UserWithBranches[] = []

    if (userProfile.role === 'super_admin') {
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

      // Créer un client service role pour récupérer les emails
      const serviceClient = createServiceRoleClient()

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
      // Branch admin voit lui-même + tous les utilisateurs qui partagent au moins une branche
      // 1. Récupérer les branches du branch_admin
      const { data: adminBranches, error: branchesError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', user.id)

      if (branchesError || !adminBranches || adminBranches.length === 0) {
        // Même sans branches, le branch_admin doit se voir lui-même
        const serviceClient = createServiceRoleClient()
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
      
      // Créer un client service role pour récupérer les emails
      const serviceClient = createServiceRoleClient()
      
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
 *   role: 'branch_admin' | 'agent'
 *   branch_ids: string[]
 *   password?: string (optionnel, généré automatiquement si absent)
 * }
 * 
 * Permissions:
 * - super_admin: Peut créer branch_admin et agent pour toutes les branches
 * - branch_admin: Peut créer uniquement agent pour ses branches
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

    const userProfile = profile as { role: string; id: string }

    // Vérifier les permissions
    if (userProfile.role !== 'super_admin' && userProfile.role !== 'branch_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Parser le body
    const body = await request.json()
    const { email, first_name, last_name, phone, role, branch_ids, password } = body

    // Validations
    if (!email || !first_name || !last_name || !phone || !role || !branch_ids || branch_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis (email, first_name, last_name, phone, role, branch_ids)' },
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

    // Valider le rôle
    const validRoles: UserRole[] = ['branch_admin', 'agent']
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json(
        { success: false, error: 'Rôle invalide (branch_admin ou agent uniquement)' },
        { status: 400 }
      )
    }

    // Si branch_admin, vérifier qu'il ne crée que des agents
    if (userProfile.role === 'branch_admin' && role !== 'agent') {
      return NextResponse.json(
        { success: false, error: 'Les branch_admin ne peuvent créer que des agents' },
        { status: 403 }
      )
    }

    // Si branch_admin, vérifier qu'il n'assigne que ses propres branches
    if (userProfile.role === 'branch_admin') {
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

    // Créer le profil
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile, error: profileInsertError } = await (supabase as any)
      .from('profiles')
      .insert({
        id: newUser.user.id,
        role: role as UserRole,
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
