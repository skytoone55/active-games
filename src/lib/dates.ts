/**
 * Utilitaires pour la gestion des dates avec le fuseau horaire de Jérusalem (Asia/Jerusalem)
 * Toutes les dates sont normalisées pour utiliser ce fuseau horaire
 */

import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'

const JERUSALEM_TIMEZONE = 'Asia/Jerusalem'

/**
 * Convertit une date/heure locale (considérée comme étant en heure de Jérusalem) en ISO UTC
 * @param date Date locale (sans timezone)
 * @param hour Heure (0-23) en heure de Jérusalem
 * @param minute Minute (0-59) en heure de Jérusalem
 * @returns Date en ISO string (UTC) qui représente cette heure en Jérusalem
 */
export function createJerusalemDate(date: Date, hour: number, minute: number): string {
  // Créer une date locale avec l'heure spécifiée
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0)
  
  // Convertir cette date (considérée comme étant en heure de Jérusalem) en UTC
  const utcDate = fromZonedTime(localDate, JERUSALEM_TIMEZONE)
  
  return utcDate.toISOString()
}

/**
 * Convertit une date ISO (UTC) en date/heure locale de Jérusalem
 * @param isoString Date ISO string (UTC)
 * @returns Objet avec date et heure en Jérusalem
 */
export function parseJerusalemDate(isoString: string): { date: Date; hour: number; minute: number } {
  const utcDate = new Date(isoString)
  
  // Convertir de UTC vers l'heure de Jérusalem
  const jerusalemDate = toZonedTime(utcDate, JERUSALEM_TIMEZONE)
  
  return {
    date: new Date(jerusalemDate.getFullYear(), jerusalemDate.getMonth(), jerusalemDate.getDate()),
    hour: jerusalemDate.getHours(),
    minute: jerusalemDate.getMinutes()
  }
}

/**
 * Obtient le début de journée en Jérusalem pour une date donnée
 * @param date Date locale
 * @returns ISO string pour 00:00:00 en Jérusalem (en UTC)
 */
export function getStartOfDayJerusalem(date: Date): string {
  return createJerusalemDate(date, 0, 0)
}

/**
 * Obtient la fin de journée en Jérusalem pour une date donnée
 * @param date Date locale
 * @returns ISO string pour 23:59:59 en Jérusalem (en UTC)
 */
export function getEndOfDayJerusalem(date: Date): string {
  const endDate = new Date(date)
  endDate.setDate(endDate.getDate() + 1)
  const startOfNextDay = createJerusalemDate(endDate, 0, 0)
  
  // Soustraire 1 seconde pour obtenir 23:59:59
  const endOfDay = new Date(new Date(startOfNextDay).getTime() - 1000)
  return endOfDay.toISOString()
}

/**
 * Formate une date ISO en string de date locale (YYYY-MM-DD) en Jérusalem
 * @param isoString Date ISO string
 * @returns String de date YYYY-MM-DD
 */
export function formatJerusalemDateString(isoString: string): string {
  const { date } = parseJerusalemDate(isoString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Vérifie si deux dates ISO sont le même jour en Jérusalem
 */
export function isSameDayJerusalem(iso1: string, iso2: string): boolean {
  return formatJerusalemDateString(iso1) === formatJerusalemDateString(iso2)
}
