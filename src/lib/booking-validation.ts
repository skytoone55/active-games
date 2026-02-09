/**
 * Validation des prix AVANT création de booking
 *
 * Ce module garantit qu'un booking ne peut PAS être créé
 * si aucune formule de prix valide n'existe.
 *
 * Appelé par:
 * - /api/orders (commandes site public)
 * - /api/bookings (réservations admin)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Types pour les résultats de validation
export interface PriceValidationResult {
  valid: boolean
  error?: string
  errorKey?: string // Clé pour traduction frontend
  formula?: EventFormula
  unitPrice?: number
  roomPrice?: number
  productCode?: string
}

interface EventFormula {
  id: string
  branch_id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
  room_id: string | null
  product_id: string | null
  is_active: boolean
  priority: number
}

interface ICountProduct {
  id: string
  branch_id: string
  code: string
  name: string
  unit_price: number
  is_active: boolean
}

interface GameSession {
  game_area: 'ACTIVE' | 'LASER'
  start_datetime?: string
  end_datetime?: string
}

/**
 * Valide qu'un prix peut être calculé pour un booking
 * DOIT être appelé AVANT de créer le booking
 */
export async function validateBookingPrice(
  supabase: SupabaseClient,
  type: 'GAME' | 'EVENT',
  branchId: string,
  participantsCount: number,
  gameSessions?: GameSession[]
): Promise<PriceValidationResult> {

  if (type === 'EVENT') {
    return validateEventPrice(supabase, branchId, participantsCount, gameSessions)
  } else {
    return validateGamePrice(supabase, branchId, participantsCount, gameSessions)
  }
}

/**
 * Validation prix EVENT
 * Vérifie: formule existe + produit iCount lié existe
 */
async function validateEventPrice(
  supabase: SupabaseClient,
  branchId: string,
  participantsCount: number,
  gameSessions?: GameSession[]
): Promise<PriceValidationResult> {

  // 1. Récupérer toutes les formules EVENT de la branche
  const { data: eventFormulas, error: formulasError } = await supabase
    .from('icount_event_formulas')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (formulasError) {
    console.error('[VALIDATION] Erreur lecture formules:', formulasError)
    return {
      valid: false,
      error: 'Erreur lors de la lecture des formules de prix',
      errorKey: 'errors.priceValidation.readError'
    }
  }

  if (!eventFormulas || eventFormulas.length === 0) {
    return {
      valid: false,
      error: 'Aucune formule de prix EVENT configurée pour cette branche',
      errorKey: 'errors.priceValidation.noEventFormulas'
    }
  }

  // 2. Déterminer le type de jeu (LASER, ACTIVE, ou BOTH)
  const hasLaser = gameSessions?.some(s => s.game_area === 'LASER') || false
  const hasActive = gameSessions?.some(s => s.game_area === 'ACTIVE') || false

  let bookingGameType: 'LASER' | 'ACTIVE' | 'BOTH'
  if (hasLaser && hasActive) {
    bookingGameType = 'BOTH'
  } else if (hasActive) {
    bookingGameType = 'ACTIVE'
  } else {
    bookingGameType = 'LASER' // Par défaut
  }

  // 3. Trouver une formule qui correspond
  const matchingFormula = eventFormulas.find((f: EventFormula) => {
    // Vérifier le nombre de participants
    if (participantsCount < f.min_participants) return false
    if (participantsCount > f.max_participants) return false

    // Vérifier le type de jeu
    if (f.game_type === 'BOTH') {
      return true // Formule BOTH accepte tout
    }
    return f.game_type === bookingGameType
  })

  if (!matchingFormula) {
    // Calculer les limites pour le message d'erreur
    const minParticipants = Math.min(...eventFormulas.map((f: EventFormula) => f.min_participants))
    const maxParticipants = Math.max(...eventFormulas.map((f: EventFormula) => f.max_participants))

    return {
      valid: false,
      error: `Nombre de participants invalide (${participantsCount}). Accepté: ${minParticipants} à ${maxParticipants} participants.`,
      errorKey: 'errors.priceValidation.invalidParticipants'
    }
  }

  // 4. Vérifier que le produit iCount lié existe
  const { data: products } = await supabase
    .from('icount_products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (!products || products.length === 0) {
    return {
      valid: false,
      error: 'Aucun produit iCount configuré pour cette branche',
      errorKey: 'errors.priceValidation.noProducts'
    }
  }

  // Chercher le produit lié à la formule
  let eventProduct: ICountProduct | undefined

  // 1. Par product_id direct (méthode préférée)
  if (matchingFormula.product_id) {
    eventProduct = products.find((p: ICountProduct) => p.id === matchingFormula.product_id)
  }

  // 2. Par code tier (fallback)
  if (!eventProduct) {
    const tierCode = `event_${matchingFormula.game_type.toLowerCase()}_${matchingFormula.min_participants}_${matchingFormula.max_participants}`
    eventProduct = products.find((p: ICountProduct) => p.code === tierCode)
  }

  // 3. Par code legacy (ancien système)
  if (!eventProduct) {
    const legacyCode = `event_${matchingFormula.game_type.toLowerCase()}_${matchingFormula.price_per_person}`
    eventProduct = products.find((p: ICountProduct) => p.code === legacyCode)
  }

  if (!eventProduct) {
    return {
      valid: false,
      error: `Produit iCount non trouvé pour la formule "${matchingFormula.name}". Synchronisez les produits iCount.`,
      errorKey: 'errors.priceValidation.productNotFound'
    }
  }

  // 5. Vérifier le produit salle si nécessaire
  let roomPrice = 0
  if (matchingFormula.room_id) {
    const { data: room } = await supabase
      .from('icount_rooms')
      .select('price, name, name_he')
      .eq('id', matchingFormula.room_id)
      .single()

    if (room && room.price > 0) {
      // SOURCE: icount_rooms.price (pas le produit)
      roomPrice = room.price
    }
  }

  // Alerte si formula.price_per_person ≠ product.unit_price
  if (eventProduct.unit_price !== matchingFormula.price_per_person) {
    console.warn('[VALIDATION] ⚠️ PRICE MISMATCH: formula.price_per_person=', matchingFormula.price_per_person, 'vs product.unit_price=', eventProduct.unit_price, '- Using formula price')
  }

  // Validation réussie - SOURCE UNIQUE: formula.price_per_person
  return {
    valid: true,
    formula: matchingFormula,
    unitPrice: matchingFormula.price_per_person,
    roomPrice,
    productCode: eventProduct.code
  }
}

