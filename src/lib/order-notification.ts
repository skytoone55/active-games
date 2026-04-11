/**
 * Shared helper — send a redirection notification email for every new order
 * (regardless of status or source: website, admin agenda, etc.)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface OrderNotificationParams {
  branchId: string
  branchName: string
  orderId: string
  reference: string
  status: string
  customerFirstName: string
  customerLastName: string | null
  customerPhone: string
  customerEmail: string | null
  requestedDate: string
  requestedTime: string
  orderType: string
  participantsCount: number
}

export async function sendOrderRedirectionNotification(params: OrderNotificationParams): Promise<void> {
  console.log('[ORDER NOTIF] === START ===', { branchId: params.branchId, reference: params.reference, status: params.status })
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('branch_settings')
      .select('order_notification_emails')
      .eq('branch_id', params.branchId)
      .single()

    if (settingsError) {
      console.error('[ORDER NOTIF] Failed to fetch branch_settings:', settingsError.message, '— migration may not have been run')
      return
    }

    const notifEmails: string[] = (settings?.order_notification_emails as string[]) || []
    console.log('[ORDER NOTIF] Emails configured:', notifEmails)
    if (notifEmails.length === 0) {
      console.log('[ORDER NOTIF] No redirection emails configured for branch', params.branchId)
      return
    }

    const { sendEmail } = await import('@/lib/email-sender')

    const statusLabels: Record<string, string> = {
      pending: 'En attente',
      auto_confirmed: 'Auto-confirmée',
      manually_confirmed: 'Confirmée',
      aborted: 'Abandonnée',
      cancelled: 'Annulée',
      closed: 'Clôturée',
    }
    const statusLabel = statusLabels[params.status] || params.status
    const clientName = `${params.customerFirstName} ${params.customerLastName || ''}`.trim()

    const sourceLabel = params.status === 'auto_confirmed' ? '📋 Commande admin' : '🔔 Nouvelle commande reçue'

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
  <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #fff; margin: 0; font-size: 18px;">${sourceLabel}</h2>
    <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">${params.branchName}</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden;">
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b; width: 40%;">Référence</td>
      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a;">${params.reference}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Statut</td>
      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a;">${statusLabel}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Client</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${clientName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Téléphone</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.customerPhone}</td>
    </tr>
    ${params.customerEmail ? `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Email</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.customerEmail}</td>
    </tr>` : ''}
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Date souhaitée</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.requestedDate} à ${params.requestedTime.slice(0, 5)}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Type</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.orderType}</td>
    </tr>
    <tr>
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Participants</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.participantsCount}</td>
    </tr>
  </table>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; text-align: center;">
    Notification automatique — ActiveLaser Admin
  </p>
</div>`

    console.log('[ORDER NOTIF] Sending to', notifEmails.length, 'address(es)...')
    const results = await Promise.all(
      notifEmails.map(email =>
        sendEmail({
          to: email,
          subject: `[${params.branchName}] Nouvelle commande ${params.reference} — ${statusLabel}`,
          html,
          entityType: 'order',
          entityId: params.orderId,
          branchId: params.branchId,
          triggeredBy: 'order_notification',
        }).catch(err => {
          console.error('[ORDER NOTIF] Failed to send to', email, err)
          return { success: false, error: String(err) }
        })
      )
    )
    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    console.log(`[ORDER NOTIF] Done — ${sent} sent, ${failed} failed`)
  } catch (err) {
    console.error('[ORDER NOTIF] sendOrderRedirectionNotification error:', err)
  }
}
