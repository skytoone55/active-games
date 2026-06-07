/**
 * Shared helper — send a redirection notification email for every new order
 * (regardless of status or source: website, admin agenda, etc.)
 * Language: Hebrew (RTL)
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
  // Type de notification — 'created' (défaut) = nouvelle commande reçue ;
  // 'deposit_paid' = la commande vient d'être confirmée par paiement d'acompte
  // (en-tête clair « ✅ confirmé + acompte payé » pour lever toute ambiguïté côté staff)
  kind?: 'created' | 'deposit_paid'
  depositAmount?: number
}

const statusLabels: Record<string, string> = {
  pending:             'ממתין לאישור',
  auto_confirmed:      'אושר אוטומטית',
  manually_confirmed:  'אושר ידנית',
  aborted:             'נטוש',
  cancelled:           'בוטל',
  closed:              'סגור',
}

const orderTypeLabels: Record<string, string> = {
  GAME:  'משחק',
  EVENT: 'אירוע',
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

    const statusLabel = statusLabels[params.status] || params.status
    const orderTypeLabel = orderTypeLabels[params.orderType?.toUpperCase()] || params.orderType
    const clientName = `${params.customerFirstName} ${params.customerLastName || ''}`.trim()

    const isDepositPaid = params.kind === 'deposit_paid'
    const isAdmin = !isDepositPaid && params.status === 'auto_confirmed'
    const headerIcon = isDepositPaid ? '✅' : isAdmin ? '📋' : params.status === 'aborted' ? '⚠️' : params.status === 'cancelled' ? '❌' : '🔔'
    const headerTitle = isDepositPaid
      ? 'הזמנה אושרה — מקדמה שולמה'
      : isAdmin ? 'הזמנה חדשה נוצרה (אדמין)' : 'הזמנה חדשה התקבלה'

    // Pour une confirmation de paiement, le sujet est explicite (✅) pour que le
    // staff repère immédiatement les réservations réellement confirmées et payées.
    const subject = isDepositPaid
      ? `✅ [${params.branchName}] הזמנה ${params.reference} אושרה — מקדמה שולמה`
      : `[${params.branchName}] הזמנה ${params.reference} — ${statusLabel}`

    const html = `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px; direction: rtl; text-align: right;">
  <div style="background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #fff; margin: 0; font-size: 18px;">${headerIcon} ${headerTitle}</h2>
    <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">${params.branchName}</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden;" dir="rtl">
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b; width: 40%;">מספר הזמנה</td>
      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a; letter-spacing: 1px;">${params.reference}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">סטטוס</td>
      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a;">${statusLabel}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">שם לקוח</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${clientName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">טלפון</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; direction: ltr; text-align: left;">${params.customerPhone}</td>
    </tr>
    ${params.customerEmail ? `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">אימייל</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; direction: ltr; text-align: left;">${params.customerEmail}</td>
    </tr>` : ''}
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">תאריך מבוקש</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.requestedDate} בשעה ${params.requestedTime.slice(0, 5)}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">סוג</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${orderTypeLabel}</td>
    </tr>
    <tr${isDepositPaid ? ' style="border-bottom: 1px solid #e2e8f0;"' : ''}>
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">מספר משתתפים</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a;">${params.participantsCount}</td>
    </tr>
    ${isDepositPaid && params.depositAmount ? `
    <tr>
      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">מקדמה ששולמה</td>
      <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #16a34a;">${params.depositAmount} ₪ ✅</td>
    </tr>` : ''}
  </table>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; text-align: center;">
    התראה אוטומטית — ActiveLaser Admin
  </p>
</div>`

    console.log('[ORDER NOTIF] Sending to', notifEmails.length, 'address(es)...')
    const results = await Promise.all(
      notifEmails.map(email =>
        sendEmail({
          to: email,
          subject,
          html,
          entityType: 'order',
          entityId: params.orderId,
          branchId: params.branchId,
          triggeredBy: undefined,
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
