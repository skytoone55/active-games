/**
 * Email Sender Utility
 * Utilise Brevo pour envoyer des emails
 */

import * as Brevo from '@getbrevo/brevo'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { EmailLog, EmailTemplate, Booking, Branch, EmailLogInsert } from '@/lib/supabase/types'
import { logEmailSent } from '@/lib/activity-logger'
import { formatIsraelDate, formatIsraelTime } from '@/lib/dates'

// Client Supabase admin pour les opérations d'email (pas besoin d'auth utilisateur)
const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Configuration Brevo
const getBrevoClient = () => {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    throw new Error('BREVO_API_KEY not configured in environment variables')
  }

  const apiInstance = new Brevo.TransactionalEmailsApi()
  apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey)
  return apiInstance
}

// Types pour les variables du template
export interface BookingEmailVariables {
  booking_reference: string
  booking_date: string
  booking_time: string
  participants: number
  booking_type: string
  game_type: string // "Laser City", "Active Games", ou "Mix"
  branch_name: string
  branch_address: string
  branch_phone: string
  branch_email: string
  client_name: string
  client_first_name: string
  client_last_name: string
  client_email: string
  logo_activegames_url: string
  logo_lasercity_url: string
  current_year: string
  terms_conditions: string // HTML content of terms & conditions
  offer_url: string // iCount offer document URL (for EVENT bookings)
  offer_section: string // HTML section for offer link (empty if no offer URL)
  cgv_url: string // URL for CGV validation (admin-created orders only)
  cgv_section: string // HTML section for CGV validation link
}

// Remplace les variables {{variable}} dans le template
export function replaceTemplateVariables(template: string, variables: Record<string, string | number>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, String(value))
  }
  return result
}

// Génère un aperçu du body (premiers 200 caractères sans HTML)
function generateBodyPreview(html: string): string {
  // Supprime les tags HTML
  const text = html.replace(/<[^>]*>/g, ' ')
  // Supprime les espaces multiples
  const cleaned = text.replace(/\s+/g, ' ').trim()
  // Retourne les premiers 200 caractères
  return cleaned.substring(0, 200)
}

// Récupère les conditions générales depuis la base de données
async function getTermsConditions(
  bookingType: 'GAME' | 'EVENT',
  locale: string
): Promise<string> {
  const supabase = getAdminSupabase()

  // Déterminer le code du template (terms_game_xx ou terms_event_xx)
  const templateType = bookingType === 'EVENT' ? 'event' : 'game'
  const langCode = ['en', 'fr', 'he'].includes(locale) ? locale : 'en'
  const templateCode = `terms_${templateType}_${langCode}`

  // Récupérer le template des conditions
  const { data: template } = await supabase
    .from('email_templates')
    .select('body_template')
    .eq('code', templateCode)
    .eq('is_active', true)
    .single()

  if (template?.body_template) {
    return template.body_template
  }

  // Fallback vers anglais si pas trouvé
  if (langCode !== 'en') {
    const { data: fallbackTemplate } = await supabase
      .from('email_templates')
      .select('body_template')
      .eq('code', `terms_${templateType}_en`)
      .eq('is_active', true)
      .single()

    if (fallbackTemplate?.body_template) {
      return fallbackTemplate.body_template
    }
  }

  return '' // Retourne vide si aucun template trouvé
}

