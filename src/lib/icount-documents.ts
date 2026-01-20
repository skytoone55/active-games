/**
 * iCount Documents Service
 * Service haut niveau pour synchroniser les bookings vers des devis/factures iCount
 *
 * Structure simplifiée:
 * - GAME: utilise icount_products directement (Laser X parties, Active Xmin)
 * - EVENT: utilise icount_event_formulas (game_type + price_per_person + room)
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ICountClient, ICountDocumentsModule } from '@/lib/payment-provider'
import type { ICountDocumentItem, DocumentResult } from '@/lib/payment-provider/icount/documents'
import type { Booking, GameArea } from '@/lib/supabase/types'

interface ICountCredentials {
  cid: string
  user: string
  pass: string
}

// Nouveau schéma simplifié des produits
interface ICountProduct {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  unit_price: number
  is_active: boolean
  sort_order: number
}

// Nouveau schéma des salles
interface ICountRoom {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  price: number
  is_active: boolean
}

// Nouveau schéma des formules EVENT
interface ICountEventFormula {
  id: string
  branch_id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
  room_id: string | null
  product_id: string | null // Direct link to icount_products (tier-based naming)
  is_active: boolean
  priority: number
}

interface BookingWithSessions extends Booking {
  game_sessions?: Array<{
    game_area: GameArea
    session_order: number
    start_datetime?: string
    end_datetime?: string
  }>
  // Discount fields
  discount_type?: 'percent' | 'fixed' | null
  discount_value?: number | null
}

// Create a raw Supabase client for fetching data
function createRawServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Get iCount credentials for a branch
 */
async function getICountCredentials(branchId: string): Promise<ICountCredentials | null> {
  const supabase = createRawServiceClient()

  const { data, error } = await supabase
    .from('payment_credentials')
    .select('cid, username, password')
    .eq('branch_id', branchId)
    .eq('provider', 'icount')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return null
  }

  return {
    cid: data.cid,
    user: data.username,
    pass: data.password
  }
}

/**
 * Get products for a branch
 */
async function getProducts(branchId: string): Promise<ICountProduct[]> {
  const supabase = createRawServiceClient()

  const { data, error } = await supabase
    .from('icount_products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('sort_order')

  if (error || !data) {
    console.error('[ICOUNT DOCS] Failed to fetch products:', error)
    return []
  }

  return data as ICountProduct[]
}

/**
 * Get rooms for a branch
 */
async function getRooms(branchId: string): Promise<ICountRoom[]> {
  const supabase = createRawServiceClient()

  const { data, error } = await supabase
    .from('icount_rooms')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error || !data) {
    console.error('[ICOUNT DOCS] Failed to fetch rooms:', error)
    return []
  }

  return data as ICountRoom[]
}

/**
 * Get EVENT formulas for a branch
 */
async function getEventFormulas(branchId: string): Promise<ICountEventFormula[]> {
  const supabase = createRawServiceClient()

  const { data, error } = await supabase
    .from('icount_event_formulas')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('priority', { ascending: false }) // Higher priority first

  if (error || !data) {
    console.error('[ICOUNT DOCS] Failed to fetch event formulas:', error)
    return []
  }

  return data as ICountEventFormula[]
}

/**
 * Convert HTML to plain text for iCount documents
 * Strips HTML tags and decodes entities
 */
function htmlToPlainText(html: string): string {
  if (!html) return ''

  let text = html
    // Replace <br>, <br/>, <br /> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Replace </p>, </div>, </li> with newlines
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    // Replace <li> with bullet point
    .replace(/<li[^>]*>/gi, '• ')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim()

  return text
}

/**
 * Get terms & conditions for a booking type
 * Returns plain text version for iCount documents
 */
