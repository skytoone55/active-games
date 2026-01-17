/**
 * Utilitaires pour la gestion des dates et timezones
 * Toutes les branches sont en Israel (Asia/Jerusalem)
 */

// Israel timezone
const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

/**
 * Crée une date ISO string a partir d'une date et heure locales Israel
 * Utilisé côté serveur pour interpreter correctement les heures envoyées par le client
 *
 * @param date - Date au format YYYY-MM-DD
 * @param time - Heure au format HH:MM
 * @returns ISO string avec le bon timezone offset
 */
export function createIsraelDateTime(date: string, time: string): Date {
  // Creer la date en specifiant explicitement que c'est en timezone Israel
  // Format: "2024-01-15T12:00:00" + offset Israel
  const dateTimeStr = `${date}T${time}:00`

  // Obtenir l'offset Israel pour cette date specifique (gere le DST)
  const tempDate = new Date(dateTimeStr + 'Z') // Parse comme UTC d'abord
  const israelOffset = getIsraelOffset(tempDate)

  // Creer la date avec le bon offset
  // Si l'offset Israel est +02:00, et l'utilisateur veut 12:00 Israel,
  // on doit stocker 10:00 UTC
  const utcHours = parseInt(time.split(':')[0]) - Math.floor(israelOffset / 60)
  const utcMinutes = parseInt(time.split(':')[1]) - (israelOffset % 60)

  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCHours(utcHours, utcMinutes, 0, 0)

  return result
}

/**
 * Obtient l'offset Israel en minutes pour une date donnee
 * Israel est en UTC+2 (hiver) ou UTC+3 (ete avec DST)
 */
export function getIsraelOffset(date: Date): number {
  // Utiliser Intl pour obtenir l'offset correct incluant DST
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIMEZONE,
    timeZoneName: 'shortOffset'
  })

  const parts = formatter.formatToParts(date)
  const tzPart = parts.find(p => p.type === 'timeZoneName')

  if (tzPart) {
    // Parse "GMT+2" ou "GMT+3"
    const match = tzPart.value.match(/GMT([+-])(\d+)/)
    if (match) {
      const sign = match[1] === '+' ? 1 : -1
      const hours = parseInt(match[2])
      return sign * hours * 60
    }
  }

  // Fallback: +2 heures (Israel Standard Time)
  return 120
}

/**
 * Formate une date ISO en heure locale Israel pour l'affichage
 */
export function formatIsraelTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('he-IL', {
    timeZone: ISRAEL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * Formate une date ISO en date locale Israel pour l'affichage
 */
export function formatIsraelDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('he-IL', {
    timeZone: ISRAEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * Extrait la date (YYYY-MM-DD) d'une ISO string en timezone Israel
 */
export function extractIsraelDate(isoString: string): string {
  const date = new Date(isoString)
  const year = date.toLocaleString('en-US', { timeZone: ISRAEL_TIMEZONE, year: 'numeric' })
  const month = date.toLocaleString('en-US', { timeZone: ISRAEL_TIMEZONE, month: '2-digit' })
  const day = date.toLocaleString('en-US', { timeZone: ISRAEL_TIMEZONE, day: '2-digit' })
  return `${year}-${month}-${day}`
}

/**
 * Extrait l'heure (HH:MM) d'une ISO string en timezone Israel
 */
export function extractIsraelTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    timeZone: ISRAEL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
