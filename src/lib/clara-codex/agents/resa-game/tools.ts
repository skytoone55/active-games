import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { checkAvailability as checkGameAvailabilityFn } from '@/lib/availability-checker'
import type { AgentContext } from '../types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

/**
 * Convert LLM-facing params (duration for ACTIVE, numberOfGames for LASER) to internal numberOfGames.
 * Internal convention: 1 game = 30 min.
 * - ACTIVE: sold by duration (60/90/120 min) → 2/3/4 games
 * - LASER: sold by number of games (1/2/3)
 * - MIX: fixed at 1 game
 */
function resolveNumberOfGames(gameArea: string, duration?: number, numberOfGames?: number): number {
  if (gameArea === 'ACTIVE') {
    const dur = duration || 60
    return Math.round(dur / 30) // 60→2, 90→3, 120→4
  }
  if (gameArea === 'MIX') {
    return 1
  }
  // LASER
  return numberOfGames || 1
}

/** Format duration for display in tool results */
function formatDurationLabel(gameArea: string, numGames: number): string {
  if (gameArea === 'ACTIVE') {
    const totalMin = numGames * 30
    const hours = Math.floor(totalMin / 60)
    const mins = totalMin % 60
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`
  }
  return `${numGames} game${numGames > 1 ? 's' : ''}`
}

async function getBranchSettings(branchId: string) {
  const { data, error } = await supabase.from('branch_settings').select('*').eq('branch_id', branchId).single()
  if (error || !data) throw new Error('Branch settings not found')
  return data
}

async function findNearestSlot(params: {
  branchId: string; date: string; time: string; participants: number;
  gameArea: string; numberOfGames: number
}, direction: 'before' | 'after'): Promise<string | null> {
  const settings = await getBranchSettings(params.branchId)
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayName = new Date(params.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayName]
  if (!dayHours) return null

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const openTotal = toMin(dayHours.open)
  const closeTotal = toMin(dayHours.close)
  const reqTotal = toMin(params.time)

  for (let delta = 15; delta <= 240; delta += 15) {
    const next = direction === 'before' ? reqTotal - delta : reqTotal + delta
    if (next < openTotal || next >= closeTotal) continue
    const candidateTime = `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
    const result = await checkGameAvailabilityFn({
      branchId: params.branchId, date: params.date, time: candidateTime,
      participants: params.participants, type: 'GAME',
      gameArea: params.gameArea as 'ACTIVE' | 'LASER' | 'MIX', numberOfGames: params.numberOfGames,
    })
    if (result.available) return candidateTime
  }
  return null
}

