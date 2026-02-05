import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rjivngdklzzizojxbfim.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqaXZuZ2RrbHp6aXpvanhiZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1OTk2NDgsImV4cCI6MjA1MjE3NTY0OH0.W47rBT3SfhU3f-NZTdHNy4GHVz9Ct7OiS-1V6ciwMQU'
)

const { data, error } = await supabase
  .from('bookings')
  .select(`
    confirmation_code,
    participants_count,
    status,
    game_sessions (
      game_area,
      start_datetime,
      end_datetime
    )
  `)
  .eq('confirmation_code', 'shmi-200')
  .single()

if (error) {
  console.error('Error:', error)
} else {
  console.log('Booking:', data.confirmation_code)
  console.log('Participants:', data.participants_count)
  console.log('Status:', data.status)
  console.log('\nGame Sessions:')
  data.game_sessions.forEach(s => {
    console.log(`  ${s.game_area}:`)
    console.log(`    Start DB: ${s.start_datetime}`)
    console.log(`    End DB: ${s.end_datetime}`)
    const start = new Date(s.start_datetime)
    const end = new Date(s.end_datetime)
    console.log(`    Start UTC: ${start.toISOString()}`)
    console.log(`    End UTC: ${end.toISOString()}`)
    console.log(`    Start Israel: ${start.toLocaleString('en-US', {timeZone: 'Asia/Jerusalem'})}`)
    console.log(`    End Israel: ${end.toLocaleString('en-US', {timeZone: 'Asia/Jerusalem'})}`)
  })
}
