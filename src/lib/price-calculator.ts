import type { ICountProduct, ICountEventFormula, ICountRoom } from '@/hooks/usePricingData'

export interface PriceCalculationResult {
  breakdown: string       // "26 × 100₪ + 400₪ (salle) - 10%"
  total: number           // 2700
  subtotal: number        // Before discount
  discountAmount: number  // Discount amount
  valid: boolean          // If we have enough data to calculate
  details: {
    participants: number
    unitPrice: number
    unitLabel?: string      // "2 parties", "1h", etc.
    roomPrice?: number
    roomName?: string
    discountType?: 'percent' | 'fixed' | null
    discountValue?: number
  }
}

export interface CalculatePriceParams {
  bookingType: 'GAME' | 'EVENT'
  participants: number
  // GAME params
  gameArea?: 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM' | null
  numberOfGames?: number            // For LASER: number of parties
  gameDurations?: string[]          // For ACTIVE: durations in minutes
  // GAME CUSTOM params
  customGameAreas?: ('ACTIVE' | 'LASER')[]  // Area for each game in CUSTOM mode
  customGameDurations?: string[]             // Duration for each game in CUSTOM mode
  // EVENT params
  eventQuickPlan?: string           // Quick plan like 'AA', 'LL', 'AL', 'LA', etc.
  eventRoomId?: string | null
  // Discount
  discountType?: 'percent' | 'fixed' | null
  discountValue?: string | number
  // Pricing data
  products: ICountProduct[]
  eventFormulas: ICountEventFormula[]
  rooms: ICountRoom[]
}

/**
 * Find the laser product based on number of parties
 * Matches the logic in icount-documents.ts (max 4 parties)
 * Product codes: laser_1, laser_2, laser_3, laser_4
 */
function findLaserProduct(products: ICountProduct[], numParties: number): ICountProduct | undefined {
  const code = `laser_${Math.min(numParties, 4)}`
  return products.find(p => p.code === code)
}

/**
 * Find the active product based on total duration in minutes
 * Matches the logic in icount-documents.ts (finds closest duration)
 * Product codes: active_30, active_60, active_90, active_120
 */
function findActiveProduct(products: ICountProduct[], durationMinutes: number): ICountProduct | undefined {
  // Map duration to product codes (same as icount-documents.ts)
  const durationMap: { [key: string]: number } = {
    'active_30': 30,
    'active_60': 60,
    'active_90': 90,
    'active_120': 120,
  }

  // Find product that matches duration (rounded to nearest standard duration)
  let bestProduct: ICountProduct | undefined
  let bestDiff = Infinity

  for (const product of products) {
    const productDuration = durationMap[product.code]
    if (productDuration !== undefined) {
      const diff = Math.abs(productDuration - durationMinutes)
      if (diff < bestDiff) {
        bestDiff = diff
        bestProduct = product
      }
    }
  }

  // If no duration-based match, try to find any active product
  if (!bestProduct) {
    bestProduct = products.find(p => p.code.startsWith('active_') && !p.code.includes('event'))
  }

  return bestProduct
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes <= 30) return '30m'
  if (minutes <= 60) return '1h'
  if (minutes <= 90) return '1h30'
  return '2h'
}

/**
 * Determine the game type from EVENT quick plan
 * Matches the logic in icount-documents.ts
 */
function getEventGameTypeFromPlan(quickPlan: string): 'LASER' | 'ACTIVE' | 'BOTH' {
  const hasLaser = quickPlan.includes('L')
  const hasActive = quickPlan.includes('A')

  if (hasLaser && hasActive) {
    return 'BOTH'
  } else if (hasActive) {
    return 'ACTIVE'
  } else {
    return 'LASER' // Default to LASER
  }
}

/**
 * Find matching event formula based on participants and game type
 * Matches the logic in icount-documents.ts
 */
function findMatchingEventFormula(
  formulas: ICountEventFormula[],
  participants: number,
  gameType: 'LASER' | 'ACTIVE' | 'BOTH'
): ICountEventFormula | undefined {
  // Find matching formula (same logic as icount-documents.ts)
  for (const formula of formulas) {
    // Check participant count
    if (participants < formula.min_participants) continue
    if (participants > formula.max_participants) continue

    // Check game_type
    // Formula BOTH matches any game_type
    // Formula game_type must match booking game_type
    if (formula.game_type === 'BOTH') {
      // BOTH formula matches any game_type
      return formula
    } else if (formula.game_type === gameType) {
      return formula
    }
  }

  return undefined
}

/**
 * Calculate the price breakdown for a booking
 */
