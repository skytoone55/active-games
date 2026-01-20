'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ICountProduct {
  id: string
  code: string
  name: string
  name_he?: string
  unit_price: number
}

export interface ICountEventFormula {
  id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
  room_id?: string
  product_id?: string
}

export interface ICountRoom {
  id: string
  name: string
  name_he?: string
  price: number
}

export interface PricingData {
  products: ICountProduct[]
  eventFormulas: ICountEventFormula[]
  rooms: ICountRoom[]
  loading: boolean
  error: string | null
}

/**
 * Hook to load pricing data (products, event formulas, rooms) for a branch
 */
export function usePricingData(branchId: string): PricingData {
  const [products, setProducts] = useState<ICountProduct[]>([])
  const [eventFormulas, setEventFormulas] = useState<ICountEventFormula[]>([])
  const [rooms, setRooms] = useState<ICountRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) {
      setLoading(false)
      return
    }

    const loadPricingData = async () => {
      setLoading(true)
      setError(null)

      const supabase = createClient()

      try {
        // Load all data in parallel
        const [productsRes, formulasRes, roomsRes] = await Promise.all([
          supabase
            .from('icount_products')
            .select('id, code, name, name_he, unit_price')
            .eq('branch_id', branchId)
            .eq('is_active', true),
          supabase
            .from('icount_event_formulas')
            .select('id, name, game_type, min_participants, max_participants, price_per_person, room_id, product_id')
            .eq('branch_id', branchId)
            .eq('is_active', true),
          supabase
            .from('icount_rooms')
            .select('id, name, name_he, price')
            .eq('branch_id', branchId)
            .eq('is_active', true)
        ])

        if (productsRes.error) throw productsRes.error
        if (formulasRes.error) throw formulasRes.error
        if (roomsRes.error) throw roomsRes.error

        setProducts(productsRes.data || [])
        setEventFormulas(formulasRes.data || [])
        setRooms(roomsRes.data || [])
      } catch (err) {
        console.error('[usePricingData] Error loading pricing data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pricing data')
      } finally {
        setLoading(false)
      }
    }

    loadPricingData()
  }, [branchId])

  return { products, eventFormulas, rooms, loading, error }
}
