/**
 * CRON Job: Cleanup Expired Payments
 *
 * Marque comme 'failed' tous les payments PayPages expirés (> 2h10)
 * Exécuté 1x/jour par Vercel Cron
 *
 * Note: Le nettoyage principal se fait dans /api/public/initiate-payment
 * Ce CRON est juste un filet de sécurité pour nettoyer les vieux payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Vérifier le CRON_SECRET
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CLEANUP-PAYMENTS] Starting cleanup...')

    // Marquer comme failed les payments expirés (> 2h10 pour avoir une marge)
    const expirationThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000 - 10 * 60 * 1000)

    const { data: expiredPayments, error: selectError } = await supabase
      .from('payments')
      .select('id, order_id, amount, created_at')
      .eq('status', 'pending')
      .eq('payment_method', 'paypage')
      .lt('created_at', expirationThreshold.toISOString())

    if (selectError) {
      console.error('[CLEANUP-PAYMENTS] Error fetching expired payments:', selectError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      console.log('[CLEANUP-PAYMENTS] No expired payments found')
      return NextResponse.json({
        success: true,
        message: 'No expired payments',
        cleaned: 0,
      })
    }

    console.log(`[CLEANUP-PAYMENTS] Found ${expiredPayments.length} expired payments`)

    // Marquer comme failed
    const paymentIds = expiredPayments.map(p => p.id)
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        notes: 'Payment link expired (cleaned by CRON)',
        updated_at: new Date().toISOString(),
      })
      .in('id', paymentIds)

    if (updateError) {
      console.error('[CLEANUP-PAYMENTS] Error updating payments:', updateError)
      return NextResponse.json({ error: 'Failed to update payments' }, { status: 500 })
    }

    console.log(`[CLEANUP-PAYMENTS] Cleaned ${expiredPayments.length} expired payments`)

    return NextResponse.json({
      success: true,
      message: 'Expired payments cleaned',
      cleaned: expiredPayments.length,
      payment_ids: paymentIds,
    })

  } catch (error) {
    console.error('[CLEANUP-PAYMENTS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
