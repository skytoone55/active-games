'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { Branch, BranchSettings, EventRoom, LaserRoom } from '@/lib/supabase/types'

interface BranchWithDetails extends Branch {
  settings: BranchSettings | null
  rooms: EventRoom[]
  laserRooms: LaserRoom[]
}

export function useBranches() {
  const [branches, setBranches] = useState<BranchWithDetails[]>([])
  // Charger la branche sélectionnée depuis localStorage pour persister entre les pages
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedBranchId')
      return saved || null
    }
    return null
  })
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
      // Les politiques RLS filtreront automatiquement selon l'utilisateur
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .returns<Branch[]>()

      if (branchesError) throw branchesError

      if (!branchesData || branchesData.length === 0) {
        setBranches([])
        setLoading(false)
        return
      }

      // Charger les settings et rooms pour chaque branche
      const branchesWithDetails: BranchWithDetails[] = await Promise.all(
        branchesData.map(async (branch) => {
          // Settings
          const { data: settings } = await supabase
            .from('branch_settings')
            .select('*')
            .eq('branch_id', branch.id)
            .single<BranchSettings>()

          // Rooms
          const { data: rooms } = await supabase
            .from('event_rooms')
            .select('*')
            .eq('branch_id', branch.id)
            .eq('is_active', true)
            .order('sort_order')
            .returns<EventRoom[]>()

          // Laser Rooms
          const { data: laserRooms } = await supabase
            .from('laser_rooms')
            .select('*')
            .eq('branch_id', branch.id)
            .eq('is_active', true)
            .order('sort_order')
            .returns<LaserRoom[]>()

          return {
            ...branch,
            settings: settings || null,
            rooms: rooms || [],
            laserRooms: laserRooms || [],
          }
        })
      )

      setBranches(branchesWithDetails)

      // Sélectionner Rishon LeZion par défaut si aucune n'est sélectionnée
      setSelectedBranchId(prev => {
        if (!prev && branchesWithDetails.length > 0) {
          // Chercher Rishon LeZion en priorité (par slug ou nom)
          const rishonBranch = branchesWithDetails.find(
            b => b.slug === 'rishon-lezion' || 
                 b.name.toLowerCase().includes('rishon') ||
                 b.name.toLowerCase().includes('rly')
          )
          
          // Si Rishon trouvé, l'utiliser, sinon première branche
          return rishonBranch?.id || branchesWithDetails[0].id
        }
        return prev
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
