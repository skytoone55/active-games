import type { ConversationProfile } from '../types'

/**
 * FAQ category taxonomy — fine-grained tagging for context-aware FAQ search.
 * Principle: zero duplication. A FAQ belongs to ONE category.
 * The hierarchy is handled by getRelevantCategories().
 */
export const FAQ_CATEGORIES = [
  'general',        // applies to everything (hours, parking, contact, payment, activities overview)
  'game',           // common to all game types (no minimum, ages, duration, deposit)
  'game_laser',     // specific to Laser Tag (description, capacity, pricing)
  'game_active',    // specific to Active Games (description, rooms, bracelet, pricing)
  'game_mix',       // specific to Mix formula (description, pricing)
  'event',          // events, birthdays, team building (minimum 15, included items, deposit)
  'booking',        // reservation policies (how to book, cancellation, confirmation)
  'safety',         // rules, medical, clothing, prohibited items
  'branch_rishon',  // Rishon LeZion specific
  'branch_petah',   // Petah Tikva specific
  'branch_glilot',  // Glilot specific
] as const

export type FAQCategory = typeof FAQ_CATEGORIES[number]

/** Labels for admin UI (keyed by category) */
export const FAQ_CATEGORY_LABELS: Record<FAQCategory, { fr: string; en: string; he: string }> = {
  general:       { fr: 'Général',                en: 'General',              he: 'כללי' },
  game:          { fr: 'Jeux (tous types)',       en: 'Games (all types)',    he: 'משחקים (כל הסוגים)' },
  game_laser:    { fr: 'Laser Tag',               en: 'Laser Tag',            he: 'לייזר טאג' },
  game_active:   { fr: 'Active Games',            en: 'Active Games',         he: 'אקטיב גיימס' },
  game_mix:      { fr: 'Mix (Laser + Active)',     en: 'Mix (Laser + Active)', he: 'מיקס (לייזר + אקטיב)' },
  event:         { fr: 'Événements & Anniversaires', en: 'Events & Birthdays',  he: 'אירועים ויום הולדת' },
  booking:       { fr: 'Réservation & Politiques', en: 'Booking & Policies',   he: 'הזמנות ומדיניות' },
  safety:        { fr: 'Sécurité & Règles',        en: 'Safety & Rules',       he: 'בטיחות וכללים' },
  branch_rishon: { fr: 'Rishon LeZion',            en: 'Rishon LeZion',        he: 'ראשון לציון' },
  branch_petah:  { fr: 'Petah Tikva',              en: 'Petah Tikva',          he: 'פתח תקווה' },
  branch_glilot: { fr: 'Glilot',                   en: 'Glilot',               he: 'גלילות' },
}

/**
 * Given a conversation profile, return the list of relevant FAQ categories.
 * When profile is unknown → returns null (= no filter, search all).
 * When profile has context → returns only the relevant categories.
 */
export function getRelevantCategories(profile?: ConversationProfile): string[] | null {
  // No profile or no resa_type → search everything (no filter)
  if (!profile?.resa_type) return null

  // Always include these base categories
  const cats: string[] = ['general', 'booking', 'safety']

  // Add branch-specific categories
  // (We always include all branches since branch filtering is by branch_id, not FAQ category)
  cats.push('branch_rishon', 'branch_petah', 'branch_glilot')

  if (profile.resa_type === 'game') {
    cats.push('game')
    if (profile.game_type === 'laser') cats.push('game_laser')
    else if (profile.game_type === 'active') cats.push('game_active')
    else if (profile.game_type === 'mix') cats.push('game_mix')
    else {
      // game type unknown → include all game subtypes
      cats.push('game_laser', 'game_active', 'game_mix')
    }
  } else if (profile.resa_type === 'event') {
    cats.push('event')
  }

  return cats
}
