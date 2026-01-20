import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Accès réservé aux super administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const { branchIds, includeNullBranch = true } = body

    if (!branchIds || !Array.isArray(branchIds) || branchIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Veuillez sélectionner au moins une branche' }, { status: 400 })
    }

    // Utiliser le client service role pour bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Compter les données pour chaque catégorie
    const counts = {
      logs: 0,
      emails: 0,
      orders: 0,
      bookings: 0,
      game_sessions: 0,
      booking_slots: 0,
      contacts: 0
    }

    // Helper pour créer une requête qui inclut branch_id IN (...) OR branch_id IS NULL
    // Supabase ne supporte pas OR facilement, donc on fait 2 requêtes

    // Logs (activity_logs)
    const { count: logsCount1, error: logsError1 } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', branchIds)

    console.log('[COUNTS] activity_logs with branchIds:', logsCount1, 'error:', logsError1)

    let logsCountNull = 0
    if (includeNullBranch) {
      const { count, error } = await supabaseAdmin
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .is('branch_id', null)
      logsCountNull = count || 0
      console.log('[COUNTS] activity_logs with null branch:', count, 'error:', error)
    }
    counts.logs = (logsCount1 || 0) + logsCountNull

    // Debug: compter TOUS les logs pour voir s'il y en a qui échappent
    const { count: totalLogsCount } = await supabaseAdmin
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
    console.log('[COUNTS] TOTAL activity_logs in DB:', totalLogsCount)

    // Emails (email_logs)
    const { count: emailsCount1 } = await supabaseAdmin
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', branchIds)

    let emailsCountNull = 0
    if (includeNullBranch) {
      const { count } = await supabaseAdmin
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .is('branch_id', null)
      emailsCountNull = count || 0
    }
    counts.emails = (emailsCount1 || 0) + emailsCountNull

    // Orders
    const { count: ordersCount1 } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('branch_id', branchIds)

    let ordersCountNull = 0
    if (includeNullBranch) {
      const { count } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .is('branch_id', null)
      ordersCountNull = count || 0
    }
    counts.orders = (ordersCount1 || 0) + ordersCountNull

    // Bookings
    const { data: bookingData1, count: bookingsCount1 } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact' })
      .in('branch_id', branchIds)

    let bookingDataNull: { id: string }[] = []
    let bookingsCountNull = 0
    if (includeNullBranch) {
      const { data, count } = await supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact' })
        .is('branch_id', null)
      bookingDataNull = data || []
      bookingsCountNull = count || 0
    }
    counts.bookings = (bookingsCount1 || 0) + bookingsCountNull

    // Game Sessions et Booking Slots - via booking_id
    const allBookingIds = [
      ...(bookingData1?.map(b => b.id) || []),
      ...bookingDataNull.map(b => b.id)
    ]

    if (allBookingIds.length > 0) {
      // Game Sessions
      const { count: gameSessionsCount } = await supabaseAdmin
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .in('booking_id', allBookingIds)
      counts.game_sessions = gameSessionsCount || 0

      // Booking Slots
      const { count: slotsCount } = await supabaseAdmin
        .from('booking_slots')
        .select('*', { count: 'exact', head: true })
        .in('booking_id', allBookingIds)
      counts.booking_slots = slotsCount || 0
    }

    // Contacts - utilise branch_id_main (pas branch_id)
    const { count: contactsCount1 } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .in('branch_id_main', branchIds)

    let contactsCountNull = 0
    if (includeNullBranch) {
      const { count } = await supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('branch_id_main', null)
      contactsCountNull = count || 0
    }
    counts.contacts = (contactsCount1 || 0) + contactsCountNull

    console.log('[COUNTS] Final counts:', counts)

    return NextResponse.json({
      success: true,
      counts
    })

  } catch (error) {
    console.error('[DATA-MANAGEMENT] Error getting counts:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