async function getTermsConditionsForOffer(
  bookingType: 'GAME' | 'EVENT',
  locale: string = 'he'
): Promise<string> {
  const supabase = createRawServiceClient()

  // Determine template code
  const templateType = bookingType === 'EVENT' ? 'event' : 'game'
  const langCode = ['en', 'fr', 'he'].includes(locale) ? locale : 'he'
  const templateCode = `terms_${templateType}_${langCode}`

  // Fetch terms template
  const { data: template } = await supabase
    .from('email_templates')
    .select('body_template')
    .eq('code', templateCode)
    .eq('is_active', true)
    .single()

  if (template?.body_template) {
    return htmlToPlainText(template.body_template)
  }

  // Fallback to Hebrew if not found
  if (langCode !== 'he') {
    const { data: fallbackTemplate } = await supabase
      .from('email_templates')
      .select('body_template')
      .eq('code', `terms_${templateType}_he`)
      .eq('is_active', true)
      .single()

    if (fallbackTemplate?.body_template) {
      return htmlToPlainText(fallbackTemplate.body_template)
    }
  }

  return ''
}

/**
 * Find the best matching EVENT formula for a booking
 */
function findMatchingEventFormula(
  booking: BookingWithSessions,
  formulas: ICountEventFormula[]
): ICountEventFormula | null {
  const hasLaser = booking.game_sessions?.some(s => s.game_area === 'LASER') || false
  const hasActive = booking.game_sessions?.some(s => s.game_area === 'ACTIVE') || false

  // Determine booking's game_type
  let bookingGameType: 'LASER' | 'ACTIVE' | 'BOTH'
  if (hasLaser && hasActive) {
    bookingGameType = 'BOTH'
  } else if (hasActive) {
    bookingGameType = 'ACTIVE'
  } else {
    bookingGameType = 'LASER' // Default to LASER
  }

  console.log('[ICOUNT DOCS] Booking game_type:', bookingGameType, 'participants:', booking.participants_count)

  // Find matching formula (already sorted by priority desc)
  for (const formula of formulas) {
    // Check participant count
    if (booking.participants_count < formula.min_participants) continue
    if (booking.participants_count > formula.max_participants) continue

    // Check game_type
    if (formula.game_type === 'BOTH') {
      // Formula BOTH matches any game_type
    } else if (formula.game_type !== bookingGameType) {
      continue
    }

    console.log('[ICOUNT DOCS] Matched formula:', formula.name)
    return formula
  }

  return null
}

/**
 * Calculate the total duration in minutes for ACTIVE sessions
 */
function calculateActiveDurationMinutes(sessions: BookingWithSessions['game_sessions']): number {
  if (!sessions) return 0

  let totalMinutes = 0
  for (const session of sessions) {
    if (session.game_area === 'ACTIVE' && session.start_datetime && session.end_datetime) {
      const start = new Date(session.start_datetime)
      const end = new Date(session.end_datetime)
      const durationMs = end.getTime() - start.getTime()
      totalMinutes += Math.round(durationMs / 60000)
    }
  }
  return totalMinutes
}

/**
 * Find the best product for ACTIVE games based on duration
 * Products have codes like: active_30m, active_1h, active_1h30, active_2h
 */
function findActiveProduct(products: ICountProduct[], durationMinutes: number): ICountProduct | null {
  // Map duration to product codes
  const durationMap: { [key: string]: number } = {
    'active_30m': 30,
    'active_1h': 60,
    'active_1h30': 90,
    'active_2h': 120,
  }

  // Find product that matches duration (rounded to nearest standard duration)
  let bestProduct: ICountProduct | null = null
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
    bestProduct = products.find(p => p.code.startsWith('active_')) || null
  }

  return bestProduct
}

/**
 * Find the best product for LASER games based on number of parties
 * Products have codes like: laser_1p, laser_2p, laser_3p, laser_4p
 */
function findLaserProduct(products: ICountProduct[], numberOfParties: number): ICountProduct | null {
  const code = `laser_${Math.min(numberOfParties, 4)}p`
  return products.find(p => p.code === code) || null
}

/**
 * Calculate price and build items for a booking
 * Returns the items to put on the iCount document
 */
