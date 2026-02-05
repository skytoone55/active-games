// Avec le Z
const startCheck = new Date('2026-02-06T10:00:00Z')
const endCheck = new Date('2026-02-06T11:00:00Z')

console.log('AVEC Z - Clara veut vérifier:')
console.log('  Start:', startCheck)
console.log('  End:', endCheck)

const bookingFromDB = {
  start_datetime: '2026-02-06T09:30:00',
  end_datetime: '2026-02-06T11:30:00'
}

const sessionStart = new Date(bookingFromDB.start_datetime)
const sessionEnd = new Date(bookingFromDB.end_datetime)

console.log('\nBooking en BD:')
console.log('  Start:', sessionStart)
console.log('  End:', sessionEnd)

const hasOverlap = sessionStart < endCheck && sessionEnd > startCheck
console.log('\nOverlap détecté?', hasOverlap)
