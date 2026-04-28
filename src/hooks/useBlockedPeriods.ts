'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/swr-fetcher'
import { getIsraelOffset } from '@/lib/dates'
import type { BlockedPeriod } from '@/lib/supabase/types'

interface UseBlockedPeriodsReturn {
  blocks: BlockedPeriod[]
  loading: boolean
  /** Vérifie si un créneau (date "YYYY-MM-DD", heure, minute) est bloqué */
  isSlotBlocked: (date: string, hour: number, minute: number) => boolean
  /** Retourne les blocs actifs pour un jour donné (résolus depuis récurrents + ponctuels) */
  getBlocksForDate: (date: string) => Array<{ startMinutes: number; endMinutes: number; label: string; id: string }>
  createBlock: (data: Omit<BlockedPeriod, 'id' | 'created_at'>) => Promise<BlockedPeriod | null>
  deleteBlock: (id: string) => Promise<boolean>
  refresh: () => void
}

/**
 * Convertit une heure Israel "HH:MM" en minutes depuis minuit
 */
function israelTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convertit un timestamp UTC en heure locale Israël exprimée en minutes depuis minuit
 */
function utcToIsraelMinutes(isoString: string): number {
  const date = new Date(isoString)
  const offsetMinutes = getIsraelOffset(date)
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  return ((utcMinutes + offsetMinutes) % (24 * 60) + 24 * 60) % (24 * 60)
}

/**
 * Extrait la date locale Israël "YYYY-MM-DD" depuis un timestamp UTC
 */
function utcToIsraelDate(isoString: string): string {
  const date = new Date(isoString)
  const offsetMinutes = getIsraelOffset(date)
  const israelMs = date.getTime() + offsetMinutes * 60 * 1000
  const israelDate = new Date(israelMs)
  const y = israelDate.getUTCFullYear()
  const m = String(israelDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(israelDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useBlockedPeriods(branchId: string | null): UseBlockedPeriodsReturn {
  const swrKey = branchId ? `/api/blocked-periods?branchId=${branchId}` : null

  const { data, isLoading, mutate } = useSWR<{ success: boolean; blocks: BlockedPeriod[] }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const blocks = data?.blocks || []

  /**
   * Pour un jour donné (YYYY-MM-DD), retourne la liste des plages bloquées
   * sous forme { startMinutes, endMinutes, label, id }
   */
  const getBlocksForDate = useCallback((date: string) => {
    const result: Array<{ startMinutes: number; endMinutes: number; label: string; id: string }> = []
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getDay() // 0=Sunday

    for (const block of blocks) {
      if (!block.is_recurring) {
        // Blocage ponctuel : vérifier si la date tombe dans la plage
        if (!block.start_datetime || !block.end_datetime) continue
        const startDate = utcToIsraelDate(block.start_datetime)
        const endDate = utcToIsraelDate(block.end_datetime)
        if (date < startDate || date > endDate) continue

        // Pour les blocages multi-jours, le créneau de la journée est 0h-23h59 sauf les jours extrêmes
        let startMin: number
        let endMin: number

        if (date === startDate && date === endDate) {
          startMin = utcToIsraelMinutes(block.start_datetime)
          endMin = utcToIsraelMinutes(block.end_datetime)
        } else if (date === startDate) {
          startMin = utcToIsraelMinutes(block.start_datetime)
          endMin = 24 * 60
        } else if (date === endDate) {
          startMin = 0
          endMin = utcToIsraelMinutes(block.end_datetime)
        } else {
          startMin = 0
          endMin = 24 * 60
        }

        result.push({ startMinutes: startMin, endMinutes: endMin, label: block.label, id: block.id })
      } else {
        // Blocage récurrent : vérifier jour de semaine + période de validité
        if (!block.recurrence_days?.includes(dayOfWeek)) continue
        if (block.recurrence_valid_from && date < block.recurrence_valid_from) continue
        if (block.recurrence_valid_until && date > block.recurrence_valid_until) continue

        const startMin = israelTimeToMinutes(block.recurrence_start_time!)
        const endMin = israelTimeToMinutes(block.recurrence_end_time!)
        result.push({ startMinutes: startMin, endMinutes: endMin, label: block.label, id: block.id })
      }
    }

    return result
  }, [blocks])

  /**
   * Vérifie si un créneau de 15 min est dans une plage bloquée
   */
  const isSlotBlocked = useCallback((date: string, hour: number, minute: number): boolean => {
    const slotMinutes = hour * 60 + minute
    const dateBlocks = getBlocksForDate(date)
    return dateBlocks.some(b => slotMinutes >= b.startMinutes && slotMinutes < b.endMinutes)
  }, [getBlocksForDate])

  const createBlock = useCallback(async (blockData: Omit<BlockedPeriod, 'id' | 'created_at'>): Promise<BlockedPeriod | null> => {
    try {
      const res = await fetch('/api/blocked-periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockData),
      })
      const json = await res.json()
      if (json.success) {
        await mutate()
        return json.block
      }
      return null
    } catch {
      return null
    }
  }, [mutate])

  const deleteBlock = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/blocked-periods/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        await mutate()
        return true
      }
      return false
    } catch {
      return false
    }
  }, [mutate])

  return {
    blocks,
    loading: isLoading,
    isSlotBlocked,
    getBlocksForDate,
    createBlock,
    deleteBlock,
    refresh: () => mutate(),
  }
}
