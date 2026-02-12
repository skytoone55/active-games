/**
 * GET /api/public/messenger/status
 * Public endpoint to check if messenger widget is active
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const { data } = await supabase
      .from('messenger_settings')
      .select('is_active')
      .single()

    return NextResponse.json({ active: data?.is_active ?? true })
  } catch {
    return NextResponse.json({ active: true }) // default to active on error
  }
}
