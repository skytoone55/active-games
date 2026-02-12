/**
 * Unified language detection for messenger
 * Single source of truth — used by engine.ts and clara-service.ts
 */

export function detectMessageLanguage(text: string): 'he' | 'fr' | 'en' {
  // Hebrew characters
  if (/[\u0590-\u05FF]/.test(text)) return 'he'
  // French accented characters or common French words
  if (
    /[àâçéèêëîïôùûüÿœæ]/i.test(text) ||
    /\b(je|tu|il|nous|vous|merci|bonjour|oui|non|est|les|des|une|pour|quel|quoi|comment|combien)\b/i.test(text)
  ) return 'fr'
  // Default to English
  return 'en'
}