async function calculateBookingItems(
  booking: BookingWithSessions,
  branchId: string
): Promise<{ items: ICountDocumentItem[]; total: number; discountAmount: number }> {
  const products = await getProducts(branchId)
  const items: ICountDocumentItem[] = []
  let subtotal = 0
  let discountAmount = 0

  // Count sessions
  const laserSessions = booking.game_sessions?.filter(s => s.game_area === 'LASER') || []
  const activeSessions = booking.game_sessions?.filter(s => s.game_area === 'ACTIVE') || []

  console.log('[ICOUNT DOCS] Booking type:', booking.type)
  console.log('[ICOUNT DOCS] Laser sessions:', laserSessions.length)
  console.log('[ICOUNT DOCS] Active sessions:', activeSessions.length)
  console.log('[ICOUNT DOCS] Available products:', products.map(p => p.code).join(', '))

  if (booking.type === 'EVENT') {
    // EVENT: Use event formula to find matching product
    const formulas = await getEventFormulas(branchId)
    const formula = findMatchingEventFormula(booking, formulas)

    if (formula) {
      console.log('[ICOUNT DOCS] Using EVENT formula:', formula.name, 'game_type:', formula.game_type, 'price:', formula.price_per_person, 'product_id:', formula.product_id)

      // Find the matching EVENT product
      // 1. First try by direct product_id link (new tier-based system)
      // 2. Fallback: by tier-based code (event_laser_5_15)
      // 3. Legacy fallback: by price-based code (event_laser_120)
      let eventProduct: ICountProduct | undefined

      if (formula.product_id) {
        // Direct FK lookup (preferred)
        eventProduct = products.find(p => p.id === formula.product_id)
        if (eventProduct) {
          console.log('[ICOUNT DOCS] Found EVENT product via product_id:', eventProduct.code)
        }
      }

      if (!eventProduct) {
        // Tier-based code fallback
        const tierCode = `event_${formula.game_type.toLowerCase()}_${formula.min_participants}_${formula.max_participants}`
        eventProduct = products.find(p => p.code === tierCode)
        if (eventProduct) {
          console.log('[ICOUNT DOCS] Found EVENT product via tier code:', tierCode)
        }
      }

      if (!eventProduct) {
        // Legacy price-based code fallback
        const legacyCode = `event_${formula.game_type.toLowerCase()}_${formula.price_per_person}`
        eventProduct = products.find(p => p.code === legacyCode)
        if (eventProduct) {
          console.log('[ICOUNT DOCS] Found EVENT product via legacy code:', legacyCode)
        }
      }

      if (eventProduct) {
        console.log('[ICOUNT DOCS] Found EVENT product:', eventProduct.code)
        const lineTotal = eventProduct.unit_price * booking.participants_count
        subtotal += lineTotal

        items.push({
          sku: eventProduct.code, // Lien vers le produit iCount
          description: eventProduct.name_he || eventProduct.name,
          unitprice_incvat: eventProduct.unit_price, // Prix TTC
          quantity: booking.participants_count,
        })
      } else {
        // Fallback: use formula info without SKU link
        const expectedCode = formula.product_id
          ? `product_id:${formula.product_id}`
          : `event_${formula.game_type.toLowerCase()}_${formula.min_participants}_${formula.max_participants}`
        console.warn('[ICOUNT DOCS] No EVENT product found for:', expectedCode, '- using formula directly')
        const lineTotal = formula.price_per_person * booking.participants_count
        subtotal += lineTotal

        items.push({
          description: formula.name,
          unitprice_incvat: formula.price_per_person,
          quantity: booking.participants_count,
        })
      }

      // Add room price if formula has a room
      if (formula.room_id) {
        const rooms = await getRooms(branchId)
        const room = rooms.find(r => r.id === formula.room_id)
        if (room && room.price > 0) {
          // Find the matching room product
          const roomProductCode = `room_event_${room.price}`
          const roomProduct = products.find(p => p.code === roomProductCode)

          if (roomProduct) {
            console.log('[ICOUNT DOCS] Found ROOM product:', roomProduct.code)
            subtotal += roomProduct.unit_price
            items.push({
              sku: roomProduct.code, // Lien vers le produit iCount
              description: roomProduct.name_he || roomProduct.name,
              unitprice_incvat: roomProduct.unit_price, // Prix TTC
              quantity: 1,
            })
          } else {
            // Fallback: use room info without SKU link
            console.warn('[ICOUNT DOCS] No ROOM product found for:', roomProductCode, '- using room directly')
            subtotal += room.price
            items.push({
              description: room.name_he || room.name,
              unitprice_incvat: room.price,
              quantity: 1,
            })
          }
        }
      }
    } else {
      console.warn('[ICOUNT DOCS] No matching EVENT formula found')
      // Fallback: generic line
      items.push({
        description: 'אירוע',
        unitprice_incvat: 0,
        quantity: booking.participants_count,
      })
    }

  } else if (booking.type === 'GAME') {
    // GAME: Direct product lookup based on sessions

    if (laserSessions.length > 0) {
      // Laser pricing: laser_Xp based on number of parties
      const product = findLaserProduct(products, laserSessions.length)

      if (product) {
        console.log('[ICOUNT DOCS] Using Laser product:', product.code, 'price:', product.unit_price)
        // Price is per person (TTC)
        const quantity = booking.participants_count
        const lineTotal = product.unit_price * quantity
        subtotal += lineTotal

        items.push({
          sku: product.code, // Lien vers le produit iCount
          description: product.name_he || product.name,
          unitprice_incvat: product.unit_price, // Prix TTC
          quantity,
        })
      } else {
        console.warn('[ICOUNT DOCS] No Laser product found for', laserSessions.length, 'parties')
      }
    }

    if (activeSessions.length > 0) {
      // Active pricing: based on total duration
      const totalDuration = calculateActiveDurationMinutes(activeSessions)
      const product = findActiveProduct(products, totalDuration)

      if (product) {
        console.log('[ICOUNT DOCS] Using Active product:', product.code, 'duration:', totalDuration, 'min')
        // Price is per person (TTC)
        const quantity = booking.participants_count
        const lineTotal = product.unit_price * quantity
        subtotal += lineTotal

        items.push({
          sku: product.code, // Lien vers le produit iCount
          description: product.name_he || product.name,
          unitprice_incvat: product.unit_price, // Prix TTC
          quantity,
        })
      } else {
        console.warn('[ICOUNT DOCS] No Active product found for duration:', totalDuration, 'min')
      }
    }
  }

  // If no items found, create a generic line
  if (items.length === 0) {
    console.warn('[ICOUNT DOCS] No products matched for booking, creating generic line')
    items.push({
      description: booking.type === 'EVENT' ? 'אירוע' : 'משחק',
      unitprice_incvat: 0,
      quantity: booking.participants_count,
    })
  }

  // Apply discount if present
  if (booking.discount_type && booking.discount_value && booking.discount_value > 0) {
    if (booking.discount_type === 'percent') {
      discountAmount = subtotal * (booking.discount_value / 100)
    } else if (booking.discount_type === 'fixed') {
      discountAmount = Math.min(booking.discount_value, subtotal) // Don't discount more than total
    }

    if (discountAmount > 0) {
      console.log('[ICOUNT DOCS] Applying discount:', booking.discount_type, booking.discount_value, '=', discountAmount)
      items.push({
        description: booking.discount_type === 'percent'
          ? `הנחה ${booking.discount_value}%`
          : 'הנחה',
        unitprice_incvat: -discountAmount, // Remise TTC
        quantity: 1,
      })
    }
  }

  const total = subtotal - discountAmount

  return { items, total, discountAmount }
}

