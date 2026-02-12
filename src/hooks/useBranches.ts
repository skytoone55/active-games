'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { Branch, BranchSettings, EventRoom, LaserRoom } from '@/lib/supabase/types'

export interface BranchWithDetails extends Branch {
  settings: BranchSettings | null
  rooms: EventRoom[]
  laserRooms: LaserRoom[]
}

export function useBranches() {
  const [branches, setBranches] = useState<BranchWithDetails[]>([])
  // Ne pas charger depuis localStorage au début - on le fera après avoir chargé les branches autorisées
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Persister la branche sélectionnée dans localStorage
  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem('selectedBranchId', selectedBranchId)
    }
  }, [selectedBranchId])

  // Charger les branches avec leurs détails
  const fetchBranches = useCallback(async () => {
    const supabase = getClient()
    setLoading(true)
    setError(null)

    try {
      // Récupérer l'utilisateur et ses branches autorisées
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setBranches([])
        setLoading(false)
        return
      }

      // Récupérer le rôle de l'utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single<{ role: string }>()

      if (profileError) {
        throw profileError
      }

      let branchesData: Branch[] = []

      if (profile?.role === 'super_admin') {
        // Super admin voit toutes les branches
        const { data, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .returns<Branch[]>()

        if (branchesError) throw branchesError
        branchesData = data || []
      } else {
        // Branch admin et agent voient uniquement leurs branches assignées
        const { data: userBranches, error: userBranchesError } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', authUser.id)
          .returns<Array<{ branch_id: string }>>()

        if (userBranchesError) {
          throw userBranchesError
        }

        if (userBranches && userBranches.length > 0) {
          const branchIds = userBranches.map((ub: { branch_id: string }) => ub.branch_id)
          const { data, error: branchesError } = await supabase
            .from('branches')
            .select('*')
            .in('id', branchIds)
            .eq('is_active', true)
            .order('name')
            .returns<Branch[]>()

          if (branchesError) throw branchesError
          branchesData = data || []
        }
      }

      if (!branchesData || branchesData.length === 0) {
        setBranches([])
        setLoading(false)
        return
      }

      // Charger TOUTES les données en parallèle (3 requêtes au total au lieu de 3 par branche)
      const branchIds = branchesData.map(b => b.id)

      const [settingsResult, roomsResult, laserRoomsResult] = await Promise.all([
        supabase
          .from('branch_settings')
          .select('*')
          .in('branch_id', branchIds)
          .returns<BranchSettings[]>(),
        supabase
          .from('event_rooms')
          .select('*')
          .in('branch_id', branchIds)
          .eq('is_active', true)
          .order('sort_order')
          .returns<EventRoom[]>(),
        supabase
          .from('laser_rooms')
          .select('*')
          .in('branch_id', branchIds)
          .eq('is_active', true)
          .order('sort_order')
          .returns<LaserRoom[]>()
      ])

      const allSettings = settingsResult.data || []
      const allRooms = roomsResult.data || []
      const allLaserRooms = laserRoomsResult.data || []

      // Mapper les données par branche (en mémoire, rapide)
      const branchesWithDetails: BranchWithDetails[] = branchesData.map(branch => ({
        ...branch,
        settings: allSettings.find(s => s.branch_id === branch.id) || null,
        rooms: allRooms.filter(r => r.branch_id === branch.id),
        laserRooms: allLaserRooms.filter(lr => lr.branch_id === branch.id),
      }))

      setBranches(branchesWithDetails)

      // Sélectionner automatiquement la branche appropriée
      setSelectedBranchId(prev => {
        if (branchesWithDetails.length === 0) {
          return null
        }

        // Si une seule branche (branch_admin avec 1 branche), la sélectionner
        if (branchesWithDetails.length === 1) {
          return branchesWithDetails[0].id
        }

        // Si une branche était déjà sélectionnée, vérifier qu'elle est toujours autorisée
        if (prev) {
          const isStillAuthorized = branchesWithDetails.some(b => b.id === prev)
          if (isStillAuthorized) {
            return prev // Garder la sélection actuelle si elle est toujours valide
          }
          // Sinon, la branche n'est plus autorisée (changement de rôle/permissions), réinitialiser
        }

        // Vérifier si on a une branche sauvegardée dans localStorage qui est autorisée
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('selectedBranchId')
          if (saved && branchesWithDetails.some(b => b.id === saved)) {
            return saved // Utiliser la branche sauvegardée si elle est autorisée
          }
        }

        // Sinon, chercher Rishon LeZion en priorité (pour super_admin)
        const rishonBranch = branchesWithDetails.find(
          b => b.slug === 'rishon-lezion' || 
               b.name.toLowerCase().includes('rishon') ||
               b.name.toLowerCase().includes('rly')
        )
        
        // Si Rishon trouvé, l'utiliser, sinon première branche
        return rishonBranch?.id || branchesWithDetails[0].id
      })
    } catch (err) {
      console.error('Error fetching branches:', err)
      setError('Erreur lors du chargement des agences')
    } finally {
      setLoading(false)
    }
  }, []) // Plus de dépendance sur selectedBranchId

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  // Branche actuellement sélectionnée
  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null

  // Changer de branche
  const selectBranch = useCallback((branchId: string) => {
    setSelectedBranchId(branchId)
  }, [])

  return {
    branches,
    selectedBranch,
    selectedBranchId,
    selectBranch,
    loading,
    error,
    refresh: fetchBranches,
  }
}
