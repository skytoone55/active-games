import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const { id: orderId } = await params

    // Parse request body to check for allowToggleOff and checkOnly flags
    const body = await request.json().catch(() => ({}))
    const { allowToggleOff, checkOnly } = body

    // Récupérer l'état actuel
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('is_out')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Si c'est juste une vérification, retourner l'état actuel sans modifier
    if (checkOnly) {
      return NextResponse.json({
        success: true,
        is_out: order.is_out || false
      })
    }

    // Si l'ordre est déjà OUT et qu'on essaie de le remettre IN sans le flag allowToggleOff
    if (order.is_out && !allowToggleOff) {
      return NextResponse.json(
        {
          error: 'Cannot toggle OUT status back to IN from agenda. Use data-management section.',
          is_out: order.is_out,
          blocked: true
        },
        { status: 403 }
      )
    }

    // Toggle le statut
    const newStatus = !order.is_out

    const { error: updateError } = await supabase
      .from('orders')
      .update({ is_out: newStatus })
      .eq('id', orderId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update OUT status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      is_out: newStatus
    })

  } catch (error) {
    console.error('Error in toggle-out:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
