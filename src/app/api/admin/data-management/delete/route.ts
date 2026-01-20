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
    const { branchIds, groups, password, includeNullBranch = true } = body

    // Support ancien format (group unique) et nouveau format (groups multiples)
    const groupsToDelete: string[] = groups || (body.group ? [body.group] : [])

    if (!branchIds || !Array.isArray(branchIds) || branchIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Veuillez sélectionner au moins une branche' }, { status: 400 })
    }

    if (!groupsToDelete.length || !groupsToDelete.every(g => ['logs', 'reservations', 'contacts'].includes(g))) {
      return NextResponse.json({ success: false, error: 'Groupe de suppression invalide' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ success: false, error: 'Mot de passe requis' }, { status: 400 })
    }

    // Vérifier le mot de passe
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (signInError) {
      return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 })
    }

    // Utiliser le client service role pour bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    const deletedCounts = {
      logs: 0,
      emails: 0,
      orders: 0,
      bookings: 0,
      game_sessions: 0,
      booking_slots: 0,
      contacts: 0
    }

    const errors: string[] = []

    // Helper pour supprimer avec branch_id IN (...) OR branch_id IS NULL
    async function deleteWithNullBranch(table: string, branchColumn = 'branch_id'): Promise<number> {
      let total = 0

      // Supprimer ceux avec branch_id dans la liste
      const { count: count1, error: error1 } = await supabaseAdmin
        .from(table)
        .delete({ count: 'exact' })
        .in(branchColumn, branchIds)

      if (error1) {
        console.error(`[DELETE] ${table} (in branchIds) error:`, error1)
        errors.push(`${table}: ${error1.message}`)
      } else {
        total += count1 || 0
      }

      // Supprimer ceux avec branch_id NULL
      if (includeNullBranch) {
        const { count: count2, error: error2 } = await supabaseAdmin
          .from(table)
          .delete({ count: 'exact' })
          .is(branchColumn, null)

        if (error2) {
          console.error(`[DELETE] ${table} (null branch) error:`, error2)
          errors.push(`${table} (null): ${error2.message}`)
        } else {
          total += count2 || 0
        }
      }

      return total
    }

    // Ordre de suppression important: logs d'abord, puis reservations, puis contacts

    // 1. LOGS
    if (groupsToDelete.includes('logs')) {
      deletedCounts.logs = await deleteWithNullBranch('activity_logs')
      deletedCounts.emails = await deleteWithNullBranch('email_logs')
    }

    // 2. RESERVATIONS (ordre: slots → sessions → bookings → orders)
    if (groupsToDelete.includes('reservations')) {
      // Récupérer tous les bookings
      const { data: bookings1 } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .in('branch_id', branchIds)

      let bookingsNull: { id: string }[] = []
      if (includeNullBranch) {
        const { data } = await supabaseAdmin
          .from('bookings')
          .select('id')
          .is('branch_id', null)
        bookingsNull = data || []
      }

      const allBookingIds = [
        ...(bookings1?.map(b => b.id) || []),
        ...bookingsNull.map(b => b.id)
      ]

      // Récupérer tous les orders
      const { data: orders1 } = await supabaseAdmin
        .from('orders')
        .select('id')
        .in('branch_id', branchIds)

      let ordersNull: { id: string }[] = []
      if (includeNullBranch) {
        const { data } = await supabaseAdmin
          .from('orders')
          .select('id')
          .is('branch_id', null)
        ordersNull = data || []
      }

      const allOrderIds = [
        ...(orders1?.map(o => o.id) || []),
        ...ordersNull.map(o => o.id)
      ]

      // 2.1 Supprimer booking_slots
      if (allBookingIds.length > 0) {
        const { count, error } = await supabaseAdmin
          .from('booking_slots')
          .delete({ count: 'exact' })
          .in('booking_id', allBookingIds)

        if (error) {
          console.error('[DELETE] booking_slots error:', error)
          errors.push(`booking_slots: ${error.message}`)
        } else {
          deletedCounts.booking_slots = count || 0
        }
      }

      // 2.2 Supprimer game_sessions
      if (allBookingIds.length > 0) {
        const { count, error } = await supabaseAdmin
          .from('game_sessions')
          .delete({ count: 'exact' })
          .in('booking_id', allBookingIds)

        if (error) {
          console.error('[DELETE] game_sessions error:', error)
          errors.push(`game_sessions: ${error.message}`)
        } else {
          deletedCounts.game_sessions = count || 0
        }
      }

      // 2.3 Supprimer bookings
      if (allBookingIds.length > 0) {
        const { count, error } = await supabaseAdmin
          .from('bookings')
          .delete({ count: 'exact' })
          .in('id', allBookingIds)

        if (error) {
          console.error('[DELETE] bookings error:', error)
          errors.push(`bookings: ${error.message}`)
        } else {
          deletedCounts.bookings = count || 0
        }
      }

      // 2.4 Supprimer orders
      if (allOrderIds.length > 0) {
        const { count, error } = await supabaseAdmin
          .from('orders')
          .delete({ count: 'exact' })
          .in('id', allOrderIds)

        if (error) {
          console.error('[DELETE] orders error:', error)
          errors.push(`orders: ${error.message}`)
        } else {
          deletedCounts.orders = count || 0
        }
      }
    }

    // 3. CONTACTS - utilise branch_id_main (pas branch_id)
    if (groupsToDelete.includes('contacts')) {
      // Vérifier qu'il n'y a plus de réservations liées
      const { count: remainingOrders1 } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('branch_id', branchIds)

      let remainingOrdersNull = 0
      if (includeNullBranch) {
        const { count } = await supabaseAdmin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .is('branch_id', null)
        remainingOrdersNull = count || 0
      }

      const totalRemainingOrders = (remainingOrders1 || 0) + remainingOrdersNull

      if (totalRemainingOrders > 0 && !groupsToDelete.includes('reservations')) {
        errors.push(`Impossible de supprimer les contacts: ${totalRemainingOrders} commandes sont encore liées`)
      } else {
        // Contacts utilise branch_id_main pas branch_id
        let contactsTotal = 0

        const { count: count1, error: error1 } = await supabaseAdmin
          .from('contacts')
          .delete({ count: 'exact' })
          .in('branch_id_main', branchIds)

        if (error1) {
          console.error('[DELETE] contacts (in branchIds) error:', error1)
          errors.push(`contacts: ${error1.message}`)
        } else {
          contactsTotal += count1 || 0
        }

        if (includeNullBranch) {
          const { count: count2, error: error2 } = await supabaseAdmin
            .from('contacts')
            .delete({ count: 'exact' })
            .is('branch_id_main', null)

          if (error2) {
            console.error('[DELETE] contacts (null branch) error:', error2)
            errors.push(`contacts (null): ${error2.message}`)
          } else {
            contactsTotal += count2 || 0
          }
        }

        deletedCounts.contacts = contactsTotal
      }
    }

    // Logger l'action
    try {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: user.id,
        branch_id: branchIds[0],
        action: 'data_deletion',
        entity_type: 'system',
        entity_id: null,
        details: {
          groups: groupsToDelete,
          branches: branchIds,
          includeNullBranch,
          deleted_counts: deletedCounts,
          errors: errors.length > 0 ? errors : undefined
        }
      })
    } catch (logError) {
      console.error('[DATA-MANAGEMENT] Error logging deletion:', logError)
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
    console.error('[DATA-MANAGEMENT] Error deleting data:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur lors de la suppression' },
      { status: 500 }
    )
  }
}
