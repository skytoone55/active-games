/**
 * Email Automation Service
 *
 * Point d'entrée unique pour déclencher des emails automatisés.
 * Consulte la table email_automations pour savoir quoi envoyer.
 *
 * Usage:
 *   await triggerEmailAutomation('booking_confirmed', {
 *     booking, branch, locale, triggeredBy, cgvToken
 *   })
 *
 * Si aucune automation active trouvée pour booking_confirmed,
 * on fall back sur l'envoi direct (backward compatible).
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendBookingConfirmationEmail, sendEmail, replaceTemplateVariables } from '@/lib/email-sender'
import type { Branch } from '@/lib/supabase/types'

const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Context passé lors du déclenchement d'une automation
export interface AutomationContext {
  // Booking-related (booking est un objet partiel car les routes construisent des objets ad-hoc)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking?: any
  branch?: Branch
  locale?: string
  triggeredBy?: string
  cgvToken?: string | null

  // Order-related
  orderId?: string
  orderReference?: string
  customerEmail?: string
  customerFirstName?: string
  customerLastName?: string

  // Generic
  branchId?: string
  entityType?: 'booking' | 'order' | 'contact'
  entityId?: string
  metadata?: Record<string, unknown>
}

interface AutomationRecord {
  id: string
  name: string
  trigger_event: string
  template_code: string
  delay_minutes: number
  conditions: Record<string, unknown>
  enabled: boolean
  max_sends: number | null
  branch_id: string | null
}

interface AutomationResult {
  sent: number
  skipped: number
  errors: string[]
  /** ID du log email (pour le premier envoi immédiat) */
  emailLogId?: string
  /** Si au moins un envoi a réussi */
  success: boolean
}

/**
 * Déclenche les automatisations pour un événement donné.
 * Cherche en DB les automations actives, vérifie les conditions, et envoie.
 *
 * Pour booking_confirmed: si aucune automation en DB, fall back sur envoi direct.
 * Pour delay_minutes > 0: enregistre une entrée dans scheduled_emails (si table existe)
 * ou les CGV reminders sont gérés par le cron qui lit email_automations.
 */
