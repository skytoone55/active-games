import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const searchOrderByPhone = tool({
  description: 'Search for existing orders by customer phone number. Returns recent orders with status, date, reference.',
  inputSchema: z.object({
    phone: z.string().min(6).describe('Customer phone number'),
    branchId: z.string().optional().describe('Branch ID to filter (optional)'),
  }),
  execute: async ({ phone, branchId }) => {
    let query = supabase
      .from('orders')
      .select('id, request_reference, order_type, status, requested_date, requested_time, participants_count, game_area, customer_first_name, customer_email, total_amount, created_at')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(5)

    if (branchId) query = query.eq('branch_id', branchId)

    const { data, error } = await query

    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) return { success: true, orders: [], message: 'No orders found for this phone number.' }

    const orders = data.map(o => ({
      reference: o.request_reference,
      type: o.order_type,
      status: o.status,
      date: o.requested_date,
      time: o.requested_time,
      participants: o.participants_count,
      gameArea: o.game_area,
      name: o.customer_first_name,
      email: o.customer_email,
      amount: o.total_amount,
      createdAt: o.created_at,
    }))

    return { success: true, orders, message: `Found ${orders.length} order(s).` }
  },
})