/**
 * Log iCount document action to activity_logs
 */
async function logICountDocument(
  booking: Booking,
  branchId: string,
  action: 'offer_created' | 'offer_cancelled' | 'invrec_created',
  success: boolean,
  docnum?: number,
  error?: string
): Promise<void> {
  const supabase = createRawServiceClient()

  const { error: insertError } = await supabase.from('activity_logs').insert({
    user_id: null,
    user_role: 'system',
    user_name: 'iCount Sync',
    action_type: 'booking_updated', // Using existing action type
    target_type: 'booking',
    target_id: booking.id,
    target_name: booking.reference_code,
    branch_id: branchId,
    details: {
      icount_action: action,
      success,
      docnum: docnum || null,
      error: error || null,
      booking_type: booking.type,
      participants: booking.participants_count,
    }
  })

  if (insertError) {
    console.error('[ICOUNT DOCS LOG] Failed to insert activity log:', insertError)
  }
}

/**
 * Create an offer (devis/הצעת מחיר) for a booking
 * Called when a booking is confirmed
 */
export async function createOfferForBooking(
  booking: BookingWithSessions,
  branchId: string
): Promise<{ success: boolean; offerId?: number; error?: string }> {
  console.log('[ICOUNT DOCS] === START createOfferForBooking ===')
  console.log('[ICOUNT DOCS] Booking:', booking.id, booking.reference_code)
  console.log('[ICOUNT DOCS] Branch:', branchId)

  try {
    // Get credentials for this branch
    const credentials = await getICountCredentials(branchId)

    if (!credentials) {
      // No iCount configured for this branch - not an error, just skip
      console.log('[ICOUNT DOCS] No iCount credentials for branch, skipping')
      return { success: true }
    }

    // Calculate items and total
    const { items, total } = await calculateBookingItems(booking, branchId)
    console.log('[ICOUNT DOCS] Calculated items:', items.length, 'Total:', total)
    console.log('[ICOUNT DOCS] Items:', JSON.stringify(items))

    // Create iCount client and module
    const icountClient = new ICountClient(credentials)
    const documentsModule = new ICountDocumentsModule(icountClient)

    // Build offer params
    const customerName = `${booking.customer_first_name} ${booking.customer_last_name || ''}`.trim()

    // Build description (hwc = hand written comment)
    const gameInfo = booking.game_sessions?.map(s => s.game_area).join(' + ') || booking.type

    // Get terms & conditions for the offer (in Hebrew)
    const termsConditions = await getTermsConditionsForOffer(booking.type as 'GAME' | 'EVENT', 'he')

    // Build hwc with booking info + terms
    const hwcParts = [
      `הזמנה #${booking.reference_code}`,
      `${booking.participants_count} משתתפים`,
      gameInfo,
    ]

    // Add separator and terms if available
    if (termsConditions) {
      hwcParts.push('')
      hwcParts.push('─'.repeat(40))
      hwcParts.push('')
      hwcParts.push(termsConditions)
    }

    const hwc = hwcParts.join('\n')

    // Use contact ID for linking if available
    const offerParams = {
      custom_client_id: booking.primary_contact_id || undefined,
      client_name: customerName,
      email: booking.customer_email || undefined,
      items,
      sanity_string: `booking-${booking.id}`, // Prevent duplicates
      doc_title: `הזמנה ${booking.reference_code}`,
      hwc,
      doc_lang: 'he',
    }

    console.log('[ICOUNT DOCS] Creating offer with sanity_string:', offerParams.sanity_string)

    const result = await documentsModule.createOffer(offerParams)

    if (result.success && result.data) {
      const offerId = result.data.docnum
      console.log('[ICOUNT DOCS] Offer created:', offerId)

      // Update booking with icount_offer_id
      const supabase = createRawServiceClient()
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          icount_offer_id: offerId,
          total_price: total, // Also update the total_price
        })
        .eq('id', booking.id)

      if (updateError) {
        console.warn('[ICOUNT DOCS] Failed to update booking with offer ID:', updateError)
      }

      // Log success
      await logICountDocument(booking, branchId, 'offer_created', true, offerId)

      return { success: true, offerId }
    }

    const errorMsg = result.error?.message || 'Failed to create offer'
    console.error('[ICOUNT DOCS] Failed to create offer:', errorMsg)

    // Log failure
    await logICountDocument(booking, branchId, 'offer_created', false, undefined, errorMsg)

    return { success: false, error: errorMsg }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT DOCS] Exception:', errorMsg)

    // Log error
    await logICountDocument(booking, branchId, 'offer_created', false, undefined, errorMsg)

    return { success: false, error: errorMsg }
  }
}

