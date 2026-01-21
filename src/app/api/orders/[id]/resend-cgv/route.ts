/**
 * API Route pour renvoyer un rappel CGV pour une commande admin
 * POST: Envoie un email de rappel CGV au client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiPermission } from '@/lib/permissions'
import { sendEmail } from '@/lib/email-sender'
import type { Branch } from '@/lib/supabase/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params

    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        request_reference,
        customer_first_name,
        customer_last_name,
        customer_email,
        cgv_token,
        cgv_validated_at,
        cgv_reminder_count,
        requested_date,
        requested_time,
        participants_count,
        source,
        branch_id
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Commande non trouvée' },
        { status: 404 }
      )
    }

    // BLOQUER si la commande est fermée
    if (order.status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'Cannot resend CGV on a closed order', messageKey: 'errors.orderClosed' },
        { status: 400 }
      )
    }

    // Vérifier que c'est une commande admin
    if (order.source !== 'admin_agenda') {
      return NextResponse.json(
        { success: false, error: 'Cette commande n\'est pas une commande admin' },
        { status: 400 }
      )
    }

    // Vérifier que le client a un email
    if (!order.customer_email) {
      return NextResponse.json(
        { success: false, error: 'Le client n\'a pas d\'adresse email' },
        { status: 400 }
      )
    }

    // Vérifier que les CGV ne sont pas déjà validées
    if (order.cgv_validated_at) {
      return NextResponse.json(
        { success: false, error: 'Les CGV ont déjà été validées' },
        { status: 400 }
      )
    }

    // Vérifier qu'il y a un token CGV
    if (!order.cgv_token) {
      return NextResponse.json(
        { success: false, error: 'Pas de token CGV pour cette commande' },
        { status: 400 }
      )
    }

    // Récupérer la branche
    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', order.branch_id)
      .single()

    const branchData = branch as Branch | null

    // URL de base pour les liens CGV
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'
    const cgvUrl = `${baseUrl}/cgv/${order.cgv_token}`
    const reminderNumber = (order.cgv_reminder_count || 0) + 1

    // Générer le HTML du rappel (en hébreu)
    const subject = `[תזכורת] אישור תנאים - הזמנה ${order.request_reference}`

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 20px; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(0, 240, 255, 0.2);">

          <!-- Header avec logos -->
          <div style="padding: 30px; text-align: center; background: linear-gradient(135deg, #00f0ff20 0%, transparent 100%);">
            <div style="display: inline-block; margin: 0 10px;">
              <img src="${baseUrl}/images/logo-activegames.png" alt="Active Games" style="height: 50px; width: auto;">
            </div>
            <div style="display: inline-block; margin: 0 10px;">
              <img src="${baseUrl}/images/logo_laser_city.png" alt="Laser City" style="height: 50px; width: auto;">
            </div>
          </div>

          <!-- Contenu principal -->
          <div style="padding: 30px;">
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; border: 2px solid #f59e0b; margin-bottom: 25px;">
              <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">⚠️ תזכורת: ממתין לאישור תנאים</h2>
              <p style="color: #78350f; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                שלום ${order.customer_first_name},<br><br>
                אנו מזכירים לך שההזמנה שלך דורשת אישור של תנאי השירות שלנו כדי להשלים את ההזמנה.
              </p>
              <div style="text-align: center;">
                <a href="${cgvUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  אשר תנאים עכשיו
                </a>
              </div>
            </div>

            <!-- Récapitulatif réservation -->
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
              <h3 style="color: #00f0ff; margin: 0 0 15px 0; font-size: 16px;">📋 ההזמנה שלך</h3>
              <table style="width: 100%; color: #ffffff; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #888;">מספר הזמנה:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${order.request_reference}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #888;">תאריך:</td>
                  <td style="padding: 8px 0;">${new Date(order.requested_date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #888;">שעה:</td>
                  <td style="padding: 8px 0;">${order.requested_time.slice(0, 5)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #888;">משתתפים:</td>
                  <td style="padding: 8px 0;">${order.participants_count} אנשים</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: rgba(0, 0, 0, 0.3); text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              ${branchData?.name || 'Laser City'} • Active Games World<br>
              תזכורת מס׳ ${reminderNumber}
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // Envoyer l'email
    const emailResult = await sendEmail({
      to: order.customer_email,
      toName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
      subject,
      html,
      templateCode: 'cgv_reminder_manual',
      entityType: 'order',
      entityId: order.id,
      branchId: order.branch_id,
      triggeredBy: user.id,
      metadata: {
        reminder_number: reminderNumber,
        cgv_token: order.cgv_token,
        manual: true
      }
    })

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, error: emailResult.error || 'Erreur lors de l\'envoi' },
        { status: 500 }
      )
    }

    // Mettre à jour le compteur de rappels
    await supabase
      .from('orders')
      .update({
        cgv_reminder_sent_at: new Date().toISOString(),
        cgv_reminder_count: reminderNumber,
      })
      .eq('id', order.id)

    return NextResponse.json({
      success: true,
      message: 'Rappel CGV envoyé avec succès',
      emailLogId: emailResult.emailLogId
    })

  } catch (error) {
    console.error('[RESEND-CGV] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
