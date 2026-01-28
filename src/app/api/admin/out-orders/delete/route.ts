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
    const { orderIds, deleteContacts } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun ordre sélectionné' }, { status: 400 })
    }

    // Utiliser le client service role pour bypass RLS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = createServiceRoleClient() as any

    const deletedCounts = {
      booking_slots: 0,
      game_sessions: 0,
      bookings: 0,
      payments: 0,
      orders: 0,
      contacts: 0
    }

    const errors: string[] = []

    // 1. Récupérer tous les bookings et contacts liés aux orders
    const { data: ordersData } = await supabaseAdmin
      .from('orders')
      .select('id, booking_id, contact_id')
      .in('id', orderIds)

    const orders = (ordersData || []) as { id: string; booking_id: string | null; contact_id: string | null }[]

    const bookingIds = orders.map(o => o.booking_id).filter(Boolean) as string[]
    const contactIds = deleteContacts ? orders.map(o => o.contact_id).filter(Boolean) as string[] : []

    // 2. Supprimer booking_slots
    if (bookingIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('booking_slots')
        .delete({ count: 'exact' })
        .in('booking_id', bookingIds)

      if (error) {
        console.error('[DELETE-OUT-ORDERS] booking_slots error:', error)
        errors.push(`booking_slots: ${error.message}`)
      } else {
        deletedCounts.booking_slots = count || 0
      }
    }

    // 3. Supprimer game_sessions
    if (bookingIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('game_sessions')
        .delete({ count: 'exact' })
        .in('booking_id', bookingIds)

      if (error) {
        console.error('[DELETE-OUT-ORDERS] game_sessions error:', error)
        errors.push(`game_sessions: ${error.message}`)
      } else {
        deletedCounts.game_sessions = count || 0
      }
    }

    // 4. Supprimer payments liés aux orders
    const { count: paymentsCount, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .delete({ count: 'exact' })
      .in('order_id', orderIds)

    if (paymentsError) {
      console.error('[DELETE-OUT-ORDERS] payments error:', paymentsError)
      errors.push(`payments: ${paymentsError.message}`)
    } else {
      deletedCounts.payments = paymentsCount || 0
    }

    // 5. Supprimer bookings
    if (bookingIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('bookings')
        .delete({ count: 'exact' })
        .in('id', bookingIds)

      if (error) {
        console.error('[DELETE-OUT-ORDERS] bookings error:', error)
        errors.push(`bookings: ${error.message}`)
      } else {
        deletedCounts.bookings = count || 0
      }
    }

    // 6. Supprimer orders
    const { count: ordersCount, error: ordersError } = await supabaseAdmin
      .from('orders')
      .delete({ count: 'exact' })
      .in('id', orderIds)

    if (ordersError) {
      console.error('[DELETE-OUT-ORDERS] orders error:', ordersError)
      errors.push(`orders: ${ordersError.message}`)
    } else {
      deletedCounts.orders = ordersCount || 0
    }

    // 7. Supprimer contacts si demandé
    if (deleteContacts && contactIds.length > 0) {
      const { count, error } = await supabaseAdmin
        .from('contacts')
        .delete({ count: 'exact' })
        .in('id', contactIds)

      if (error) {
        console.error('[DELETE-OUT-ORDERS] contacts error:', error)
        errors.push(`contacts: ${error.message}`)
      } else {
        deletedCounts.contacts = count || 0
      }
    }

    // Logger l'action
    try {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: user.id,
        branch_id: null,
        action: 'out_orders_deletion',
        entity_type: 'orders',
        entity_id: null,
        details: {
          order_ids: orderIds,
          delete_contacts: deleteContacts,
          deleted_counts: deletedCounts,
          errors: errors.length > 0 ? errors : undefined
        }
      })
    } catch (logError) {
      console.error('[DELETE-OUT-ORDERS] Error logging deletion:', logError)
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: errors.join(', '),
        deleted: deletedCounts
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCounts
    })

  } catch (error) {
    console.error('[DELETE-OUT-ORDERS] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur lors de la suppression' },
      { status: 500 }
    )
  }
}