/**
 * Create offer in background (non-blocking)
 */
export function createOfferForBookingBackground(
  booking: BookingWithSessions,
  branchId: string
): void {
  console.log('[ICOUNT DOCS BG] Starting background offer creation for booking:', booking.id)
  createOfferForBooking(booking, branchId)
    .then((result) => {
      console.log('[ICOUNT DOCS BG] Background offer creation completed:', result)
    })
    .catch((err) => {
      console.error('[ICOUNT DOCS BG] Background offer creation error:', err)
    })
}

/**
 * Cancel an offer when a booking is cancelled
 */
export async function cancelOfferForBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[ICOUNT DOCS] === START cancelOfferForBooking ===')
  console.log('[ICOUNT DOCS] Booking ID:', bookingId)

  try {
    const supabase = createRawServiceClient()

    // Get booking with icount_offer_id
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, branch_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('[ICOUNT DOCS] Booking not found:', bookingError)
      return { success: false, error: 'Booking not found' }
    }

    if (!booking.icount_offer_id) {
      console.log('[ICOUNT DOCS] No offer ID on booking, nothing to cancel')
      return { success: true }
    }

    // Get credentials
    const credentials = await getICountCredentials(booking.branch_id)
    if (!credentials) {
      console.log('[ICOUNT DOCS] No iCount credentials, skipping cancel')
      return { success: true }
    }

    // Cancel the offer on iCount
    const icountClient = new ICountClient(credentials)
    const documentsModule = new ICountDocumentsModule(icountClient)

    const result = await documentsModule.cancelDocument(
      'offer',
      booking.icount_offer_id,
      reason || `Booking ${booking.reference_code} cancelled`
    )

    if (result.success) {
      console.log('[ICOUNT DOCS] Offer cancelled:', booking.icount_offer_id)

      // Clear the offer ID from booking
      await supabase
        .from('bookings')
        .update({ icount_offer_id: null })
        .eq('id', bookingId)

      // Log success
      await logICountDocument(
        booking as Booking,
        booking.branch_id,
        'offer_cancelled',
        true,
        booking.icount_offer_id
      )

      return { success: true }
    }

    const errorMsg = result.error?.message || 'Failed to cancel offer'
    console.error('[ICOUNT DOCS] Failed to cancel offer:', errorMsg)

    // Log failure (but don't fail the overall cancel operation)
    await logICountDocument(
      booking as Booking,
      booking.branch_id,
      'offer_cancelled',
      false,
      booking.icount_offer_id,
      errorMsg
    )

    // Return success anyway - we don't want to block booking cancellation
    return { success: true }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT DOCS] Exception during cancel:', errorMsg)
    // Return success anyway - we don't want to block booking cancellation
    return { success: true }
  }
}

