import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create a raw Supabase client that doesn't have typed tables
// This is needed because payment_credentials table isn't in the generated types yet
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

// GET - Fetch credentials for a branch
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await checkSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 })
    }

    const serviceClient = createRawServiceClient()
    const { data, error } = await serviceClient
      .from('payment_credentials')
      .select('*')
      .eq('branch_id', branchId)
      .eq('provider', 'icount')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error
    }

    // Mask password in response
    if (data) {
      return NextResponse.json({
        ...data,
        password: '••••••••' // Never return actual password
      })
    }

    return NextResponse.json(null)
  } catch (error) {
    console.error('Error fetching payment credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update credentials
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
    const { branch_id, cid, username, password } = body

    if (!branch_id || !cid || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceClient = createRawServiceClient()

    // Check if credentials already exist
    const { data: existing } = await serviceClient
      .from('payment_credentials')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('provider', 'icount')
      .single()

    // Determine if password should be updated:
    // - Skip if empty, null, or the masked placeholder '••••••••'
    const isRealPassword = password && password !== '••••••••'

    let result
    if (existing) {
      // Update existing — only include password if a real new one was provided
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {
        cid,
        username,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }
      if (isRealPassword) {
        updatePayload.password = password
      }

      const { data, error } = await serviceClient
        .from('payment_credentials')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // New credentials require a real password
      if (!isRealPassword) {
        return NextResponse.json({ error: 'Password is required for new credentials' }, { status: 400 })
      }
      // Create new
      const { data, error } = await serviceClient
        .from('payment_credentials')
        .insert({
          branch_id,
          provider: 'icount',
          cid,
          username,
          password,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      ...result,
      password: '••••••••'
    })
  } catch (error) {
    console.error('Error saving payment credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove credentials
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await checkSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 })
    }

    const serviceClient = createRawServiceClient()

    const { data: existing } = await serviceClient
      .from('payment_credentials')
      .select('id')
      .eq('branch_id', branchId)
      .eq('provider', 'icount')
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Credentials not found' }, { status: 404 })
    }

    const { error } = await serviceClient
      .from('payment_credentials')
      .delete()
      .eq('id', existing.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