export function calculateBookingPrice(params: CalculatePriceParams): PriceCalculationResult {
  const {
    bookingType,
    participants,
    gameArea,
    numberOfGames = 1,
    gameDurations = [],
    eventQuickPlan = 'AA',
    eventRoomId,
    discountType,
    discountValue,
    products,
    eventFormulas,
    rooms
  } = params

  // Invalid if no participants
  if (participants < 1) {
    return {
      breakdown: '',
      total: 0,
      subtotal: 0,
      discountAmount: 0,
      valid: false,
      details: { participants: 0, unitPrice: 0 }
    }
  }

  let subtotal = 0
  let unitPrice = 0
  let unitLabel: string | undefined
  let roomPrice: number | undefined
  let roomName: string | undefined
  let breakdownParts: string[] = []

  if (bookingType === 'GAME') {
    if (gameArea === 'LASER') {
      // LASER: price per party × participants
      const product = findLaserProduct(products, numberOfGames)
      if (product) {
        unitPrice = product.unit_price
        subtotal = unitPrice * participants
        unitLabel = numberOfGames === 1 ? '1 partie' : `${numberOfGames} parties`
        breakdownParts.push(`${participants} × ${unitPrice}₪ (${unitLabel})`)
      } else {
        // No product found
        return {
          breakdown: 'Prix laser non configuré',
          total: 0,
          subtotal: 0,
          discountAmount: 0,
          valid: false,
          details: { participants, unitPrice: 0 }
        }
      }
    } else if (gameArea === 'ACTIVE') {
      // ACTIVE: price per duration × participants
      const totalDuration = gameDurations.reduce((sum, d) => sum + parseInt(d || '0'), 0)
      const product = findActiveProduct(products, totalDuration)
      if (product) {
        unitPrice = product.unit_price
        subtotal = unitPrice * participants
        unitLabel = formatDuration(totalDuration)
        breakdownParts.push(`${participants} × ${unitPrice}₪ (${unitLabel})`)
      } else {
        return {
          breakdown: 'Prix active non configuré',
          total: 0,
          subtotal: 0,
          discountAmount: 0,
          valid: false,
          details: { participants, unitPrice: 0 }
        }
      }
    } else if (gameArea === 'CUSTOM') {
      // CUSTOM: combine LASER and ACTIVE games
      const { customGameAreas = [], customGameDurations = [] } = params

      if (customGameAreas.length === 0) {
        return {
          breakdown: '',
          total: 0,
          subtotal: 0,
          discountAmount: 0,
          valid: false,
          details: { participants, unitPrice: 0 }
        }
      }

      // Calculate price for each game
      const priceDetails: string[] = []
      let totalUnitPrice = 0
      let laserCount = 0
      let activeDuration = 0

      for (let i = 0; i < customGameAreas.length; i++) {
        const area = customGameAreas[i]
        const duration = parseInt(customGameDurations[i] || '30', 10)

        if (area === 'LASER') {
          laserCount++
        } else if (area === 'ACTIVE') {
          activeDuration += duration
        }
      }

      // Add laser price if any laser games
      if (laserCount > 0) {
        const laserProduct = findLaserProduct(products, laserCount)
        if (laserProduct) {
          totalUnitPrice += laserProduct.unit_price
          const laserLabel = laserCount === 1 ? '1 partie' : `${laserCount} parties`
          priceDetails.push(`${laserProduct.unit_price}₪ (${laserLabel})`)
        }
      }

      // Add active price if any active games
      if (activeDuration > 0) {
        const activeProduct = findActiveProduct(products, activeDuration)
        if (activeProduct) {
          totalUnitPrice += activeProduct.unit_price
          priceDetails.push(`${activeProduct.unit_price}₪ (${formatDuration(activeDuration)})`)
        }
      }

      if (totalUnitPrice === 0) {
        return {
          breakdown: 'Prix non configurés',
          total: 0,
          subtotal: 0,
          discountAmount: 0,
          valid: false,
          details: { participants, unitPrice: 0 }
        }
      }

      unitPrice = totalUnitPrice
      subtotal = unitPrice * participants
      unitLabel = priceDetails.join(' + ')
      breakdownParts.push(`${participants} × (${priceDetails.join(' + ')})`)
    } else {
      // No game area selected
      return {
        breakdown: '',
        total: 0,
        subtotal: 0,
        discountAmount: 0,
        valid: false,
        details: { participants, unitPrice: 0 }
      }
    }
  } else if (bookingType === 'EVENT') {
    // EVENT: use formula matching based on participants and game type from quick plan
    const eventGameType = getEventGameTypeFromPlan(eventQuickPlan)
    const formula = findMatchingEventFormula(eventFormulas, participants, eventGameType)

    if (formula) {
      unitPrice = formula.price_per_person
      subtotal = unitPrice * participants
      breakdownParts.push(`${participants} × ${unitPrice}₪`)

      // Add room price if formula has a room
      const formulaRoomId = eventRoomId || formula.room_id
      if (formulaRoomId) {
        const room = rooms.find(r => r.id === formulaRoomId)
        if (room && room.price > 0) {
          roomPrice = room.price
          roomName = room.name_he || room.name
          subtotal += roomPrice
          breakdownParts.push(`${roomPrice}₪ (${roomName})`)
        }
      }
    } else {
      return {
        breakdown: 'Formule EVENT non trouvée',
        total: 0,
        subtotal: 0,
        discountAmount: 0,
        valid: false,
        details: { participants, unitPrice: 0 }
      }
    }
  }

  // Apply discount
  let discountAmount = 0
  const parsedDiscountValue = typeof discountValue === 'string'
    ? parseFloat(discountValue) || 0
    : discountValue || 0

  if (discountType && parsedDiscountValue > 0) {
    if (discountType === 'percent') {
      discountAmount = subtotal * (parsedDiscountValue / 100)
      breakdownParts.push(`-${parsedDiscountValue}%`)
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(parsedDiscountValue, subtotal)
      breakdownParts.push(`-${parsedDiscountValue}₪`)
    }
  }

  const total = Math.round(subtotal - discountAmount)
  const breakdown = breakdownParts.join(' + ').replace(' + -', ' ')

  return {
    breakdown,
    total,
    subtotal,
    discountAmount,
    valid: true,
    details: {
      participants,
      unitPrice,
      unitLabel,
      roomPrice,
      roomName,
      discountType,
      discountValue: parsedDiscountValue
    }
  }
}
