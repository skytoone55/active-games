/**
 * Utilitaires de gestion des permissions utilisateurs
 * 
 * Ce module centralise toute la logique de permissions pour garantir
 * la cohérence dans toute l'application.
 */

import { createClient } from '@/lib/supabase/server'
import type { UserRole, Branch } from '@/lib/supabase/types'

/**
 * Récupère les branches autorisées pour un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param userRole - Rôle de l'utilisateur
 * @returns Liste des branches autorisées
 */
export async function getUserAuthorizedBranches(
  userId: string,
  userRole: UserRole
): Promise<Branch[]> {
  const supabase = await createClient()

  if (userRole === 'super_admin') {
    // Super admin voit toutes les branches actives
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .returns<Branch[]>()

    if (error) {
      console.error('Error fetching all branches for super_admin:', error)
      return []
    }

    return branches || []
  } else {
    // Branch admin et agent voient uniquement leurs branches assignées
    const { data: userBranches, error } = await supabase
      .from('user_branches')
      .select('branch_id, branches(*)')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user branches:', error)
      return []
    }

    if (!userBranches || userBranches.length === 0) {
      return []
    }

    // Extraire les branches depuis les résultats
    const branches = userBranches
      .map((ub: any) => ub.branches)
      .filter(Boolean) as Branch[]

    return branches
  }
}

/**
 * Vérifie si un utilisateur a accès à une branche spécifique
 * 
 * @param userId - ID de l'utilisateur
 * @param userRole - Rôle de l'utilisateur
 * @param branchId - ID de la branche à vérifier
 * @returns true si l'utilisateur a accès, false sinon
 */
export async function checkUserBranchAccess(
  userId: string,
  userRole: UserRole,
  branchId: string
): Promise<boolean> {
  if (userRole === 'super_admin') {
    return true // Super admin a accès à tout
  }

  const authorizedBranches = await getUserAuthorizedBranches(userId, userRole)
  return authorizedBranches.some(b => b.id === branchId)
}

/**
 * Vérifie si un utilisateur peut gérer un autre utilisateur
 * 
 * @param currentUserId - ID de l'utilisateur connecté
 * @param currentUserRole - Rôle de l'utilisateur connecté
 * @param targetUserId - ID de l'utilisateur cible
 * @returns true si l'utilisateur peut gérer la cible, false sinon
 */
export async function canManageUser(
  currentUserId: string,
  currentUserRole: UserRole,
  targetUserId: string
): Promise<boolean> {
  // Super admin peut gérer tout le monde (sauf se supprimer lui-même, géré ailleurs)
  if (currentUserRole === 'super_admin') {
    return true
  }

  // Branch admin peut gérer les utilisateurs qui partagent au moins une branche
  if (currentUserRole === 'branch_admin') {
    const supabase = await createClient()

    // Récupérer les branches du branch_admin
    const { data: adminBranches } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', currentUserId)

    if (!adminBranches || adminBranches.length === 0) {
      return false
    }

    const adminBranchIds = adminBranches.map(b => b.branch_id)

    // Récupérer les branches de l'utilisateur cible
    const { data: targetBranches } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', targetUserId)

    if (!targetBranches || targetBranches.length === 0) {
      return false
    }

    const targetBranchIds = targetBranches.map(b => b.branch_id)

    // Vérifier s'il y a au moins une branche en commun
    return targetBranchIds.some(id => adminBranchIds.includes(id))
  }

  // Agent ne peut gérer personne
  return false
}

/**
 * Récupère tous les IDs de branches autorisées pour un utilisateur
 * 
 * @param userId - ID de l'utilisateur
 * @param userRole - Rôle de l'utilisateur
 * @returns Liste des IDs de branches autorisées
 */
export async function getUserAuthorizedBranchIds(
  userId: string,
  userRole: UserRole
): Promise<string[]> {
  const branches = await getUserAuthorizedBranches(userId, userRole)
  return branches.map(b => b.id)
}