export const checkGameAvailability = tool({
  description: 'Check availability for a GAME booking (Laser Tag or Active Games). Returns availability status and alternatives if not available.',
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID (UUID)'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/).describe('Time HH:MM'),
    participants: z.number().int().min(1).max(300),
    gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']),
    numberOfGames: z.number().int().min(1).max(6).optional()
      .describe('For LASER TAG only: number of games (1, 2, or 3). Each game is ~30 min.'),
    duration: z.number().int().optional()
      .describe('For ACTIVE GAMES only: total duration in minutes (60, 90, or 120).'),
  }),
  execute: async (params) => {
    if (!isValidDate(params.date)) return { available: false, reason: 'invalid_date', message: 'Invalid date format.' }
    if (!isValidTime(params.time)) return { available: false, reason: 'invalid_time', message: 'Invalid time format.' }
    if (params.date < getIsraelNowISODate()) return { available: false, reason: 'date_past', message: 'Date is in the past.' }

    const numGames = resolveNumberOfGames(params.gameArea, params.duration, params.numberOfGames)

    const result = await checkGameAvailabilityFn({
      branchId: params.branchId, date: params.date, time: params.time,
      participants: params.participants, type: 'GAME',
      gameArea: params.gameArea, numberOfGames: numGames,
    })

    if (result.available) {
      return {
        available: true,
        message: 'Slot is available.',
        details: {
          gameArea: params.gameArea,
          numberOfGames: numGames,
          duration: formatDurationLabel(params.gameArea, numGames),
        },
      }
    }

    // Build alternatives
    const altParams = { ...params, numberOfGames: numGames }
    const alternatives: Array<{ id: string; label: string; date: string | null; time: string | null; type: string }> = []

    const before = await findNearestSlot(altParams, 'before')
    if (before) alternatives.push({ id: `before_${before.replace(':', '')}`, label: `Before: ${before}`, date: params.date, time: before, type: 'slot' })

    const after = await findNearestSlot(altParams, 'after')
    if (after) alternatives.push({ id: `after_${after.replace(':', '')}`, label: `After: ${after}`, date: params.date, time: after, type: 'slot' })

    for (const offset of [-2, -1, 1, 2]) {
      const altDate = addDays(params.date, offset)
      if (altDate < getIsraelNowISODate()) continue
      const altResult = await checkGameAvailabilityFn({
        branchId: params.branchId, date: altDate, time: params.time,
        participants: params.participants, type: 'GAME',
        gameArea: params.gameArea, numberOfGames: numGames,
      })
      if (altResult.available) {
        alternatives.push({ id: `day_${offset}`, label: `${formatDayName(altDate)} ${altDate} ${params.time}`, date: altDate, time: params.time, type: 'slot' })
      }
    }

    alternatives.push({ id: 'custom_date', label: 'Suggest another date', date: null, time: null, type: 'custom' })

    return {
      available: false,
      reason: result.reason || 'not_available',
      message: result.message || 'Slot is not available.',
      alternatives: alternatives.slice(0, 7),
    }
  },
})

async function getBranchInfoById(branchId: string) {
  const { data } = await supabase.from('branches').select('slug, name, phone').eq('id', branchId).single()
  return data || null
}

export function createGameBookingLink(context: AgentContext) {
  return tool({
    description: 'Generate a prefilled booking URL for a GAME reservation. Email is mandatory.',
    inputSchema: z.object({
      type: z.literal('game'),
      players: z.number().int().min(1).max(300),
      gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']),
      numberOfGames: z.number().int().min(1).max(6).optional()
        .describe('For LASER TAG only: number of games (1, 2, or 3).'),
      duration: z.number().int().optional()
        .describe('For ACTIVE GAMES only: total duration in minutes (60, 90, or 120).'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
    execute: async (params) => {
      const branch = context.branchId ? await getBranchInfoById(context.branchId) : null
      if (!branch?.slug) return { success: false, error: 'Branch not found.' }

      const numGames = resolveNumberOfGames(params.gameArea, params.duration, params.numberOfGames)

      const name = context.contactName?.trim().split(/\s+/) || []
      const firstName = params.firstName || name[0] || 'Client'
      const lastName = params.lastName || name.slice(1).join(' ') || ''

      const urlParams = new URLSearchParams()
      urlParams.set('branch', branch.slug)
      urlParams.set('type', 'game')
      urlParams.set('players', String(params.players))
      urlParams.set('date', params.date)
      urlParams.set('time', params.time)
      urlParams.set('firstName', firstName)
      urlParams.set('phone', context.senderPhone)
      urlParams.set('email', params.email)
      if (lastName) urlParams.set('lastName', lastName)
      urlParams.set('gameArea', params.gameArea)
      urlParams.set('games', String(numGames))

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activegames.co.il'
      const bookingUrl = `${baseUrl}/reservation?${urlParams.toString()}`

      try {
        await supabase.from('orders').insert({
          branch_id: context.branchId,
          order_type: 'GAME',
          participants_count: params.players,
          game_area: params.gameArea,
          number_of_games: numGames,
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
        console.warn('[RESA GAME] Failed to store order lead:', e)
      }

      return {
        success: true,
        bookingUrl,
        duration: formatDurationLabel(params.gameArea, numGames),
        message: 'Share this URL with the customer. Booking confirmed only after payment.',
      }
    },
  })
}
