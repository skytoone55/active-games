'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { LaserRoom } from '@/lib/supabase/types'

export function useLaserRooms(branchId: string | null) {
  const [laserRooms, setLaserRooms] = useState<LaserRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les laser rooms
  const fetchLaserRooms = useCallback(async () => {
    if (!branchId) {
      setLaserRooms([])
      setLoading(false)
      return
    }

    const supabase = getClient()
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('laser_rooms')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('sort_order')
        .returns<LaserRoom[]>()

      // Si la table n'existe pas encore (migration non exécutée), retourner un tableau vide
      if (fetchError) {
        // Code 42P01 = table does not exist
        const errorCode = (fetchError as any)?.code || ''
        const errorMessage = String((fetchError as any)?.message || fetchError || '')
        
        // Vérifier si l'erreur est un objet vide
        const isEmptyError = (
          !errorMessage || 
          errorMessage === '{}' || 
          errorMessage === '[object Object]' ||
          (typeof fetchError === 'object' && fetchError !== null && Object.keys(fetchError).length === 0)
        )
        
        // Vérifier si c'est une erreur de table inexistante
        const isTableNotExist = 
          isEmptyError ||
          errorCode === '42P01' || 
          errorMessage.toLowerCase().includes('does not exist') || 
          errorMessage.toLowerCase().includes('n\'existe pas') || 
          (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist')) ||
          (errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found'))
        
        if (isTableNotExist) {
          // Ne pas logger, juste retourner un tableau vide silencieusement
          setLaserRooms([])
          setError(null) // Pas d'erreur, juste pas de données
          setLoading(false)
          return
        } else {
          throw fetchError
        }
      } else {
        setLaserRooms(data || [])
        setError(null)
      }
    } catch (err) {
      // Vérifier si c'est une erreur de table inexistante
      const errorObj = err as any
      const errorCode = String(errorObj?.code || '')
      const errorMessage = String(errorObj?.message || errorObj || '')
      
      // Si l'erreur est un objet vide ou une chaîne vide, considérer que c'est probablement une table inexistante
      const isEmptyError = (
        !errorMessage || 
        errorMessage === '{}' || 
        errorMessage === '[object Object]' || 
        (typeof err === 'object' && err !== null && Object.keys(err).length === 0) ||
        (errorObj && typeof errorObj === 'object' && Object.keys(errorObj).length === 0)
      )
      
      // Vérifier si c'est une erreur de table inexistante
      const isTableNotExist = 
        isEmptyError ||
        errorCode === '42P01' || 
        errorMessage.toLowerCase().includes('does not exist') || 
        errorMessage.toLowerCase().includes('n\'existe pas') || 
        (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist')) ||
        (errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found')) ||
        (errorMessage.toLowerCase().includes('relation') && errorMessage.toLowerCase().includes('does not exist'))
      
      if (isTableNotExist) {
        // Ne pas logger d'erreur si c'est juste que la table n'existe pas encore
        // Juste retourner un tableau vide silencieusement
        setLaserRooms([])
        setError(null)
      } else {
        // Logger seulement les vraies erreurs (pas les tables inexistantes)
        // Mais seulement si le message d'erreur n'est pas vide et n'est pas un objet vide
        if (errorMessage && errorMessage !== '{}' && errorMessage !== '[object Object]' && !isEmptyError) {
          console.error('Error fetching laser rooms:', err)
          setError(errorMessage || 'Erreur lors du chargement des salles laser')
        } else {
          // Si c'est un objet vide, traiter comme table inexistante (ne pas logger)
          setLaserRooms([])
          setError(null)
          setLoading(false)
          return
        }
        setLaserRooms([])
      }
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchLaserRooms()
  }, [fetchLaserRooms])

  // Vérifier disponibilité d'une laser room sur un créneau
  const checkLaserRoomAvailability = useCallback(async (
    roomId: string,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string
  ): Promise<boolean> => {
    if (!branchId) return false

    const supabase = getClient()
    try {
      // Chercher les game_sessions qui utilisent cette salle sur ce créneau
      const { data, error } = await supabase
        .from('game_sessions')
        .select('id, booking_id')
        .eq('laser_room_id', roomId)
        .eq('game_area', 'LASER')
        .lt('start_datetime', endDateTime.toISOString())
        .gt('end_datetime', startDateTime.toISOString())

      if (error) throw error

      // Si excludeBookingId est fourni, filtrer ce booking
      if (excludeBookingId && data) {
        const { data: bookingSessions } = await supabase
          .from('game_sessions')
          .select('id')
          .eq('booking_id', excludeBookingId)
          .returns<Array<{ id: string }>>()

        if (bookingSessions) {
          const sessionIds = bookingSessions.map((s: any) => s.id)
          const filtered = data.filter((s: any) => !sessionIds.includes(s.id))
          return filtered.length === 0
        }
      }

      return !data || data.length === 0
    } catch (err) {
      console.error('Error checking laser room availability:', err)
      return false
    }
  }, [branchId])

  // Calculer contrainte vests sur un créneau
  const calculateVestsUsage = useCallback(async (
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null
  ): Promise<number> => {
    const branchIdToUse = targetBranchId || branchId
    if (!branchIdToUse) return 0

    const supabase = getClient()
    try {
      // Chercher toutes les game_sessions LASER qui chevauchent ce créneau
      // IMPORTANT : Filtrer SEULEMENT les sessions avec game_area = 'LASER'
      // Les sessions ACTIVE ne doivent PAS être prises en compte ici
      // Les grilles ACTIVE et LASER sont complètement indépendantes
      const { data: sessions, error } = await supabase
        .from('game_sessions')
        .select('id, booking_id')
        .eq('game_area', 'LASER') // FILTRE CRITIQUE : Seulement LASER, pas ACTIVE
        .lt('start_datetime', endDateTime.toISOString())
        .gt('end_datetime', startDateTime.toISOString())

      if (error) throw error

      if (!sessions || sessions.length === 0) return 0

      // Si excludeBookingId est fourni, exclure TOUTES les sessions de ce booking
      // IMPORTANT : Cela permet de modifier une réservation sans qu'elle se bloque elle-même
      let filteredSessions = sessions
      if (excludeBookingId && typeof excludeBookingId === 'string' && excludeBookingId.trim() !== '') {
        // Filtrer toutes les sessions qui appartiennent au booking à exclure
        filteredSessions = sessions.filter((s: any) => s.booking_id !== excludeBookingId)
      }

      if (filteredSessions.length === 0) return 0

      // Charger les bookings pour obtenir participants_count ET branch_id
      // IMPORTANT : On compte participants_count du booking entier, mais SEULEMENT pour les bookings
      // qui ont des sessions LASER sur ce créneau ET qui appartiennent à la branche cible
      const bookingIds = [...new Set(filteredSessions.map((s: any) => s.booking_id))]
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, participants_count, branch_id')
        .in('id', bookingIds)
        .eq('branch_id', branchIdToUse) // FILTRE CRITIQUE : Seulement les bookings de la branche cible
        .returns<Array<{ id: string; participants_count: number; branch_id: string }>>()

      if (!bookings) return 0

      // Calculer le total des participants UNIQUEMENT pour les bookings avec sessions LASER de cette branche
      // IMPORTANT : Si un booking a à la fois des sessions ACTIVE et LASER (booking mixte),
      // on compte quand même le total car tous les participants peuvent utiliser les vestes LASER
      // Les grilles ACTIVE et LASER sont indépendantes : un participant peut jouer ACTIVE
      // et ne pas utiliser de veste LASER, ou vice versa
      const totalParticipants = bookings.reduce((sum, booking) => {
        return sum + booking.participants_count
      }, 0)

      return totalParticipants
    } catch (err) {
      console.error('Error calculating vests usage:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        branchId: branchIdToUse,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        excludeBookingId
      })
      return 0
    }
  }, [branchId])

  return {
    laserRooms,
    loading,
    error,
    refresh: fetchLaserRooms,
    checkLaserRoomAvailability,
    calculateVestsUsage,
  }
}