/**
 * Validation prix GAME
 * Vérifie: produits laser_X ou active_X existent
 */
async function validateGamePrice(
  supabase: SupabaseClient,
  branchId: string,
  participantsCount: number,
  gameSessions?: GameSession[]
): Promise<PriceValidationResult> {

  if (!gameSessions || gameSessions.length === 0) {
    return {
      valid: false,
      error: 'Aucune session de jeu définie',
      errorKey: 'errors.priceValidation.noGameSessions'
    }
  }

  // Récupérer les produits de la branche
  const { data: products, error: productsError } = await supabase
    .from('icount_products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (productsError) {
    console.error('[VALIDATION] Erreur lecture produits:', productsError)
    return {
      valid: false,
      error: 'Erreur lors de la lecture des produits',
      errorKey: 'errors.priceValidation.readError'
    }
  }

  if (!products || products.length === 0) {
    return {
      valid: false,
      error: 'Aucun produit iCount configuré pour cette branche',
      errorKey: 'errors.priceValidation.noProducts'
    }
  }

  // Vérifier les sessions LASER
  const laserSessions = gameSessions.filter(s => s.game_area === 'LASER')
  if (laserSessions.length > 0) {
    const laserCode = `laser_${Math.min(laserSessions.length, 4)}`
    const laserProduct = products.find((p: ICountProduct) => p.code === laserCode)

    if (!laserProduct) {
      return {
        valid: false,
        error: `Produit "${laserCode}" non trouvé. Créez-le dans la configuration iCount.`,
        errorKey: 'errors.priceValidation.laserProductNotFound'
      }
    }
  }

  // Vérifier les sessions ACTIVE
  const activeSessions = gameSessions.filter(s => s.game_area === 'ACTIVE')
  if (activeSessions.length > 0) {
    // Calculer la durée totale des sessions ACTIVE
    let totalMinutes = 0
    for (const session of activeSessions) {
      if (session.start_datetime && session.end_datetime) {
        const start = new Date(session.start_datetime)
        const end = new Date(session.end_datetime)
        totalMinutes += Math.round((end.getTime() - start.getTime()) / 60000)
      }
    }

    // Trouver le produit active_X le plus proche
    const durationOptions = [30, 60, 90, 120]
    const closestDuration = durationOptions.reduce((prev, curr) =>
      Math.abs(curr - totalMinutes) < Math.abs(prev - totalMinutes) ? curr : prev
    )

    const activeCode = `active_${closestDuration}`
    const activeProduct = products.find((p: ICountProduct) => p.code === activeCode)

    if (!activeProduct) {
      return {
        valid: false,
        error: `Produit "${activeCode}" non trouvé. Créez-le dans la configuration iCount.`,
        errorKey: 'errors.priceValidation.activeProductNotFound'
      }
    }
  }

  // Validation réussie
  return {
    valid: true
  }
}
