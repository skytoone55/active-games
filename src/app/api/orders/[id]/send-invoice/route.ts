/**
 * API Route: /api/orders/[id]/send-invoice
 *
 * POST: Envoyer la facture iCount par email au client
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyApiPermission } from '@/lib/permissions'
import { sendEmail } from '@/lib/email-sender'
import type { Order, Branch } from '@/lib/supabase/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await verifyApiPermission('orders', 'edit')
  if (!permCheck.success) {
    return permCheck.errorResponse
  }

  const user = permCheck.user!
  const { id: orderId } = await params
  const supabase = await createClient()

  // Récupérer la commande avec la branche
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      branch:branches(*)
    `)
    .eq('id', orderId)
    .single<Order & { branch: Branch | null }>()

  if (orderError || !order) {
    return NextResponse.json(
      { success: false, error: 'Order not found' },
      { status: 404 }
    )
  }

  // Vérifier l'accès à la branche
  if (user.role !== 'super_admin' && !user.branchIds.includes(order.branch_id!)) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    )
  }

  // Vérifier que la commande a un email
  if (!order.customer_email) {
    return NextResponse.json(
      { success: false, error: 'No email address for this order', messageKey: 'admin.invoice.errors.no_email' },
      { status: 400 }
    )
  }

  // Vérifier que la commande est fermée et a une facture
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderAny = order as any
  if (order.status !== 'closed') {
    return NextResponse.json(
      { success: false, error: 'Order must be closed to send invoice', messageKey: 'admin.invoice.errors.not_closed' },
      { status: 400 }
    )
  }

  if (!orderAny.icount_invrec_url) {
    return NextResponse.json(
      { success: false, error: 'No invoice available for this order', messageKey: 'admin.invoice.errors.no_invoice' },
      { status: 400 }
    )
  }

  try {
    const invoiceUrl = orderAny.icount_invrec_url as string
    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'לקוח יקר'
    const orderRef = order.request_reference || ''
    const branchName = order.branch?.name || 'Active Games'

    // Récupérer la langue préférée du contact si disponible
    let locale: 'he' | 'fr' | 'en' = 'he'
    if (order.contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('preferred_locale')
        .eq('id', order.contact_id)
        .single<{ preferred_locale: string | null }>()
      if (contactData?.preferred_locale) {
        locale = contactData.preferred_locale as 'he' | 'fr' | 'en'
      }
    }

    // Construire l'email selon la langue
    let subject: string
    let htmlContent: string

    if (locale === 'he') {
      subject = `חשבונית עבור הזמנה ${orderRef} - ${branchName}`
      htmlContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">שלום ${customerName},</h2>
          <p>תודה שביקרתם אצלנו ב-${branchName}!</p>
          <p>מצורפת החשבונית שלכם עבור הזמנה מספר <strong>${orderRef}</strong>.</p>
          <p style="margin: 30px 0;">
            <a href="${invoiceUrl}"
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              צפייה בחשבונית
            </a>
          </p>
          <p>לשאלות או בירורים, אנחנו כאן לשירותכם.</p>
          <p>בברכה,<br/><strong>${branchName}</strong></p>
        </div>
      `
    } else if (locale === 'fr') {
      subject = `Facture pour la commande ${orderRef} - ${branchName}`
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Bonjour ${customerName},</h2>
          <p>Merci de votre visite chez ${branchName} !</p>
          <p>Veuillez trouver ci-joint votre facture pour la commande <strong>${orderRef}</strong>.</p>
          <p style="margin: 30px 0;">
            <a href="${invoiceUrl}"
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Voir la facture
            </a>
          </p>
          <p>Pour toute question, n'hésitez pas à nous contacter.</p>
          <p>Cordialement,<br/><strong>${branchName}</strong></p>
        </div>
      `
    } else {
      subject = `Invoice for order ${orderRef} - ${branchName}`
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Hello ${customerName},</h2>
          <p>Thank you for visiting ${branchName}!</p>
          <p>Please find attached your invoice for order <strong>${orderRef}</strong>.</p>
          <p style="margin: 30px 0;">
            <a href="${invoiceUrl}"
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Invoice
            </a>
          </p>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br/><strong>${branchName}</strong></p>
        </div>
      `
    }

    // Envoyer l'email
    const result = await sendEmail({
      to: order.customer_email,
      toName: customerName,
      subject,
      html: htmlContent,
      templateCode: 'invoice_email',
      entityType: 'order',
      entityId: orderId,
      branchId: order.branch_id || undefined,
      triggeredBy: user.id,
      metadata: {
        invoiceUrl,
        orderRef,
        locale,
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email', messageKey: 'admin.invoice.errors.send_failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice sent successfully',
      messageKey: 'admin.invoice.success',
      emailLogId: result.emailLogId,
    })
  } catch (error) {
    console.error('Error sending invoice email:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
