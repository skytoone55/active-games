import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createIsraelDateTime } from '@/lib/dates'
import { checkAvailability as checkGameAvailability } from '@/lib/availability-checker'
import { getAvailableHumanStatus, trackCodexEvent } from './tracking'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type BookingType = 'GAME' | 'EVENT'
type GameArea = 'ACTIVE' | 'LASER' | 'MIX'
type EventType = 'event_active' | 'event_laser' | 'event_mix'

interface SimulationParams {
  branchId: string
  date: string
  time: string
  participants: number
  type: BookingType
  gameArea?: GameArea
  numberOfGames?: number
  eventType?: EventType
}

interface CoreSimulationResult {
  available: boolean
  reason?: string
  message?: string
  details?: Record<string, unknown>
}

function getEventGameAreas(eventType: EventType): Array<'ACTIVE' | 'LASER'> {
  if (eventType === 'event_laser') return ['LASER', 'LASER']
  if (eventType === 'event_mix') return ['ACTIVE', 'LASER']
  return ['ACTIVE', 'ACTIVE']
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === date
}

function isValidTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function getIsraelNowISODate(): string {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const year = local.getFullYear()
  const month = String(local.getMonth() + 1).padStart(2, '0')
  const day = String(local.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: string, offset: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + offset)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayName(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

async function getBranchSettings(branchId: string) {
  const { data, error } = await supabase
    .from('branch_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()

  if (error || !data) {
    throw new Error('Branch settings not found')
  }
  return data
}

async function getBranchInfoById(branchId: string): Promise<{ slug: string; name: string; phone: string | null } | null> {
  const { data } = await supabase
    .from('branches')
    .select('slug, name, phone')
    .eq('id', branchId)
    .single()
  return data || null
}

async function checkActiveCapacityWindow(params: {
  branchId: string
  participants: number
  start: Date
  end: Date
  maxPlayers: number
}): Promise<{ ok: boolean; current: number }> {
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      participants_count,
      game_sessions (
        id,
        game_area,
        start_datetime,
        end_datetime
      )
    `)
    .eq('branch_id', params.branchId)
    .neq('status', 'CANCELLED')

  const SLOT_MINUTES = 15
  let cursor = new Date(params.start)
  let peak = 0

  while (cursor < params.end) {
    const slotStart = new Date(cursor)
    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000)
    let existingParticipants = 0

    for (const booking of (existingBookings || [])) {
      for (const session of (booking.game_sessions || [])) {
        if (session.game_area !== 'ACTIVE') continue
        const sessionStart = new Date(session.start_datetime)
        const sessionEnd = new Date(session.end_datetime)
        if (sessionStart < slotEnd && sessionEnd > slotStart) {
          existingParticipants += booking.participants_count
          break
        }
      }
    }

    peak = Math.max(peak, existingParticipants)
    if (existingParticipants + params.participants > params.maxPlayers) {
      return { ok: false, current: existingParticipants }
    }
    cursor = slotEnd
  }

  return { ok: true, current: peak }
}

async function checkLaserAvailability(params: {
  branchId: string
  participants: number
  start: Date
  end: Date
}): Promise<boolean> {
  const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')

  const [{ data: laserRooms }, { data: allBookings }, { data: settings }] = await Promise.all([
    supabase
      .from('laser_rooms')
      .select('*')
      .eq('branch_id', params.branchId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('bookings')
      .select(`
        id,
        branch_id,
        participants_count,
        status,
        game_sessions (
          id,
          game_area,
          laser_room_id,
          start_datetime,
          end_datetime
        )
      `)
      .eq('branch_id', params.branchId)
      .neq('status', 'CANCELLED'),
    supabase
      .from('branch_settings')
      .select('laser_exclusive_threshold, laser_total_vests, laser_spare_vests')
      .eq('branch_id', params.branchId)
      .single(),
  ])

  const allocation = await findBestLaserRoomsForBooking({
    participants: params.participants,
    startDateTime: params.start,
    endDateTime: params.end,
    branchId: params.branchId,
    laserRooms: laserRooms || [],
    settings: {
      laser_exclusive_threshold: settings?.laser_exclusive_threshold || 10,
      laser_total_vests: settings?.laser_total_vests || 30,
      laser_spare_vests: settings?.laser_spare_vests || 0,
    },
    allBookings: allBookings || [],
    allocationMode: 'auto',
  })

  return !!allocation && allocation.roomIds.length > 0
}

async function simulateGameCore(params: SimulationParams): Promise<CoreSimulationResult> {
  const numGames = params.numberOfGames || 1
  const gameArea = params.gameArea || 'ACTIVE'

  const result = await checkGameAvailability({
    branchId: params.branchId,
    date: params.date,
    time: params.time,
    participants: params.participants,
    type: 'GAME',
    gameArea,
    numberOfGames: numGames,
  })

  if (!result.available) {
    return {
      available: false,
      reason: result.reason || 'not_available',
      message: result.message || 'Requested game slot is not available.',
      details: {
        alternatives: result.alternatives || null,
      },
    }
  }

  return {
    available: true,
    message: 'Requested game slot is available.',
    details: {
      gameArea,
      numberOfGames: numGames,
    },
  }
}

async function findAvailableEventRoom(params: {
  branchId: string
  participants: number
  roomStart: Date
  roomEnd: Date
}): Promise<{ id: string; name: string } | null> {
  const { data: eventRooms } = await supabase
    .from('event_rooms')
    .select('id, name, capacity, sort_order')
    .eq('branch_id', params.branchId)
    .eq('is_active', true)
    .order('sort_order')

  if (!eventRooms || eventRooms.length === 0) return null

  const suitable = eventRooms
    .filter(room => room.capacity >= params.participants)
    .sort((a, b) => {
      if (a.capacity !== b.capacity) return a.capacity - b.capacity
      return (a.sort_order || 0) - (b.sort_order || 0)
    })

  if (suitable.length === 0) return null

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, event_room_id, start_datetime, end_datetime')
    .eq('branch_id', params.branchId)
    .eq('type', 'EVENT')
    .neq('status', 'CANCELLED')

  for (const room of suitable) {
    let roomFree = true
    for (const booking of (existingBookings || [])) {
      if (booking.event_room_id !== room.id) continue
      const existingStart = new Date(booking.start_datetime)
      const existingEnd = new Date(booking.end_datetime)
      if (params.roomStart < existingEnd && params.roomEnd > existingStart) {
        roomFree = false
        break
      }
    }
    if (roomFree) {
      return { id: room.id, name: room.name }
    }
  }

  return null
}

async function simulateEventCore(params: SimulationParams): Promise<CoreSimulationResult> {
  if (!params.eventType) {
    return {
      available: false,
      reason: 'missing_event_type',
      message: 'Event type is required (event_active, event_laser, event_mix).',
    }
  }

  const settings = await getBranchSettings(params.branchId)
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayName = new Date(params.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayName]

  if (!dayHours) {
    return {
      available: false,
      reason: 'closed_day',
      message: 'Branch is closed on this date.',
    }
  }

  if (params.time < dayHours.open || params.time >= dayHours.close) {
    return {
      available: false,
      reason: 'outside_hours',
      message: `Branch is open ${dayHours.open}-${dayHours.close}.`,
    }
  }

  const gameDuration = settings.game_duration_minutes || 30
  const setupMinutes = 15
  const roomDurationMinutes = 120
  const roomStart = createIsraelDateTime(params.date, params.time)
  const roomEnd = new Date(roomStart.getTime() + roomDurationMinutes * 60000)

  const room = await findAvailableEventRoom({
    branchId: params.branchId,
    participants: params.participants,
    roomStart,
    roomEnd,
  })

  if (!room) {
    return {
      available: false,
      reason: 'event_room_unavailable',
      message: 'No suitable event room available at requested slot.',
    }
  }

  const eventAreas = getEventGameAreas(params.eventType)
  let current = new Date(roomStart.getTime() + setupMinutes * 60000)
  const maxPlayers = settings.max_concurrent_players || 84

  for (const area of eventAreas) {
    const sessionStart = new Date(current)
    const sessionEnd = new Date(sessionStart.getTime() + gameDuration * 60000)

    if (area === 'ACTIVE') {
      const active = await checkActiveCapacityWindow({
        branchId: params.branchId,
        participants: params.participants,
        start: sessionStart,
        end: sessionEnd,
        maxPlayers,
      })
      if (!active.ok) {
        return {
          available: false,
          reason: 'event_active_capacity',
          message: 'Event room is free but Active Games capacity is full at this time.',
        }
      }
    } else {
      const laserAvailable = await checkLaserAvailability({
        branchId: params.branchId,
        participants: params.participants,
        start: sessionStart,
        end: sessionEnd,
      })
      if (!laserAvailable) {
        return {
          available: false,
          reason: 'event_laser_unavailable',
          message: 'Event room is free but Laser capacity is unavailable at this time.',
        }
      }
    }

    current = sessionEnd
  }

  return {
    available: true,
    message: 'Requested event slot is available.',
    details: {
      eventRoomId: room.id,
      eventRoomName: room.name,
      eventType: params.eventType,
      gameSessions: eventAreas,
    },
  }
}

async function simulateCore(params: SimulationParams): Promise<CoreSimulationResult> {
  if (!params.branchId || params.branchId.length < 10) {
    return { available: false, reason: 'missing_branch', message: 'Branch is required.' }
  }
  if (!isValidDate(params.date)) {
    return { available: false, reason: 'invalid_date', message: 'Date must be YYYY-MM-DD.' }
  }
  if (!isValidTime(params.time)) {
    return { available: false, reason: 'invalid_time', message: 'Time must be HH:MM.' }
  }
  if (!Number.isInteger(params.participants) || params.participants < 1) {
    return { available: false, reason: 'invalid_participants', message: 'Participants must be a positive number.' }
  }
  if (params.date < getIsraelNowISODate()) {
    return { available: false, reason: 'date_past', message: 'Date is in the past.' }
  }

  if (params.type === 'GAME') {
    if (!params.gameArea) {
      return { available: false, reason: 'missing_game_area', message: 'Game area is required.' }
    }
    if (!params.numberOfGames || params.numberOfGames < 1) {
      return { available: false, reason: 'missing_number_of_games', message: 'Number of games is required.' }
    }
    return simulateGameCore(params)
  }

  if (params.participants < 15) {
    return {
      available: false,
      reason: 'event_minimum_participants',
      message: 'Event requires at least 15 participants. For smaller groups, use GAME booking.',
    }
  }
  return simulateEventCore(params)
}

async function isSlotAvailable(params: SimulationParams): Promise<boolean> {
  const res = await simulateCore(params)
  return res.available
}

async function findNearestSameDaySlot(params: SimulationParams, direction: 'before' | 'after'): Promise<string | null> {
  const settings = await getBranchSettings(params.branchId)
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayName = new Date(params.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayName]
  if (!dayHours) return null

  const [openHour, openMinute] = dayHours.open.split(':').map(Number)
  const [closeHour, closeMinute] = dayHours.close.split(':').map(Number)
  const [requestedHour, requestedMinute] = params.time.split(':').map(Number)

  const toMinutes = (h: number, m: number) => h * 60 + m
  const openTotal = toMinutes(openHour, openMinute)
  const closeTotal = toMinutes(closeHour, closeMinute)
  const requestedTotal = toMinutes(requestedHour, requestedMinute)

  const tryOffsets: number[] = []
  for (let delta = 15; delta <= 240; delta += 15) {
    tryOffsets.push(delta)
  }

  for (const offset of tryOffsets) {
    const next = direction === 'before' ? requestedTotal - offset : requestedTotal + offset
    if (next < openTotal || next >= closeTotal) continue
    const h = Math.floor(next / 60)
    const m = next % 60
    const candidateTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const ok = await isSlotAvailable({ ...params, time: candidateTime })
    if (ok) return candidateTime
  }

  return null
}

async function buildCodexAlternatives(params: SimulationParams) {
  const options: Array<{
    id: string
    label: string
    date: string | null
    time: string | null
    type: 'slot' | 'custom'
  }> = []

  const before = await findNearestSameDaySlot(params, 'before')
  if (before) {
    options.push({
      id: `before_${before.replace(':', '')}`,
      label: `Before: ${before}`,
      date: params.date,
      time: before,
      type: 'slot',
    })
  }

  const after = await findNearestSameDaySlot(params, 'after')
  if (after) {
    options.push({
      id: `after_${after.replace(':', '')}`,
      label: `After: ${after}`,
      date: params.date,
      time: after,
      type: 'slot',
    })
  }

  const dayOffsets = [-2, -1, 1, 2]
  for (const offset of dayOffsets) {
    const date = addDays(params.date, offset)
    const ok = await isSlotAvailable({ ...params, date })
    if (ok) {
      options.push({
        id: `day_${offset > 0 ? 'plus' : 'minus'}_${Math.abs(offset)}`,
        label: `${formatDayName(date)} ${date} ${params.time}`,
        date,
        time: params.time,
        type: 'slot',
      })
    }
  }

  options.push({
    id: 'custom_date',
    label: 'Suggest another date',
    date: null,
    time: null,
    type: 'custom',
  })

  return options.slice(0, 7)
}

export const getBranchInfo = tool({
  description: 'Get branch info (slug, address, phone, opening hours).',
  inputSchema: z.object({
    branchSlug: z.string().optional().describe('Optional branch slug, e.g. "rishon-lezion".'),
  }),
  execute: async ({ branchSlug }) => {
    let query = supabase
      .from('branches')
      .select('id, slug, name, name_en, phone, address, is_active')
      .eq('is_active', true)

    if (branchSlug) {
      const normalized = branchSlug.trim().toLowerCase().replace(/\s+/g, '-')
      query = query.ilike('slug', `%${normalized}%`)
    }

    const { data, error } = await query.order('name')
    if (error) return { error: error.message }
    return { branches: data || [] }
  },
})

export const getPricing = tool({
  description: 'Get pricing data for games/events.',
  inputSchema: z.object({
    branchId: z.string().optional(),
    category: z.enum(['all', 'game', 'event']).default('all'),
  }),
  execute: async ({ branchId, category }) => {
    let productsQuery = supabase
      .from('icount_products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (branchId) productsQuery = productsQuery.eq('branch_id', branchId)
    if (category === 'game') productsQuery = productsQuery.eq('category', 'game')
    if (category === 'event') productsQuery = productsQuery.eq('category', 'event_tariff')

    const [productsResult, formulasResult] = await Promise.all([
      productsQuery,
      supabase
        .from('icount_event_formulas')
        .select('*')
        .eq('is_active', true)
        .order('priority'),
    ])

    if (productsResult.error) return { error: productsResult.error.message }
    if (formulasResult.error) return { error: formulasResult.error.message }

    return {
      products: productsResult.data || [],
      eventFormulas: formulasResult.data || [],
    }
  },
})

export const simulateBooking = tool({
  description: `Simulate real booking availability for GAME or EVENT.
Collect all required information first, then call this tool.
Returns strict availability + alternatives (up to 7 clickable options).`,
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID (UUID).'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/).describe('Time HH:MM'),
    participants: z.number().int().min(1).max(300),
    type: z.enum(['GAME', 'EVENT']),
    gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']).optional(),
    numberOfGames: z.number().int().min(1).max(6).optional(),
    eventType: z.enum(['event_active', 'event_laser', 'event_mix']).optional(),
  }),
  execute: async (params) => {
    const simulation = await simulateCore(params)

    if (simulation.available) {
      return {
        available: true,
        message: simulation.message || 'Slot is available.',
        details: simulation.details || {},
      }
    }

    const alternatives = await buildCodexAlternatives(params)
    return {
      available: false,
      reason: simulation.reason || 'not_available',
      message: simulation.message || 'Slot is not available.',
      details: simulation.details || {},
      alternatives,
    }
  },
})

export const generateBookingLink = tool({
  description: `Generate prefilled booking URL after availability is confirmed.
Email is mandatory before generating the link.`,
  inputSchema: z.object({
    branchSlug: z.string().describe('Branch slug, e.g. rishon-lezion'),
    type: z.enum(['game', 'event']),
    players: z.number().int().min(1).max(300),
    gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']).optional(),
    numberOfGames: z.number().int().min(1).max(6).optional(),
    eventType: z.enum(['event_active', 'event_laser', 'event_mix']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    phone: z.string().min(6),
    email: z.string().email(),
  }),
  execute: async ({
    branchSlug,
    type,
    players,
    gameArea,
    numberOfGames,
    eventType,
    date,
    time,
    firstName,
    lastName,
    phone,
    email,
  }) => {
    if (!isValidDate(date)) {
      return { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' }
    }
    if (!isValidTime(time)) {
      return { success: false, error: 'Invalid time format. Use HH:MM.' }
    }
    if (!email?.trim()) {
      return { success: false, error: 'Email is required before generating booking link.' }
    }

    if (type === 'game' && (!gameArea || !numberOfGames)) {
      return { success: false, error: 'Game area and number of games are required for game booking.' }
    }
    if (type === 'event' && players < 15) {
      return { success: false, error: 'Event booking requires at least 15 participants.' }
    }

    const params = new URLSearchParams()
    params.set('branch', branchSlug)
    params.set('type', type)
    params.set('players', String(players))
    params.set('date', date)
    params.set('time', time)
    params.set('firstName', firstName)
    params.set('phone', phone)
    params.set('email', email)
    if (lastName) params.set('lastName', lastName)
    if (gameArea) params.set('gameArea', gameArea)
    if (numberOfGames) params.set('games', String(numberOfGames))
    if (eventType) params.set('eventType', eventType)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'
    const bookingUrl = `${baseUrl}/reservation?${params.toString()}`

    try {
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('slug', branchSlug)
        .single()

      if (branch?.id) {
        await supabase
          .from('orders')
          .insert({
            branch_id: branch.id,
            order_type: type.toUpperCase(),
            participants_count: players,
            game_area: gameArea || null,
            number_of_games: numberOfGames || null,
            event_type: eventType || null,
            requested_date: date,
            requested_time: time,
            customer_first_name: firstName,
            customer_last_name: lastName || null,
            customer_phone: phone,
            customer_email: email,
            status: 'aborted',
            source: 'clara_codex',
            request_reference: Math.random().toString(36).substring(2, 8).toUpperCase(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
      }
    } catch (error) {
      console.warn('[Clara Codex] Failed to store aborted order lead:', error)
    }

    return {
      success: true,
      bookingUrl,
      message: 'Share this exact URL with the customer. Booking is confirmed only after payment.',
      summary: {
        branchSlug,
        type,
        players,
        date,
        time,
      },
    }
  },
})

export function createEscalateToHumanTool(conversationId: string, branchId: string | null | undefined) {
  return tool({
    description: `Flag this conversation for human follow-up.
Use for complaints, uncertainty, complex context, tool failure, or explicit user request.`,
    inputSchema: z.object({
      reason: z.string().min(2).describe('Short reason for escalation'),
      silent: z.boolean().optional().describe('If true, keep escalation internal when possible'),
    }),
    execute: async ({ reason, silent }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          needs_human: true,
          needs_human_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      if (error) {
        return { success: false, error: error.message }
      }

      const availability = await getAvailableHumanStatus(branchId || null)
      await trackCodexEvent(supabase, conversationId, branchId || null, 'escalated_to_human', {
        reason,
        silent: !!silent,
        humanAvailable: availability.available,
        connectedCount: availability.connectedCount,
      })

      return {
        success: true,
        humanAvailable: availability.available,
        connectedCount: availability.connectedCount,
        message: 'Conversation flagged for human follow-up.',
      }
    },
  })
}

function createWhatsAppGenerateBookingLink(context: {
  senderPhone?: string
  contactName?: string
  branchId?: string | null
}) {
  return tool({
    description: generateBookingLink.description,
    inputSchema: generateBookingLink.inputSchema,
    execute: async (params, options) => {
      if (!params.phone && context.senderPhone) {
        params.phone = context.senderPhone
      }

      if (!params.firstName && context.contactName) {
        const parts = context.contactName.trim().split(/\s+/)
        params.firstName = parts[0] || 'Client'
        if (!params.lastName && parts.length > 1) {
          params.lastName = parts.slice(1).join(' ')
        }
      }

      if ((!params.branchSlug || params.branchSlug.trim().length === 0) && context.branchId) {
        const branch = await getBranchInfoById(context.branchId)
        if (branch?.slug) {
          params.branchSlug = branch.slug
        }
      }

      return generateBookingLink.execute!(params, options)
    },
  })
}

export function createCodexWhatsAppTools(context: {
  conversationId: string
  branchId: string | null
  senderPhone?: string
  contactName?: string
}) {
  return {
    simulateBooking,
    generateBookingLink: createWhatsAppGenerateBookingLink(context),
    escalateToHuman: createEscalateToHumanTool(context.conversationId, context.branchId),
  }
}
