import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** GET /api/blocked-periods?branchId=xxx — liste tous les blocages d'une branche */
export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get('branchId')
  if (!branchId) {
    return NextResponse.json({ success: false, error: 'branchId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('blocked_time_periods')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[blocked-periods] GET error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, blocks: data })
}

/** POST /api/blocked-periods — crée un nouveau blocage */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      branch_id,
      label,
      is_recurring,
      start_datetime,
      end_datetime,
      recurrence_days,
      recurrence_start_time,
      recurrence_end_time,
      recurrence_valid_from,
      recurrence_valid_until,
      created_by,
    } = body

    if (!branch_id) {
      return NextResponse.json({ success: false, error: 'branch_id required' }, { status: 400 })
    }

    if (!is_recurring && (!start_datetime || !end_datetime)) {
      return NextResponse.json(
        { success: false, error: 'start_datetime and end_datetime required for one-time blocks' },
        { status: 400 }
      )
    }

    if (is_recurring && (!recurrence_days?.length || !recurrence_start_time || !recurrence_end_time)) {
      return NextResponse.json(
        { success: false, error: 'recurrence_days, start_time and end_time required for recurring blocks' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('blocked_time_periods')
      .insert({
        branch_id,
        label: label || '',
        is_recurring: !!is_recurring,
        start_datetime: is_recurring ? null : start_datetime,
        end_datetime: is_recurring ? null : end_datetime,
        recurrence_days: is_recurring ? recurrence_days : null,
        recurrence_start_time: is_recurring ? recurrence_start_time : null,
        recurrence_end_time: is_recurring ? recurrence_end_time : null,
        recurrence_valid_from: is_recurring ? (recurrence_valid_from || null) : null,
        recurrence_valid_until: is_recurring ? (recurrence_valid_until || null) : null,
        created_by: created_by || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[blocked-periods] POST error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, block: data })
  } catch (err) {
    console.error('[blocked-periods] POST exception:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
