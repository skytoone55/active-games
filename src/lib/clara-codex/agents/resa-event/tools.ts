import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createIsraelDateTime } from '@/lib/dates'
import type { AgentContext } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T00:00:00`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date
}

function isValidTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function getIsraelNowISODate(): string {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
}

function addDays(date: string, offset: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDayName(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

type EventType = 'event_active' | 'event_laser' | 'event_mix'

function getEventGameAreas(eventType: EventType): Array<'ACTIVE' | 'LASER'> {
  if (eventType === 'event_laser') return ['LASER', 'LASER']
  if (eventType === 'event_mix') return ['ACTIVE', 'LASER']
  return ['ACTIVE', 'ACTIVE']
}

async function findAvailableEventRoom(params: {
  branchId: string; participants: number; roomStart: Date; roomEnd: Date
}): Promise<{ id: string; name: string } | null> {
  const { data: eventRooms } = await supabase
    .from('event_rooms')
    .select('id, name, capacity, sort_order')
    .eq('branch_id', params.branchId)
    .eq('is_active', true)
    .order('sort_order')

  if (!eventRooms?.length) return null

  const suitable = eventRooms
    .filter(r => r.capacity >= params.participants)
    .sort((a, b) => a.capacity !== b.capacity ? a.capacity - b.capacity : (a.sort_order || 0) - (b.sort_order || 0))

  if (!suitable.length) return null

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, event_room_id, start_datetime, end_datetime')
    .eq('branch_id', params.branchId)
    .eq('type', 'EVENT')
    .neq('status', 'CANCELLED')

  for (const room of suitable) {
    let free = true
    for (const booking of (existingBookings || [])) {
      if (booking.event_room_id !== room.id) continue
      const bStart = new Date(booking.start_datetime)
      const bEnd = new Date(booking.end_datetime)
      if (params.roomStart < bEnd && params.roomEnd > bStart) { free = false; break }
    }
    if (free) return { id: room.id, name: room.name }
  }
  return null
}

async function checkActiveCapacity(params: {
  branchId: string; participants: number; start: Date; end: Date; maxPlayers: number
}): Promise<boolean> {
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, participants_count, game_sessions (id, game_area, start_datetime, end_datetime)')
    .eq('branch_id', params.branchId)
    .neq('status', 'CANCELLED')

  let cursor = new Date(params.start)
  while (cursor < params.end) {
    const slotStart = new Date(cursor)
    const slotEnd = new Date(slotStart.getTime() + 15 * 60000)
    let existing = 0

    for (const booking of (existingBookings || [])) {
      for (const session of (booking.game_sessions || [])) {
        if (session.game_area !== 'ACTIVE') continue
        const sStart = new Date(session.start_datetime)
        const sEnd = new Date(session.end_datetime)
        if (sStart < slotEnd && sEnd > slotStart) { existing += booking.participants_count; break }
      }
    }

    if (existing + params.participants > params.maxPlayers) return false
    cursor = slotEnd
  }
  return true
}

async function checkLaserAvailability(params: {
  branchId: string; participants: number; start: Date; end: Date
}): Promise<boolean> {
  const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')

  const [{ data: laserRooms }, { data: allBookings }, { data: settings }] = await Promise.all([
    supabase.from('laser_rooms').select('*').eq('branch_id', params.branchId).eq('is_active', true).order('sort_order'),
    supabase.from('bookings').select('id, branch_id, participants_count, status, game_sessions (id, game_area, laser_room_id, start_datetime, end_datetime)')
      .eq('branch_id', params.branchId).neq('status', 'CANCELLED'),
    supabase.from('branch_settings').select('laser_exclusive_threshold, laser_total_vests, laser_spare_vests').eq('branch_id', params.branchId).single(),
  ])

  const allocation = await findBestLaserRoomsForBooking({
    participants: params.participants, startDateTime: params.start, endDateTime: params.end, branchId: params.branchId,
    laserRooms: laserRooms || [],
    settings: { laser_exclusive_threshold: settings?.laser_exclusive_threshold || 10, laser_total_vests: settings?.laser_total_vests || 30, laser_spare_vests: settings?.laser_spare_vests || 0 },
    allBookings: allBookings || [], allocationMode: 'auto',
  })
  return !!allocation && allocation.roomIds.length > 0
}

async function checkEventSlot(params: {
  branchId: string; date: string; time: string; participants: number; eventType: EventType
}): Promise<{ available: boolean; reason?: string; message?: string; roomName?: string }> {
  const settings = await supabase.from('branch_settings').select('*').eq('branch_id', params.branchId).single()
  if (!settings.data) return { available: false, reason: 'no_settings', message: 'Branch settings not found.' }

  const openingHours = settings.data.opening_hours as Record<string, { open: string; close: string }> | null
  const dayName = new Date(params.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayName]

  if (!dayHours) return { available: false, reason: 'closed_day', message: 'Branch is closed on this date.' }
  if (params.time < dayHours.open || params.time >= dayHours.close) {
    return { available: false, reason: 'outside_hours', message: `Branch is open ${dayHours.open}-${dayHours.close}.` }
  }

  const gameDuration = settings.data.game_duration_minutes || 30
  const setupMinutes = 15
  const roomDurationMinutes = 120

  const roomStart = createIsraelDateTime(params.date, params.time)
  const roomEnd = new Date(roomStart.getTime() + roomDurationMinutes * 60000)

  const room = await findAvailableEventRoom({ branchId: params.branchId, participants: params.participants, roomStart, roomEnd })
  if (!room) return { available: false, reason: 'event_room_unavailable', message: 'No event room available at this time.' }

  const areas = getEventGameAreas(params.eventType)
  let current = new Date(roomStart.getTime() + setupMinutes * 60000)
  const maxPlayers = settings.data.max_concurrent_players || 84

  for (const area of areas) {
    const sessionStart = new Date(current)
    const sessionEnd = new Date(sessionStart.getTime() + gameDuration * 60000)

    if (area === 'ACTIVE') {
      const ok = await checkActiveCapacity({ branchId: params.branchId, participants: params.participants, start: sessionStart, end: sessionEnd, maxPlayers })
      if (!ok) return { available: false, reason: 'event_active_capacity', message: 'Event room is free but Active Games capacity is full.' }
    } else {
      const ok = await checkLaserAvailability({ branchId: params.branchId, participants: params.participants, start: sessionStart, end: sessionEnd })
      if (!ok) return { available: false, reason: 'event_laser_unavailable', message: 'Event room is free but Laser capacity is unavailable.' }
    }

    current = sessionEnd
  }

  return { available: true, message: 'Event slot is available.', roomName: room.name }
}

export const checkEventAvailability = tool({
  description: 'Check availability for an EVENT booking (birthday, team building). Checks event room + game areas (Active/Laser). Minimum 15 participants.',
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID (UUID)'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/).describe('Time HH:MM'),
    participants: z.number().int().min(15).max(300),
    eventType: z.enum(['event_active', 'event_laser', 'event_mix']).describe('event_active=AA, event_laser=LL, event_mix=AL'),
  }),
  execute: async (params) => {
    if (!isValidDate(params.date)) return { available: false, reason: 'invalid_date', message: 'Invalid date.' }
    if (!isValidTime(params.time)) return { available: false, reason: 'invalid_time', message: 'Invalid time.' }
    if (params.date < getIsraelNowISODate()) return { available: false, reason: 'date_past', message: 'Date is in the past.' }

    const result = await checkEventSlot(params)
    if (result.available) {
      return { available: true, message: result.message, details: { eventType: params.eventType, roomName: result.roomName } }
    }

    // Build alternatives
    const alternatives: Array<{ id: string; label: string; date: string | null; time: string | null; type: string }> = []

    for (const offset of [-2, -1, 1, 2]) {
      const altDate = addDays(params.date, offset)
      if (altDate < getIsraelNowISODate()) continue
      const altResult = await checkEventSlot({ ...params, date: altDate })
      if (altResult.available) {
        alternatives.push({ id: `day_${offset}`, label: `${formatDayName(altDate)} ${altDate} ${params.time}`, date: altDate, time: params.time, type: 'slot' })
      }
    }

    alternatives.push({ id: 'custom_date', label: 'Suggest another date', date: null, time: null, type: 'custom' })

    return {
      available: false,
      reason: result.reason,
      message: result.message,
      alternatives: alternatives.slice(0, 7),
    }
  },
})

export function createEventBookingLink(context: AgentContext) {
  return tool({
    description: 'Generate a prefilled booking URL for an EVENT reservation. Email is mandatory.',
    inputSchema: z.object({
      type: z.literal('event'),
      players: z.number().int().min(15).max(300),
      eventType: z.enum(['event_active', 'event_laser', 'event_mix']),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
    execute: async (params) => {
      const { data: branch } = await supabase.from('branches').select('slug').eq('id', context.branchId).single()
      if (!branch?.slug) return { success: false, error: 'Branch not found.' }

      const name = context.contactName?.trim().split(/\s+/) || []
      const firstName = params.firstName || name[0] || 'Client'
      const lastName = params.lastName || name.slice(1).join(' ') || ''

      const urlParams = new URLSearchParams()
      urlParams.set('branch', branch.slug)
      urlParams.set('type', 'event')
      urlParams.set('players', String(params.players))
      urlParams.set('date', params.date)
      urlParams.set('time', params.time)
      urlParams.set('firstName', firstName)
      urlParams.set('phone', context.senderPhone)
      urlParams.set('email', params.email)
      if (lastName) urlParams.set('lastName', lastName)
      urlParams.set('eventType', params.eventType)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'
      const bookingUrl = `${baseUrl}/reservation?${urlParams.toString()}`

      try {
        await supabase.from('orders').insert({
          branch_id: context.branchId,
          order_type: 'EVENT',
          participants_count: params.players,
          event_type: params.eventType,
          requested_date: params.date,
          requested_time: params.time,
          customer_first_name: firstName,
          customer_last_name: lastName || null,
          customer_phone: context.senderPhone,
          customer_email: params.email,
          status: 'aborted',
          source: 'clara_codex',
          request_reference: Math.random().toString(36).substring(2, 8).toUpperCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } catch (e) {
        console.warn('[RESA EVENT] Failed to store order lead:', e)
      }

      return { success: true, bookingUrl, message: 'Share this URL with the customer. Booking confirmed only after payment.' }
    },
  })
}
