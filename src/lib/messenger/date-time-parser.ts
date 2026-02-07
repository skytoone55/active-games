/**
 * Parser intelligent pour dates et heures en français/anglais/hébreu
 */

interface ParsedDate {
  date: string // YYYY-MM-DD
  original: string
  confidence: 'high' | 'medium' | 'low'
  ambiguous?: string // Message si ambiguïté
}

interface ParsedTime {
  time: string // HH:MM
  original: string
  confidence: 'high' | 'medium' | 'low'
  ambiguous?: string // Message si ambiguïté (ex: "2h" pourrait être 02:00 ou 14:00)
}

const MONTH_NAMES_FR = [
  'janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'août', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre'
]

const MONTH_NAMES_EN = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
]

const MONTH_ABBR_FR = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec']
const MONTH_ABBR_FR_ALT = ['janv', 'fév', 'févr', 'mars', 'avril', 'juin', 'juil', 'août', 'sept', 'octo', 'nove', 'déc']
const MONTH_ABBR_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * Parse une date en format libre
 */
export function parseDate(input: string, locale: 'fr' | 'en' | 'he' = 'fr'): ParsedDate | null {
  if (!input || typeof input !== 'string') return null

  const cleaned = input.toLowerCase().trim().replace(/\s+/g, ' ')
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Format déjà bon: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return {
      date: cleaned,
      original: input,
      confidence: 'high'
    }
  }

  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const ddmmyyyyMatch = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0')
    const month = ddmmyyyyMatch[2].padStart(2, '0')
    const year = ddmmyyyyMatch[3]
    return {
      date: `${year}-${month}-${day}`,
      original: input,
      confidence: 'high'
    }
  }

  // DD/MM ou DD-MM ou DD.MM (année courante)
  const ddmmMatch = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})$/)
  if (ddmmMatch) {
    const day = ddmmMatch[1].padStart(2, '0')
    const month = ddmmMatch[2].padStart(2, '0')
    return {
      date: `${currentYear}-${month}-${day}`,
      original: input,
      confidence: 'medium',
      ambiguous: 'Année non précisée, utilisation de l\'année en cours'
    }
  }

  // DDMM ou DDMMYYYY (sans séparateurs)
  const ddmmCompactMatch = cleaned.match(/^(\d{2})(\d{2})(\d{4})?$/)
  if (ddmmCompactMatch) {
    const day = ddmmCompactMatch[1]
    const month = ddmmCompactMatch[2]
    const year = ddmmCompactMatch[3] || currentYear.toString()
    return {
      date: `${year}-${month}-${day}`,
      original: input,
      confidence: ddmmCompactMatch[3] ? 'high' : 'medium',
      ambiguous: ddmmCompactMatch[3] ? undefined : 'Année non précisée'
    }
  }

  // Formats avec mois en lettres
  // "5 février", "05 fevrier", "5 fév 2025", etc.
  const allMonthNames = [...MONTH_NAMES_FR, ...MONTH_NAMES_EN, ...MONTH_ABBR_FR, ...MONTH_ABBR_FR_ALT, ...MONTH_ABBR_EN]

  for (let i = 0; i < allMonthNames.length; i++) {
    const monthName = allMonthNames[i]
    const monthIndex = getMonthIndex(monthName)
    if (monthIndex === -1) continue

    // Regex: jour + mois (+ année optionnelle)
    const regex = new RegExp(`(\\d{1,2})\\s*${monthName}(?:\\s+(\\d{4}))?`, 'i')
    const match = cleaned.match(regex)

    if (match) {
      const day = match[1].padStart(2, '0')
      const month = (monthIndex + 1).toString().padStart(2, '0')
      const year = match[2] || currentYear.toString()

      return {
        date: `${year}-${month}-${day}`,
        original: input,
        confidence: match[2] ? 'high' : 'medium',
        ambiguous: match[2] ? undefined : 'Année non précisée, utilisation de l\'année en cours'
      }
    }
  }

  // Aujourd'hui / demain / après-demain
  const today = new Date()
  
  if (/aujourd'?hui|today/i.test(cleaned)) {
    return {
      date: formatDate(today),
      original: input,
      confidence: 'high'
    }
  }
  
  if (/demain|tomorrow/i.test(cleaned)) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return {
      date: formatDate(tomorrow),
      original: input,
      confidence: 'high'
    }
  }
  
  if (/apr[eè]s[- ]?demain|day after tomorrow/i.test(cleaned)) {
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)
    return {
      date: formatDate(dayAfter),
      original: input,
      confidence: 'high'
    }
  }

  return null
}

/**
 * Parse une heure en format libre
 */
