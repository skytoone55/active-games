import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est super_admin
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const profile = profileData as { role: string } | null
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Accès réservé aux super administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const { branchIds, startDate, endDate } = body

    console.log('[OUT-ORDERS] Request params:', { branchIds, startDate, endDate })

    if (!branchIds || !Array.isArray(branchIds) || branchIds.length === 0) {
      console.error('[OUT-ORDERS] No branches selected')
      return NextResponse.json({ success: false, error: 'Veuillez sélectionner au moins une branche' }, { status: 400 })
    }

    // Test simple query first
    console.log('[OUT-ORDERS] Testing simple query...')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: testOrders, error: testError } = await (supabase as any)
      .from('orders')
      .select('id, is_out, branch_id')
      .eq('is_out', true)

    console.log('[OUT-ORDERS] Test query result:', { count: testOrders?.length, error: testError })

    // Construire la requête de base
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('orders')
      .select(`
        *,
        booking:bookings(
          id,
          reference_code,
          type,
          participants_count,
          start_datetime,
          end_datetime
        ),
        contact:contacts(
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .eq('is_out', true)
      .in('branch_id', branchIds)

    // Ajouter les filtres de date si fournis
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Trier par date de création décroissante
    query = query.order('created_at', { ascending: false })

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      console.error('[OUT-ORDERS] Error fetching orders:', ordersError)
      console.error('[OUT-ORDERS] Error details:', JSON.stringify(ordersError, null, 2))
      return NextResponse.json({ success: false, error: `Erreur lors de la récupération des commandes: ${ordersError.message}` }, { status: 500 })
    }

    console.log('[OUT-ORDERS] Successfully fetched orders:', orders?.length || 0)

    // Calculer les statistiques
    let totalGames = 0
    let totalPlayers = 0
    let totalRevenue = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders?.forEach((order: any) => {
      // Nombre de parties
      if (order.number_of_games) {
        totalGames += order.number_of_games
      }

      // Nombre de joueurs
      if (order.booking?.participants_count) {
        totalPlayers += order.booking.participants_count
      }

      // Chiffre d'affaires - récupérer depuis le booking s'il existe
      // Note: Le total peut être dans order.total_amount ou calculé depuis les paiements
      // Pour l'instant on utilise les données disponibles
      if (order.booking?.participants_count && order.number_of_games) {
        // Estimation basique - à ajuster selon la logique métier
        totalRevenue += order.booking.participants_count * order.number_of_games * 50 // Prix moyen estimé
      }
    })

    return NextResponse.json({
      success: true,
      orders: orders || [],
      stats: {
        totalOrders: orders?.length || 0,
        totalGames,
        totalPlayers,
        totalRevenue
      }
    })

  } catch (error) {
    console.error('[OUT-ORDERS] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
