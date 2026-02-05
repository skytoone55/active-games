// Test simple: vérifier si le booking existe et comment sont stockées ses dates
const startCheck = new Date('2026-02-06T10:00:00')
const endCheck = new Date('2026-02-06T11:00:00')

console.log('Clara veut vérifier:')
console.log('  Start:', startCheck)
console.log('  End:', endCheck)

// Simuler ce que la BD pourrait retourner
const bookingFromDB = {
  start_datetime: '2026-02-06T09:30:00',
  end_datetime: '2026-02-06T11:30:00'
}

const sessionStart = new Date(bookingFromDB.start_datetime)
const sessionEnd = new Date(bookingFromDB.end_datetime)

console.log('\nBooking en BD:')
console.log('  Start:', sessionStart)
console.log('  End:', sessionEnd)

// Test overlap
const hasOverlap = sessionStart < endCheck && sessionEnd > startCheck
console.log('\nOverlap détecté?', hasOverlap)
console.log('  sessionStart < endCheck?', sessionStart < endCheck, '(', sessionStart.getTime(), '<', endCheck.getTime(), ')')
console.log('  sessionEnd > startCheck?', sessionEnd > startCheck, '(', sessionEnd.getTime(), '>', startCheck.getTime(), ')')
