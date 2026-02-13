/**
 * CRON Job: CGV Reminders
 *
 * Envoie des rappels par email pour les orders admin dont les CGV n'ont pas été validées.
 * À appeler toutes les heures ou une fois par jour.
 *
 * Logique:
 * - Vérifie en DB si l'automation cgv_pending est activée
 * - Trouve les orders admin (source = 'admin_agenda') avec cgv_token non null et cgv_validated_at null
 * - Utilise le template DB si disponible, sinon fallback sur le HTML intégré
 * - Envoie un rappel si > délai configuré depuis le dernier rappel (ou création)
 * - Maximum de rappels configurable via l'automation (max_sends) ou fallback à 3
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, replaceTemplateVariables } from '@/lib/email-sender'
import type { Branch } from '@/lib/supabase/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Valeurs par défaut (utilisées si l'automation ne spécifie pas)
const DEFAULT_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000 // 24h
const DEFAULT_MAX_REMINDERS = 3

interface CgvAutomation {
  id: string
  enabled: boolean
  delay_minutes: number
  max_sends: number | null
  template_code: string
  conditions: Record<string, unknown>
}

/**
 * GET /api/cron/cgv-reminders
 * Appelé par un cron job externe (ex: Vercel Cron)
 */
export async function GET(_request: NextRequest) {
  try {
    // 1. Vérifier si l'automation cgv_pending est activée en DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cgvAutomations } = await (supabase as any)
      .from('email_automations')
      .select('id, enabled, delay_minutes, max_sends, template_code, conditions')
      .eq('trigger_event', 'cgv_pending')
      .eq('enabled', true)

    if (!cgvAutomations || cgvAutomations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'CGV reminder automations are disabled or not configured',
        sent: 0
      })
    }

    // Prendre la première automation cgv_pending active
    const automation: CgvAutomation = cgvAutomations[0]

    // Calculer le délai et max rappels depuis l'automation
    const reminderDelayMs = automation.delay_minutes > 0
      ? automation.delay_minutes * 60 * 1000
      : DEFAULT_REMINDER_DELAY_MS
    const maxReminders = automation.max_sends ?? DEFAULT_MAX_REMINDERS

    const now = new Date()
    const reminderThreshold = new Date(now.getTime() - reminderDelayMs)

    // 2. Trouver les orders admin qui ont besoin d'un rappel CGV
    const { data: ordersToRemind, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        request_reference,
        customer_first_name,
        customer_last_name,
        customer_email,
        cgv_token,
        cgv_reminder_sent_at,
        cgv_reminder_count,
        requested_date,
        requested_time,
        participants_count,
        branch_id,
        created_at
      `)
      .eq('source', 'admin_agenda')
      .not('cgv_token', 'is', null)
      .is('cgv_validated_at', null)
      .lt('cgv_reminder_count', maxReminders)
      .not('customer_email', 'is', null)

    if (fetchError) {
      console.error('[CGV REMINDERS] Error fetching orders:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    if (!ordersToRemind || ordersToRemind.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders need CGV reminders',
        sent: 0
      })
    }

    // 3. Filtrer les orders qui ont besoin d'un rappel
    const ordersNeedingReminder = ordersToRemind.filter(order => {
      const lastContact = order.cgv_reminder_sent_at
        ? new Date(order.cgv_reminder_sent_at)
        : new Date(order.created_at)
      return lastContact < reminderThreshold
    })

    if (ordersNeedingReminder.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders are due for reminders yet',
        sent: 0
      })
    }

    // 4. Récupérer toutes les branches nécessaires
    const branchIds = [...new Set(ordersNeedingReminder.map(o => o.branch_id))]
    const { data: branches } = await supabase
      .from('branches')
      .select('*')
      .in('id', branchIds)

    const branchMap = new Map<string, Branch>()
    branches?.forEach(b => branchMap.set(b.id, b as Branch))

    // 5. Charger le template depuis DB si configuré
    let dbTemplate: { subject_template: string; body_template: string } | null = null
    if (automation.template_code) {
      const { data: tpl } = await supabase
        .from('email_templates')
        .select('subject_template, body_template')
        .eq('code', automation.template_code)
        .eq('is_active', true)
        .single()
      if (tpl) {
        dbTemplate = tpl
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'

    let sentCount = 0
    const errors: string[] = []

    // 6. Envoyer les rappels
    for (const order of ordersNeedingReminder) {
      const branch = branchMap.get(order.branch_id)
      if (!branch || !order.customer_email) continue

      const cgvUrl = `${baseUrl}/cgv/${order.cgv_token}`
      const reminderNumber = order.cgv_reminder_count + 1

      let subject: string
      let html: string

      if (dbTemplate) {
        // Utiliser le template DB avec remplacement de variables
        const variables: Record<string, string | number> = {
          client_name: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
          client_first_name: order.customer_first_name || '',
          client_last_name: order.customer_last_name || '',
          request_reference: order.request_reference || '',
          cgv_url: cgvUrl,
          branch_name: branch.name || '',
          reminder_number: reminderNumber,
          requested_date: order.requested_date
            ? new Date(order.requested_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : '',
          requested_time: order.requested_time ? order.requested_time.slice(0, 5) : '',
          participants_count: order.participants_count || 0,
          current_year: new Date().getFullYear().toString(),
          logo_activegames_url: `${baseUrl}/images/logo-activegames.png`,
          logo_lasercity_url: `${baseUrl}/images/logo_laser_city.png`,
        }

        subject = replaceTemplateVariables(dbTemplate.subject_template, variables)
        html = replaceTemplateVariables(dbTemplate.body_template, variables)
      } else {
        // Fallback: HTML intégré (ancien comportement)
        subject = `[Rappel ${reminderNumber}] Validation CGV - Réservation ${order.request_reference}`
        html = buildFallbackReminderHtml(order, branch, cgvUrl, reminderNumber, baseUrl)
      }

      try {
        const emailResult = await sendEmail({
          to: order.customer_email,
          toName: `${order.customer_first_name} ${order.customer_last_name || ''}`.trim(),
          subject,
          html,
          templateCode: automation.template_code || 'cgv_reminder',
          entityType: 'order',
          entityId: order.id,
          branchId: order.branch_id,
          metadata: {
            reminder_number: reminderNumber,
            cgv_token: order.cgv_token,
            automation_id: automation.id,
          }
        })

        if (emailResult.success) {
          await supabase
            .from('orders')
            .update({
              cgv_reminder_sent_at: now.toISOString(),
              cgv_reminder_count: reminderNumber,
            })
            .eq('id', order.id)

          sentCount++
          console.log(`[CGV REMINDERS] Sent reminder ${reminderNumber} to ${order.customer_email} for order ${order.request_reference}`)
        } else {
          errors.push(`Failed to send to ${order.customer_email}: ${emailResult.error}`)
        }
      } catch (err) {
        errors.push(`Exception for ${order.customer_email}: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `CGV reminders sent`,
      sent: sentCount,
      total: ordersNeedingReminder.length,
      automation_id: automation.id,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('[CGV REMINDERS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Génère le HTML de fallback quand aucun template DB n'est configuré.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackReminderHtml(order: any, branch: Branch, cgvUrl: string, reminderNumber: number, baseUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #0a0a1a; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(0, 240, 255, 0.2);">
    <div style="padding: 30px; text-align: center; background: linear-gradient(135deg, #00f0ff20 0%, transparent 100%);">
      <div style="display: inline-block; margin: 0 10px;">
        <img src="${baseUrl}/images/logo-activegames.png" alt="Active Games" style="height: 50px; width: auto;">
      </div>
      <div style="display: inline-block; margin: 0 10px;">
        <img src="${baseUrl}/images/logo_laser_city.png" alt="Laser City" style="height: 50px; width: auto;">
      </div>
    </div>
    <div style="padding: 30px;">
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; border: 2px solid #f59e0b; margin-bottom: 25px;">
        <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 20px;">Rappel : Validation CGV en attente</h2>
        <p style="color: #78350f; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
          Bonjour ${order.customer_first_name},<br><br>
          Nous vous rappelons que votre réservation nécessite la validation de nos conditions générales de vente pour être finalisée.
        </p>
        <div style="text-align: center;">
          <a href="${cgvUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Valider les CGV maintenant
          </a>
        </div>
      </div>
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
        <h3 style="color: #00f0ff; margin: 0 0 15px 0; font-size: 16px;">Votre réservation</h3>
        <table style="width: 100%; color: #ffffff; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #888;">Référence :</td><td style="padding: 8px 0; font-weight: bold;">${order.request_reference}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Date :</td><td style="padding: 8px 0;">${new Date(order.requested_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Heure :</td><td style="padding: 8px 0;">${order.requested_time.slice(0, 5)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Participants :</td><td style="padding: 8px 0;">${order.participants_count} personnes</td></tr>
        </table>
      </div>
    </div>
    <div style="padding: 20px 30px; background: rgba(0, 0, 0, 0.3); text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0;">
        ${branch.name} • Active Games World<br>
        Ceci est le rappel n°${reminderNumber}
      </p>
    </div>
  </div>
</body>
</html>`
}