// Envoie un email et log le résultat
export async function sendEmail(params: {
  to: string
  toName?: string
  subject: string
  html: string
  templateId?: string
  templateCode?: string
  entityType?: 'booking' | 'order' | 'contact'
  entityId?: string
  branchId?: string
  triggeredBy?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; emailLogId?: string; error?: string }> {
  console.log('[EMAIL sendEmail] === START ===')
  console.log('[EMAIL sendEmail] to:', params.to)
  console.log('[EMAIL sendEmail] subject:', params.subject)
  console.log('[EMAIL sendEmail] entityType:', params.entityType)
  console.log('[EMAIL sendEmail] entityId:', params.entityId)
  console.log('[EMAIL sendEmail] branchId:', params.branchId)

  const supabase = getAdminSupabase()

  // Créer le log initial avec status 'pending'
  const emailLogData: EmailLogInsert = {
    recipient_email: params.to,
    recipient_name: params.toName || null,
    template_id: params.templateId || null,
    template_code: params.templateCode || null,
    subject: params.subject,
    body_preview: generateBodyPreview(params.html),
    body_html: params.html,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
    branch_id: params.branchId || null,
    attachments: [],
    status: 'pending',
    error_message: null,
    metadata: (params.metadata || {}) as unknown as import('@/lib/supabase/types').Json,
    sent_at: null,
    triggered_by: params.triggeredBy || null,
  }

  console.log('[EMAIL sendEmail] Creating email log in database...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emailLog, error: logError } = await (supabase as any)
    .from('email_logs')
    .insert(emailLogData)
    .select()
    .single()

  if (logError) {
    console.error('[EMAIL sendEmail] Failed to create email log:', logError)
    return { success: false, error: 'Failed to create email log' }
  }
  console.log('[EMAIL sendEmail] Email log created with id:', emailLog?.id)

  try {
    console.log('[EMAIL sendEmail] Getting Brevo client...')
    const brevoClient = getBrevoClient()

    // Configuration de l'email avec Brevo
    const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@activegames.co.il'
    const fromName = process.env.BREVO_FROM_NAME || 'ActiveGames'
    console.log('[EMAIL sendEmail] Sending via Brevo - from:', fromEmail, 'to:', params.to)

    const sendSmtpEmail = new Brevo.SendSmtpEmail()
    sendSmtpEmail.sender = { email: fromEmail, name: fromName }
    sendSmtpEmail.replyTo = { email: fromEmail, name: fromName }
    sendSmtpEmail.to = [{ email: params.to, name: params.toName || params.to }]
    sendSmtpEmail.subject = params.subject
    sendSmtpEmail.htmlContent = params.html

    const response = await brevoClient.sendTransacEmail(sendSmtpEmail)

    console.log('[EMAIL sendEmail] Brevo response:', response)

    // Vérifier le succès (Brevo retourne un messageId si succès)
    if (!response?.body?.messageId) {
      throw new Error('Brevo did not return a messageId')
    }

    const brevoMessageId = response.body.messageId
    console.log('[EMAIL sendEmail] Brevo messageId:', brevoMessageId)

    // Mettre à jour le log avec succès et stocker le messageId pour les webhooks
    console.log('[EMAIL sendEmail] Updating email log to sent... emailLog.id:', emailLog.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('email_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          ...(params.metadata || {}),
          brevo_message_id: brevoMessageId,
        },
      })
      .eq('id', emailLog.id)

    if (updateError) {
      console.error('[EMAIL sendEmail] Failed to update email log to sent:', updateError)
    } else {
      console.log('[EMAIL sendEmail] Email log updated to sent successfully')
    }

    // Log l'envoi d'email dans les activity logs
    await logEmailSent({
      recipientEmail: params.to,
      recipientName: params.toName,
      subject: params.subject,
      templateCode: params.templateCode,
      entityType: params.entityType,
      entityId: params.entityId,
      branchId: params.branchId,
    })

    console.log('[EMAIL sendEmail] === SUCCESS ===')
    return { success: true, emailLogId: emailLog.id }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMAIL sendEmail] Error caught:', errorMessage)

    // Mettre à jour le log avec l'erreur
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('email_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', emailLog.id)

    console.error('[EMAIL sendEmail] === FAILED ===')
    return { success: false, emailLogId: emailLog.id, error: errorMessage }
  }
}

