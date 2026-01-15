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
    excludeBookingId?: string
  ): Promise<number> => {
    if (!branchId) return 0

    const supabase = getClient()
    try {
      // Chercher toutes les game_sessions LASER qui chevauchent ce créneau
      const { data: sessions, error } = await supabase
        .from('game_sessions')
        .select('id, booking_id')
        .eq('game_area', 'LASER')
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

      // Charger les bookings pour obtenir participants_count
      const bookingIds = [...new Set(filteredSessions.map((s: any) => s.booking_id))]
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, participants_count')
        .in('id', bookingIds)
        .returns<Array<{ id: string; participants_count: number }>>()

      if (!bookings) return 0

      // Calculer le total des participants
      const totalParticipants = bookings.reduce((sum, booking) => {
        return sum + booking.participants_count
      }, 0)

      return totalParticipants
    } catch (err) {
      console.error('Error calculating vests usage:', err)
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
