/**
 * Utilitaires de validation pour les formulaires
 */

/**
 * Valide le format d'un email
 * @param email - L'adresse email à valider
 * @returns true si l'email est valide
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  // Regex standard pour validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Valide un numéro de téléphone israélien
 * Format attendu : 05XXXXXXXX (10 chiffres commençant par 05)
 * @param phone - Le numéro de téléphone à valider
 * @returns true si le téléphone est valide
 */
export function validateIsraeliPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false
  
  // Nettoyer le numéro (retirer espaces, tirets, etc.)
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')
  
  // Vérifier le format : 10 chiffres commençant par 05
  const phoneRegex = /^05\d{8}$/
  return phoneRegex.test(cleaned)
}

/**
 * Formate un numéro de téléphone israélien en retirant les caractères inutiles
 * @param phone - Le numéro de téléphone à formater
 * @returns Le numéro nettoyé (05XXXXXXXX) ou la chaîne vide si invalide
 */
export function formatIsraeliPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return ''
  
  // Nettoyer le numéro
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')
  
  // Vérifier si c'est un format valide
  if (validateIsraeliPhone(cleaned)) {
    return cleaned
  }
  
  // Si le format est invalide, retourner tel quel pour que l'utilisateur corrige
  return phone.trim()
}

/**
 * Affiche un numéro de téléphone israélien avec formatage visuel
 * Format : 05X-XXX-XXXX
 * @param phone - Le numéro de téléphone
 * @returns Le numéro formaté pour l'affichage
 */
export function displayIsraeliPhone(phone: string): string {
  const cleaned = formatIsraeliPhone(phone)
  
  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  
  return phone
}

/**
 * Messages d'erreur pour les validations
 */
export const VALIDATION_MESSAGES = {
  email: {
    invalid: 'Adresse email invalide',
    required: 'Email requis'
  },
  phone: {
    invalid: 'Numéro de téléphone invalide (format : 05XXXXXXXX)',
    required: 'Numéro de téléphone requis',
    israeliFormat: 'Le numéro doit commencer par 05 et contenir 10 chiffres'
  }
}
