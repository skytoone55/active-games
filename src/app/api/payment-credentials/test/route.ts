import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ICountClient } from '@/lib/payment-provider'

// Create a raw Supabase client
function createRawServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Helper to check if user is super_admin
async function checkSuperAdmin(userId: string): Promise<boolean> {
  const serviceClient = createRawServiceClient()
  const { data } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'super_admin'
}

// POST - Test iCount API connection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await checkSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { cid, username, password, branch_id } = body

    if (!cid || !username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    // Use the ICountClient from the payment-provider lib
    const client = new ICountClient({
      cid: cid,
      user: username,
      pass: password
    })

    const result = await client.testConnection()

    // Update connection status in database if branch_id provided
    if (branch_id) {
      const serviceClient = createRawServiceClient()
      await serviceClient
        .from('payment_credentials')
        .update({
          last_connection_test: new Date().toISOString(),
          last_connection_status: result.success,
          last_connection_error: result.success ? null : (result.error?.message || 'Connection failed')
        })
        .eq('branch_id', branch_id)
        .eq('provider', 'icount')
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.error?.message || 'Connection failed'
      })
    }
  } catch (error) {
    console.error('Error testing iCount connection:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed'
    })
  }
}