/**
 * Cancel offer in background (non-blocking)
 */
export function cancelOfferForBookingBackground(
  bookingId: string,
  reason?: string
): void {
  console.log('[ICOUNT DOCS BG] Starting background offer cancellation for booking:', bookingId)
  cancelOfferForBooking(bookingId, reason)
    .then((result) => {
      console.log('[ICOUNT DOCS BG] Background offer cancellation completed:', result)
    })
    .catch((err) => {
      console.error('[ICOUNT DOCS BG] Background offer cancellation error:', err)
    })
}

/**
 * Cancel an offer directly using the offer ID and branch ID
 * Use this when the booking has already been deleted from the database
 */
export async function cancelOfferDirect(
  offerId: number,
  branchId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[ICOUNT DOCS] === START cancelOfferDirect ===')
  console.log('[ICOUNT DOCS] Offer ID:', offerId, 'Branch ID:', branchId)

  try {
    // Get credentials
    const credentials = await getICountCredentials(branchId)
    if (!credentials) {
      console.log('[ICOUNT DOCS] No iCount credentials, skipping cancel')
      return { success: true }
    }

    // Cancel the offer on iCount
    const icountClient = new ICountClient(credentials)
    const documentsModule = new ICountDocumentsModule(icountClient)

    const result = await documentsModule.cancelDocument(
      'offer',
      offerId,
      reason || 'Document cancelled'
    )

    if (result.success) {
      console.log('[ICOUNT DOCS] Offer cancelled:', offerId)
      return { success: true }
    }

    const errorMsg = result.error?.message || 'Failed to cancel offer'
    console.error('[ICOUNT DOCS] Failed to cancel offer:', errorMsg)
    // Return success anyway - we don't want to block the delete operation
    return { success: true }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT DOCS] Exception during cancel:', errorMsg)
    // Return success anyway - we don't want to block the delete operation
    return { success: true }
  }
}

