import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rjivngdklzzizojxbfim.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqaXZuZ2RrbHp6aXpvanhiZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1OTk2NDgsImV4cCI6MjA1MjE3NTY0OH0.W47rBT3SfhU3f-NZTdHNy4GHVz9Ct7OiS-1V6ciwMQU'
)

const { data, error } = await supabase
  .from('bookings')
  .select(`
    confirmation_code,
    game_sessions (
      start_datetime,
      end_datetime
    )
  `)
  .eq('confirmation_code', 'shmi-200')
  .single()

if (error) {
  console.error('Erreur:', error.message)
  process.exit(1)
}

console.log('Booking shmi-200:')
console.log('Raw start_datetime from DB:', data.game_sessions[0]?.start_datetime)
console.log('Raw end_datetime from DB:', data.game_sessions[0]?.end_datetime)

const start = new Date(data.game_sessions[0]?.start_datetime)
const end = new Date(data.game_sessions[0]?.end_datetime)

console.log('\nParsed by new Date():')
console.log('Start:', start.toISOString())
console.log('End:', end.toISOString())
console.log('\nHeures locales:')
console.log('Start local:', start.toLocaleString('fr-FR', { timeZone: 'Asia/Jerusalem' }))
console.log('End local:', end.toLocaleString('fr-FR', { timeZone: 'Asia/Jerusalem' }))