export function parseTime(input: string, locale: 'fr' | 'en' | 'he' = 'fr'): ParsedTime | null {
  if (!input || typeof input !== 'string') return null

  const cleaned = input.toLowerCase().trim().replace(/\s+/g, '')

  // Format déjà bon: HH:MM
  if (/^\d{2}:\d{2}$/.test(cleaned)) {
    return {
      time: cleaned,
      original: input,
      confidence: 'high'
    }
  }

  // HH:MM avec H sur 1 chiffre
  const hhmmMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmmMatch) {
    const hour = parseInt(hhmmMatch[1])
    const minute = hhmmMatch[2]
    
    if (hour >= 0 && hour <= 23) {
      return {
        time: `${hour.toString().padStart(2, '0')}:${minute}`,
        original: input,
        confidence: 'high'
      }
    }
  }

  // Formats avec "h" ou "H": 14h, 14h30, 2h, 2h30, etc.
  const hFormatMatch = cleaned.match(/^(\d{1,2})h(\d{2})?$/)
  if (hFormatMatch) {
    const hour = parseInt(hFormatMatch[1])
    const minute = hFormatMatch[2] || '00'
    
    // Ambiguïté: 2h pourrait être 02:00 ou 14:00
    if (hour >= 0 && hour <= 23) {
      const isAmbiguous = hour >= 1 && hour <= 12
      return {
        time: `${hour.toString().padStart(2, '0')}:${minute}`,
        original: input,
        confidence: isAmbiguous ? 'medium' : 'high',
        ambiguous: isAmbiguous ? `${hour}h pourrait signifier matin (${hour}:${minute}) ou après-midi (${hour + 12}:${minute})` : undefined
      }
    }
  }

  // Format 24h (sans séparateur): 1430, 0930, etc.
  const compactMatch = cleaned.match(/^(\d{2})(\d{2})$/)
  if (compactMatch) {
    const hour = parseInt(compactMatch[1])
    const minute = compactMatch[2]
    
    if (hour >= 0 && hour <= 23 && parseInt(minute) <= 59) {
      return {
        time: `${compactMatch[1]}:${minute}`,
        original: input,
        confidence: 'high'
      }
    }
  }

  // Format compact court: 2h sans minutes pourrait être 02 ou 14
  const shortMatch = cleaned.match(/^(\d{1,2})$/)
  if (shortMatch) {
    const hour = parseInt(shortMatch[1])
    
    if (hour >= 0 && hour <= 23) {
      const isAmbiguous = hour >= 1 && hour <= 12
      return {
        time: `${hour.toString().padStart(2, '0')}:00`,
        original: input,
        confidence: 'low',
        ambiguous: isAmbiguous ? `${hour} pourrait signifier ${hour}:00 ou ${hour + 12}:00` : undefined
      }
    }
  }

  // Formats avec AM/PM
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1])
    const minute = ampmMatch[2] || '00'
    const period = ampmMatch[3].toLowerCase()
    
    // Conversion AM/PM
    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    
    if (hour >= 0 && hour <= 23) {
      return {
        time: `${hour.toString().padStart(2, '0')}:${minute}`,
        original: input,
        confidence: 'high'
      }
    }
  }

  return null
}

/**
 * Formater une date en YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Obtenir l'index du mois (0-11) depuis son nom
 */
function getMonthIndex(monthName: string): number {
  const name = monthName.toLowerCase()

  // Mois complets français
  const frIndex = MONTH_NAMES_FR.findIndex(m => m === name)
  if (frIndex !== -1) return frIndex % 12

  // Mois complets anglais
  const enIndex = MONTH_NAMES_EN.findIndex(m => m === name)
  if (enIndex !== -1) return enIndex

  // Abréviations françaises principales
  const frAbbrIndex = MONTH_ABBR_FR.findIndex(m => m === name)
  if (frAbbrIndex !== -1) return frAbbrIndex

  // Abréviations françaises alternatives
  const frAbbrAltIndex = MONTH_ABBR_FR_ALT.findIndex(m => m === name)
  if (frAbbrAltIndex !== -1) return frAbbrAltIndex

  // Abréviations anglaises
  const enAbbrIndex = MONTH_ABBR_EN.findIndex(m => m === name)
  if (enAbbrIndex !== -1) return enAbbrIndex

  return -1
}

/**
 * Formater une date pour affichage convivial
 */
export function formatDateForDisplay(dateStr: string, locale: 'fr' | 'en' | 'he' = 'fr'): string {
  const [year, month, day] = dateStr.split('-')
  const monthNum = parseInt(month) - 1
  
  if (locale === 'fr') {
    return `${parseInt(day)} ${MONTH_NAMES_FR[monthNum]} ${year}`
  } else if (locale === 'en') {
    return `${MONTH_NAMES_EN[monthNum]} ${parseInt(day)}, ${year}`
  }
  
  return `${day}/${month}/${year}`
}

/**
 * Formater une heure pour affichage convivial
 */
export function formatTimeForDisplay(timeStr: string, locale: 'fr' | 'en' | 'he' = 'fr'): string {
  const [hour, minute] = timeStr.split(':')
  
  if (locale === 'fr') {
    return `${parseInt(hour)}h${minute !== '00' ? minute : ''}`
  }
  
  // Format AM/PM pour anglais
  const h = parseInt(hour)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h)
  return `${displayHour}:${minute} ${period}`
}