/**
 * Cancel offer directly in background (non-blocking)
 * Use this when the booking has already been deleted from the database
 */
export function cancelOfferDirectBackground(
  offerId: number,
  branchId: string,
  reason?: string
): void {
  console.log('[ICOUNT DOCS BG] Starting background direct offer cancellation for offer:', offerId)
  cancelOfferDirect(offerId, branchId, reason)
    .then((result) => {
      console.log('[ICOUNT DOCS BG] Background direct offer cancellation completed:', result)
    })
    .catch((err) => {
      console.error('[ICOUNT DOCS BG] Background direct offer cancellation error:', err)
    })
}

/**
 * Convert an offer to invoice+receipt when payment is received
 * (For future use - when payment module is implemented)
 */
export async function convertOfferToInvoiceReceipt(
  bookingId: string
): Promise<{ success: boolean; invrecId?: number; error?: string }> {
  console.log('[ICOUNT DOCS] === START convertOfferToInvoiceReceipt ===')
  console.log('[ICOUNT DOCS] Booking ID:', bookingId)

  try {
    const supabase = createRawServiceClient()

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' }
    }

    if (!booking.icount_offer_id) {
      return { success: false, error: 'No offer exists for this booking' }
    }

    // Get credentials
    const credentials = await getICountCredentials(booking.branch_id)
    if (!credentials) {
      return { success: false, error: 'No iCount credentials configured' }
    }

    // Convert offer to invrec
    const icountClient = new ICountClient(credentials)
    const documentsModule = new ICountDocumentsModule(icountClient)

    const result = await documentsModule.convertOfferToInvoiceReceipt(
      booking.icount_offer_id,
      {
        custom_client_id: booking.primary_contact_id,
        sanity_string: `invrec-${booking.id}`,
      }
    )

    if (result.success && result.data) {
      const invrecId = result.data.docnum
      console.log('[ICOUNT DOCS] Invoice+Receipt created:', invrecId)

      // Update booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ icount_invrec_id: invrecId })
        .eq('id', booking.id)

      if (updateError) {
        console.warn('[ICOUNT DOCS] Failed to update booking with invrec ID:', updateError)
      }

      // Log success
      await logICountDocument(
        booking as Booking,
        booking.branch_id,
        'invrec_created',
        true,
        invrecId
      )

      return { success: true, invrecId }
    }

    const errorMsg = result.error?.message || 'Failed to convert offer'
    console.error('[ICOUNT DOCS] Failed to convert offer:', errorMsg)

    return { success: false, error: errorMsg }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[ICOUNT DOCS] Exception:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