// Envoie un email de confirmation de réservation
export async function sendBookingConfirmationEmail(params: {
  booking: Booking
  branch: Branch
  triggeredBy?: string
  locale?: string // 'fr' | 'en' | 'he'
  cgvToken?: string | null // Token pour validation CGV (orders admin seulement)
}): Promise<{ success: boolean; emailLogId?: string; error?: string }> {
  const { booking, branch, triggeredBy, locale = 'en', cgvToken } = params

  console.log('[EMAIL CONFIRMATION] === START ===')
  console.log('[EMAIL CONFIRMATION] booking.id:', booking.id)
  console.log('[EMAIL CONFIRMATION] booking.reference_code:', booking.reference_code)
  console.log('[EMAIL CONFIRMATION] booking.customer_email:', booking.customer_email)
  console.log('[EMAIL CONFIRMATION] branch.id:', branch.id)
  console.log('[EMAIL CONFIRMATION] locale:', locale)
  console.log('[EMAIL CONFIRMATION] triggeredBy:', triggeredBy)

  // Vérifier que le client a un email
  if (!booking.customer_email) {
    console.log('[EMAIL CONFIRMATION] No customer email, skipping')
    return { success: false, error: 'Customer has no email address' }
  }

  const supabase = getAdminSupabase()

  // Déterminer le code du template selon la langue
  const templateCode = `booking_confirmation_${locale}`
  console.log('[EMAIL CONFIRMATION] Looking for template:', templateCode)

  // Récupérer le template de confirmation dans la bonne langue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: template, error: templateError } = await (supabase as any)
    .from('email_templates')
    .select('*')
    .eq('code', templateCode)
    .eq('is_active', true)
    .single() as { data: EmailTemplate | null; error: unknown }

  console.log('[EMAIL CONFIRMATION] Template fetch result - found:', !!template, 'error:', templateError)

  // Fallback vers anglais si le template n'existe pas dans cette langue
  if (templateError || !template) {
    console.log('[EMAIL CONFIRMATION] Trying fallback to booking_confirmation_en...')
    const { data: fallbackTemplate, error: fallbackError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('code', 'booking_confirmation_en')
      .eq('is_active', true)
      .single()

    console.log('[EMAIL CONFIRMATION] Fallback result - found:', !!fallbackTemplate, 'error:', fallbackError)
    template = fallbackTemplate as EmailTemplate | null
  }

  if (!template) {
    console.error('[EMAIL CONFIRMATION] Template not found for locale:', locale)
    return { success: false, error: 'Email template not found' }
  }
  console.log('[EMAIL CONFIRMATION] Using template:', template.code, 'id:', template.id)

  // Déterminer la locale pour le formatage des dates
  const dateLocale = locale === 'he' ? 'he-IL' : locale === 'fr' ? 'fr-FR' : 'en-US'

  // Formater la date et l'heure selon la locale AVEC le timezone Israel
  // IMPORTANT: On utilise formatIsraelDate/Time pour forcer le timezone Asia/Jerusalem
  // Sans ça, le serveur (en UTC) affiche -2h de décalage par rapport à l'agenda
  const formattedDate = formatIsraelDate(booking.start_datetime, dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedTime = formatIsraelTime(booking.start_datetime, dateLocale)

  // Déterminer l'URL de base pour les logos
  // En production, utiliser le domaine réel
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'

  // Traduire le type de booking selon la langue
  const getBookingTypeLabel = (type: string, lang: string) => {
    if (type === 'GAME') {
      return lang === 'fr' ? 'Partie de jeux' : lang === 'he' ? 'משחק' : 'Game'
    }
    return lang === 'fr' ? 'Événement' : lang === 'he' ? 'אירוע' : 'Event'
  }

  // Récupérer les game_sessions pour déterminer le type de jeu (Laser/Active/Mix)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gameSessions } = await (supabase as any)
    .from('game_sessions')
    .select('game_area')
    .eq('booking_id', booking.id)

  // Déterminer le type de jeu basé sur les sessions
  const getGameTypeLabel = (sessions: Array<{ game_area: string }> | null, lang: string) => {
    if (!sessions || sessions.length === 0) {
      return '' // Pas de sessions, ne pas afficher
    }

    const hasLaser = sessions.some(s => s.game_area === 'LASER')
    const hasActive = sessions.some(s => s.game_area === 'ACTIVE')

    if (hasLaser && hasActive) {
      return 'Mix Active + Laser'
    } else if (hasLaser) {
      return 'Laser City'
    } else if (hasActive) {
      return 'Active Games'
    }
    return ''
  }

  // Récupérer les conditions générales
  const termsConditions = await getTermsConditions(
    booking.type as 'GAME' | 'EVENT',
    locale
  )

  // iCount offers removed - no more offer section in emails
  const offerUrl = ''
  const offerSectionHtml = ''

  // Generate CGV validation section HTML (only for admin-created orders with cgvToken)
  const cgvUrl = cgvToken ? `${baseUrl}/cgv/${cgvToken}` : ''
  let cgvSectionHtml = ''

  if (cgvToken) {
    // CGV section - prominent card that explains customer will see their order details AND validate T&C
    if (locale === 'he') {
      cgvSectionHtml = `
        <tr>
          <td style="padding: 20px 40px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border-radius: 12px; border: 2px solid #f59e0b;">
              <tr>
                <td style="padding: 20px;">
                  <div style="text-align: center;">
                    <p style="color: #92400e; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">⚠️ פעולה נדרשת</p>
                    <p style="color: #78350f; font-size: 14px; margin: 0 0 16px 0;">צפה בפרטי ההזמנה שלך ואשר את תנאי השירות</p>
                    <a href="${cgvUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                      צפה בהזמנה ואשר תנאים
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    } else if (locale === 'fr') {
      cgvSectionHtml = `
        <tr>
          <td style="padding: 20px 40px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border-radius: 12px; border: 2px solid #f59e0b;">
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <p style="color: #92400e; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">⚠️ Action requise</p>
                  <p style="color: #78350f; font-size: 14px; margin: 0 0 16px 0;">Consultez le détail de votre commande et acceptez les CGV</p>
                  <a href="${cgvUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                    Voir ma commande et valider
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    } else {
      cgvSectionHtml = `
        <tr>
          <td style="padding: 20px 40px;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border-radius: 12px; border: 2px solid #f59e0b;">
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <p style="color: #92400e; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">⚠️ Action Required</p>
                  <p style="color: #78350f; font-size: 14px; margin: 0 0 16px 0;">View your order details and accept the Terms & Conditions</p>
                  <a href="${cgvUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                    View Order & Accept T&C
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    }
  }

  // Préparer les variables
  const variables: BookingEmailVariables = {
    booking_reference: booking.reference_code,
    booking_date: formattedDate,
    booking_time: formattedTime,
    participants: booking.participants_count,
    booking_type: getBookingTypeLabel(booking.type, locale),
    game_type: getGameTypeLabel(gameSessions, locale),
    branch_name: branch.name,
    branch_address: branch.address,
    branch_phone: branch.phone || '',
    branch_email: '', // À ajouter si disponible dans la table branches
    client_name: `${booking.customer_first_name} ${booking.customer_last_name}`.trim(),
    client_first_name: booking.customer_first_name || '',
    client_last_name: booking.customer_last_name || '',
    client_email: booking.customer_email,
    logo_activegames_url: `${baseUrl}/images/logo-activegames.png`,
    logo_lasercity_url: `${baseUrl}/images/logo_laser_city.png`,
    current_year: new Date().getFullYear().toString(),
    terms_conditions: termsConditions,
    offer_url: offerUrl,
    offer_section: offerSectionHtml, // Complete HTML section (empty if no URL)
    cgv_url: cgvUrl,
    cgv_section: cgvSectionHtml, // Complete HTML section for CGV validation
  }

  // Générer le sujet et le body
  const subject = replaceTemplateVariables(template.subject_template, variables as unknown as Record<string, string | number>)
  const html = replaceTemplateVariables(template.body_template, variables as unknown as Record<string, string | number>)

  // Envoyer l'email
  return sendEmail({
    to: booking.customer_email,
    toName: `${booking.customer_first_name} ${booking.customer_last_name}`.trim(),
    subject,
    html,
    templateId: template.id,
    templateCode: template.code,
    entityType: 'booking',
    entityId: booking.id,
    branchId: branch.id,
    triggeredBy,
    metadata: {
      booking_reference: booking.reference_code,
      booking_type: booking.type,
      participants: booking.participants_count,
    },
  })
}

// Renvoyer un email depuis un log existant
export async function resendEmail(emailLogId: string, triggeredBy?: string): Promise<{ success: boolean; newEmailLogId?: string; error?: string }> {
  const supabase = getAdminSupabase()

  // Récupérer le log original
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: originalLog, error } = await (supabase as any)
    .from('email_logs')
    .select('*')
    .eq('id', emailLogId)
    .single() as { data: EmailLog | null; error: unknown }

  if (error || !originalLog) {
    return { success: false, error: 'Original email log not found' }
  }

  // Si on a un template, le récupérer pour avoir le body complet
  let html = ''

  if (originalLog.template_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template } = await (supabase as any)
      .from('email_templates')
      .select('*')
      .eq('id', originalLog.template_id)
      .single() as { data: EmailTemplate | null }

    if (template) {
      // On devrait stocker les variables originales dans metadata pour pouvoir régénérer
      // Pour l'instant, on utilise le body_preview (pas idéal)
      html = template.body_template

      // Si on a des metadata avec les variables, les utiliser
      if (originalLog.metadata && typeof originalLog.metadata === 'object') {
        const metadata = originalLog.metadata as Record<string, unknown>
        for (const [key, value] of Object.entries(metadata)) {
          const regex = new RegExp(`{{${key}}}`, 'g')
          html = html.replace(regex, String(value))
        }
      }
    }
  }

  if (!html) {
    return { success: false, error: 'Cannot regenerate email content' }
  }

  // Créer un nouveau log et envoyer
  return sendEmail({
    to: originalLog.recipient_email,
    toName: originalLog.recipient_name || undefined,
    subject: originalLog.subject,
    html,
    templateId: originalLog.template_id || undefined,
    templateCode: originalLog.template_code || undefined,
    entityType: originalLog.entity_type as 'booking' | 'order' | 'contact' | undefined,
    entityId: originalLog.entity_id || undefined,
    branchId: originalLog.branch_id || undefined,
    triggeredBy,
    metadata: {
      ...((originalLog.metadata as Record<string, unknown>) || {}),
      resent_from: emailLogId,
    },
  })
}
