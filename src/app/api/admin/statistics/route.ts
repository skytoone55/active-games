/**
 * API pour récupérer les statistiques agrégées
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

// Helper to get date range
function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  let start = new Date(now)
  start.setHours(0, 0, 0, 0)

  switch (range) {
    case 'today':
      // Already set to today
      break
    case 'week':
      start.setDate(start.getDate() - start.getDay()) // Start of week (Sunday)
      break
    case 'month':
      start.setDate(1)
      break
    case 'quarter':
      const quarter = Math.floor(start.getMonth() / 3)
      start.setMonth(quarter * 3, 1)
      break
    case 'year':
      start.setMonth(0, 1)
      break
    case 'all':
      start = new Date('2020-01-01')
      break
  }

  return { start, end }
}

// Helper to format month
function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// Helper to get day name
function getDayName(dayIndex: number): string {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  return days[dayIndex]
}

export async function GET(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success) {
      return errorResponse
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'
    const branchId = searchParams.get('branch')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const { start, end } = getDateRange(range)

    // Build base query conditions
    const baseConditions = {
      branch: branchId && branchId !== 'all' ? branchId : null,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }

    // === ORDERS DATA ===
    let ordersQuery = supabase
      .from('orders')
      .select('id, total_amount, paid_amount, payment_status, status, order_type, created_at, branch_id, contact_id, created_by')
      .gte('created_at', baseConditions.startDate)
      .lte('created_at', baseConditions.endDate)

    if (baseConditions.branch) {
      ordersQuery = ordersQuery.eq('branch_id', baseConditions.branch)
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 })
    }

    // === CONTACTS DATA ===
    let contactsQuery = supabase
      .from('contacts')
      .select('id, created_at, first_name, last_name')

    if (baseConditions.branch) {
      contactsQuery = contactsQuery.eq('branch_id', baseConditions.branch)
    }

    const { data: contacts, error: contactsError } = await contactsQuery

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
    }

    // === USERS DATA ===
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')

    const userMap = new Map<string, string>(users?.map((u: { id: string; first_name: string; last_name: string }) =>
      [u.id, `${u.first_name} ${u.last_name}`]
    ) || [])

    // === BRANCHES DATA ===
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')

    const branchMap = new Map<string, string>(branches?.map((b: { id: string; name: string }) => [b.id, b.name]) || [])

    // === CALCULATE STATS ===

    // Revenue
    const totalRevenue = orders?.reduce((sum: number, o: { total_amount: number | null }) => sum + (o.total_amount || 0), 0) || 0
    const paidRevenue = orders?.reduce((sum: number, o: { paid_amount: number | null }) => sum + (o.paid_amount || 0), 0) || 0
    const pendingRevenue = totalRevenue - paidRevenue
    const totalOrders = orders?.length || 0
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Orders by status
    const statusCounts: Record<string, number> = {}
    orders?.forEach((o: { status: string }) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
    })
    const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    // Orders by type
    const typeCounts: Record<string, number> = {}
    orders?.forEach((o: { order_type: string }) => {
      typeCounts[o.order_type] = (typeCounts[o.order_type] || 0) + 1
    })
    const ordersByType = Object.entries(typeCounts).map(([type, count]) => ({ type, count }))

    // Orders by month (last 12 months)
    const monthlyData: Record<string, { count: number; revenue: number }> = {}
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = formatMonth(d)
      monthlyData[key] = { count: 0, revenue: 0 }
    }
    orders?.forEach((o: { created_at: string; total_amount: number | null }) => {
      const date = new Date(o.created_at)
      const key = formatMonth(date)
      if (monthlyData[key]) {
        monthlyData[key].count++
        monthlyData[key].revenue += o.total_amount || 0
      }
    })
    const ordersByMonth = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      count: data.count,
      revenue: data.revenue
    }))

    // Orders by branch
    const branchData: Record<string, { count: number; revenue: number }> = {}
    orders?.forEach((o: { branch_id: string; total_amount: number | null }) => {
      const branchName: string = branchMap.get(o.branch_id) || 'Unknown'
      if (!branchData[branchName]) {
        branchData[branchName] = { count: 0, revenue: 0 }
      }
      branchData[branchName].count++
      branchData[branchName].revenue += o.total_amount || 0
    })
    const ordersByBranch = Object.entries(branchData)
      .map(([branch, data]) => ({ branch, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    // Clients stats
    const totalClients = contacts?.length || 0
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newClientsThisMonth = contacts?.filter((c: { created_at: string }) =>
      new Date(c.created_at) >= monthStart
    ).length || 0

    // Returning clients (those with more than 1 order)
    const clientOrderCounts: Record<string, number> = {}
    orders?.forEach((o: { contact_id: string | null }) => {
      if (o.contact_id) {
        clientOrderCounts[o.contact_id] = (clientOrderCounts[o.contact_id] || 0) + 1
      }
    })
    const returningClients = Object.values(clientOrderCounts).filter(count => count > 1).length

    // Top clients
    const clientRevenue: Record<string, { name: string; orders: number; revenue: number }> = {}
    orders?.forEach((o: { contact_id: string | null; total_amount: number | null }) => {
      if (o.contact_id) {
        if (!clientRevenue[o.contact_id]) {
          const contact = contacts?.find((c: { id: string }) => c.id === o.contact_id)
          clientRevenue[o.contact_id] = {
            name: contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown',
            orders: 0,
            revenue: 0
          }
        }
        clientRevenue[o.contact_id].orders++
        clientRevenue[o.contact_id].revenue += o.total_amount || 0
      }
    })
    const topClients = Object.values(clientRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Orders by user
    const userOrderCounts: Record<string, number> = {}
    orders?.forEach((o: { created_by: string | null }) => {
      if (o.created_by) {
        const userName = userMap.get(o.created_by) || 'Unknown'
        userOrderCounts[userName] = (userOrderCounts[userName] || 0) + 1
      }
    })
    const ordersByUser = Object.entries(userOrderCounts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)

    // Popular days
    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    orders?.forEach((o: { created_at: string }) => {
      const day = new Date(o.created_at).getDay()
      dayCounts[day]++
    })
    const popularDays = Object.entries(dayCounts).map(([day, count]) => ({
      day: getDayName(parseInt(day)),
      count
    }))

    // Popular hours
    const hourCounts: Record<number, number> = {}
    for (let i = 9; i <= 22; i++) {
      hourCounts[i] = 0
    }
    orders?.forEach((o: { created_at: string }) => {
      const hour = new Date(o.created_at).getHours()
      if (hourCounts[hour] !== undefined) {
        hourCounts[hour]++
      }
    })
    const popularHours = Object.entries(hourCounts).map(([hour, count]) => ({
      hour: `${hour}h`,
      count
    }))

    return NextResponse.json({
      success: true,
      stats: {
        // Revenue
        totalRevenue,
        totalOrders,
        paidRevenue,
        pendingRevenue,
        averageOrderValue,
        // Orders
        ordersByStatus,
        ordersByType,
        ordersByMonth,
        ordersByBranch,
        // Clients
        totalClients,
        newClientsThisMonth,
        returningClients,
        topClients,
        // Users
        ordersByUser,
        // Time
        popularDays,
        popularHours
      }
    })

  } catch (error) {
    console.error('Error in statistics API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