export async function triggerEmailAutomation(
  triggerEvent: string,
  context: AutomationContext
): Promise<AutomationResult> {
  const supabase = getAdminSupabase()

  const result: AutomationResult = { sent: 0, skipped: 0, errors: [], success: false }

  try {
    // Chercher les automations actives pour cet événement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: automations, error } = await (supabase as any)
      .from('email_automations')
      .select('*')
      .eq('trigger_event', triggerEvent)
      .eq('enabled', true)
      .order('delay_minutes', { ascending: true })

    if (error) {
      console.error(`[EMAIL AUTOMATION] Error fetching automations for ${triggerEvent}:`, error)
      // Fallback: envoyer directement pour booking_confirmed
      if (triggerEvent === 'booking_confirmed') {
        return await fallbackDirectSend(context, result)
      }
      result.errors.push(`DB error: ${error.message}`)
      return result
    }

    if (!automations || automations.length === 0) {
      console.log(`[EMAIL AUTOMATION] No active automations for trigger: ${triggerEvent}`)
      // Fallback: envoyer directement pour booking_confirmed (backward compatible)
      if (triggerEvent === 'booking_confirmed') {
        return await fallbackDirectSend(context, result)
      }
      return result
    }

    // Filtrer par branche si applicable
    const branchId = context.branchId || context.branch?.id
    const filteredAutomations = (automations as AutomationRecord[]).filter(a => {
      if (a.branch_id && branchId && a.branch_id !== branchId) return false
      return true
    })

    if (filteredAutomations.length === 0 && triggerEvent === 'booking_confirmed') {
      return await fallbackDirectSend(context, result)
    }

    for (const automation of filteredAutomations) {
      try {
        // Vérifier les conditions
        if (!checkConditions(automation.conditions, context)) {
          console.log(`[EMAIL AUTOMATION] Conditions not met for "${automation.name}"`)
          result.skipped++
          continue
        }

        // Pour les envois différés (delay > 0), on ne les envoie pas maintenant.
        // Les CGV reminders sont gérés par le cron /api/cron/cgv-reminders
        // qui consulte la table email_automations pour savoir si c'est activé.
        if (automation.delay_minutes > 0) {
          console.log(`[EMAIL AUTOMATION] "${automation.name}" has delay=${automation.delay_minutes}min — deferred to cron`)
          result.skipped++
          continue
        }

        // Résoudre le template code (peut contenir {{locale}})
        const locale = context.locale || 'en'
        const resolvedTemplateCode = automation.template_code.replace('{{locale}}', locale)

        // Exécuter l'envoi selon le type de trigger
        const emailLogId = await executeAutomation(automation, resolvedTemplateCode, context)
        result.sent++
        result.success = true
        if (emailLogId && !result.emailLogId) {
          result.emailLogId = emailLogId
        }

        console.log(`[EMAIL AUTOMATION] "${automation.name}" sent successfully (template: ${resolvedTemplateCode})`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[EMAIL AUTOMATION] Error executing "${automation.name}":`, errMsg)
        result.errors.push(`${automation.name}: ${errMsg}`)
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[EMAIL AUTOMATION] Fatal error for trigger ${triggerEvent}:`, errMsg)
    result.errors.push(errMsg)
    // Fallback for booking_confirmed
    if (triggerEvent === 'booking_confirmed') {
      return await fallbackDirectSend(context, result)
    }
  }

  result.success = result.sent > 0
  return result
}

/**
 * Fallback: envoi direct sans passer par les automations DB.
 * Utilisé quand aucune automation n'est configurée ou en cas d'erreur DB.
 * Garantit la backward compatibility — l'email part toujours.
 */
async function fallbackDirectSend(
  context: AutomationContext,
  result: AutomationResult
): Promise<AutomationResult> {
  console.log('[EMAIL AUTOMATION] Fallback: direct send for booking_confirmed')

  if (!context.booking || !context.branch) {
    result.errors.push('Fallback failed: missing booking or branch')
    return result
  }

  try {
    const emailResult = await sendBookingConfirmationEmail({
      booking: context.booking,
      branch: context.branch,
      triggeredBy: context.triggeredBy,
      locale: context.locale,
      cgvToken: context.cgvToken,
    })

    result.success = emailResult.success
    result.emailLogId = emailResult.emailLogId
    if (emailResult.success) {
      result.sent = 1
    } else {
      result.errors.push(emailResult.error || 'Direct send failed')
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Fallback exception: ${errMsg}`)
  }

  return result
}

/**
 * Vérifie si les conditions d'une automation sont remplies
 */
function checkConditions(
  conditions: Record<string, unknown>,
  context: AutomationContext
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true

  // Vérifier la source (ex: admin_agenda only)
  if (conditions.source && context.metadata?.source !== conditions.source) {
    return false
  }

  // Vérifier le type de booking
  if (conditions.booking_type && context.booking?.type !== conditions.booking_type) {
    return false
  }

  // Vérifier la locale
  if (conditions.locale && context.locale !== conditions.locale) {
    return false
  }

  // Vérifier le min_participants
  if (conditions.min_participants && context.booking) {
    if (context.booking.participants_count < (conditions.min_participants as number)) {
      return false
    }
  }

  return true
}

/**
 * Exécute l'envoi d'un email pour une automation.
 * Retourne l'emailLogId si disponible.
 */
async function executeAutomation(
  automation: AutomationRecord,
  templateCode: string,
  context: AutomationContext
): Promise<string | undefined> {
  // Pour booking_confirmed, on utilise la fonction existante qui gère
  // toute la logique (variables, CGV, terms, etc.)
  if (automation.trigger_event === 'booking_confirmed') {
    if (!context.booking || !context.branch) {
      throw new Error('booking_confirmed requires booking and branch in context')
    }

    const emailResult = await sendBookingConfirmationEmail({
      booking: context.booking,
      branch: context.branch,
      triggeredBy: context.triggeredBy,
      locale: context.locale,
      cgvToken: context.cgvToken,
    })

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'sendBookingConfirmationEmail failed')
    }
    return emailResult.emailLogId
  }

  // Pour les autres triggers, on fait un envoi générique via template DB
  const supabase = getAdminSupabase()

  // Charger le template
  const { data: template, error: tplError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('code', templateCode)
    .eq('is_active', true)
    .single()

  if (tplError || !template) {
    // Essayer le fallback anglais
    const fallbackCode = templateCode.replace(/_[a-z]{2}$/, '_en')
    if (fallbackCode !== templateCode) {
      const { data: fallback } = await supabase
        .from('email_templates')
        .select('*')
        .eq('code', fallbackCode)
        .eq('is_active', true)
        .single()

      if (!fallback) {
        throw new Error(`Template not found: ${templateCode} (fallback ${fallbackCode} also missing)`)
      }

      // Use fallback
      return executeTemplatedEmail(automation, fallback, context)
    }
    throw new Error(`Template not found: ${templateCode}`)
  }

  return executeTemplatedEmail(automation, template, context)
}

/**
 * Envoie un email à partir d'un template DB + variables du contexte
 */
async function executeTemplatedEmail(
  automation: AutomationRecord,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any,
  context: AutomationContext
): Promise<string | undefined> {
  const recipientEmail = context.customerEmail || context.booking?.customer_email
  if (!recipientEmail) {
    throw new Error('No recipient email in context')
  }

  const recipientName = context.customerFirstName
    ? `${context.customerFirstName} ${context.customerLastName || ''}`.trim()
    : context.booking
      ? `${context.booking.customer_first_name} ${context.booking.customer_last_name}`.trim()
      : undefined

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'

  // Construire les variables
  const variables: Record<string, string | number> = {
    client_name: recipientName || '',
    client_first_name: context.customerFirstName || context.booking?.customer_first_name || '',
    client_last_name: context.customerLastName || context.booking?.customer_last_name || '',
    client_email: recipientEmail,
    branch_name: context.branch?.name || '',
    current_year: new Date().getFullYear().toString(),
    logo_activegames_url: `${baseUrl}/images/logo-activegames.png`,
    logo_lasercity_url: `${baseUrl}/images/logo_laser_city.png`,
  }

  // Ajouter les variables de booking si dispo
  if (context.booking) {
    variables.booking_reference = context.booking.reference_code || ''
    variables.participants = context.booking.participants_count || 0
  }

  // Ajouter les variables d'order si dispo
  if (context.orderReference) {
    variables.request_reference = context.orderReference
  }

  if (context.cgvToken) {
    variables.cgv_url = `${baseUrl}/cgv/${context.cgvToken}`
  }

  // Remplacer les variables
  const subject = replaceTemplateVariables(template.subject_template, variables)
  const html = replaceTemplateVariables(template.body_template, variables)

  // Envoyer
  const emailResult = await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject,
    html,
    templateId: template.id,
    templateCode: template.code,
    entityType: context.entityType || (context.booking ? 'booking' : 'order'),
    entityId: context.entityId || context.booking?.id || context.orderId,
    branchId: context.branchId || context.branch?.id,
    triggeredBy: context.triggeredBy || 'automation',
    metadata: {
      automation_id: automation.id,
      automation_name: automation.name,
      ...context.metadata,
    },
  })

  if (!emailResult.success) {
    throw new Error(emailResult.error || 'sendEmail failed')
  }

  return emailResult.emailLogId
}
