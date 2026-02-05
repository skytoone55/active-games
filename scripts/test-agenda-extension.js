require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractLocalDateFromISO(isoString) {
  const date = new Date(isoString);
  return formatDateToString(date);
}

// COPIE EXACTE de la logique effectiveHours du frontend
function calculateEffectiveHours(bookings, selectedDate, visibleHoursStart, visibleHoursEnd) {
  let minHour = visibleHoursStart;
  let maxHour = visibleHoursEnd;
  const dateStr = formatDateToString(selectedDate);

  console.log(`\n🔧 Calcul heures effectives:`);
  console.log(`   Config initiale: ${minHour}h - ${maxHour}h`);
  console.log(`   Date recherchée: ${dateStr}`);
  console.log(`   Bookings à scanner: ${bookings.length}\n`);

  // Scanner les réservations du jour pour étendre si nécessaire
  for (const booking of bookings) {
    // Utiliser game_start_datetime si disponible, sinon start_datetime
    const startStr = booking.game_start_datetime || booking.start_datetime;
    const endStr = booking.game_end_datetime || booking.end_datetime;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    // Vérifier que la réservation est bien sur le jour sélectionné
    const bookingDate = new Date(startDate);
    bookingDate.setHours(0, 0, 0, 0);
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() !== selectedDateNormalized.getTime()) {
      console.log(`   ⏭️  Skip ${booking.reference_code}: date différente (${formatDateToString(bookingDate)})`);
      continue;
    }

    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();

    console.log(`   📌 Analyse ${booking.reference_code}:`);
    console.log(`      Start: ${startHour}h${String(startDate.getMinutes()).padStart(2,'0')}`);
    console.log(`      End: ${endHour}h${String(endMinute).padStart(2,'0')}`);

    // Étendre si la réservation commence avant l'heure de début visible
    if (startHour >= 0 && startHour < 6) {
      console.log(`      → Booking après minuit (0h-5h), étendre minHour à 0`);
      minHour = 0;
    } else if (startHour < minHour) {
      console.log(`      → startHour ${startHour} < minHour ${minHour}, étendre minHour à ${startHour}`);
      minHour = startHour;
    }

    // Étendre si la réservation finit après l'heure de fin visible
    if (endHour >= 0 && endHour < 6) {
      if (maxHour < 23) {
        console.log(`      → Finit après minuit, étendre maxHour à 23`);
        maxHour = 23;
      }
    } else if (endHour > maxHour || (endHour === maxHour && endMinute > 0)) {
      console.log(`      → endHour ${endHour} > maxHour ${maxHour}, étendre maxHour à ${endHour}`);
      maxHour = endHour;
    }

    console.log(`      État: minHour=${minHour}h, maxHour=${maxHour}h`);
  }

  return { minHour, maxHour };
}

async function testAgendaExtension() {
  console.log('🧪 TEST LOGIQUE EXTENSION AGENDA\n');
  console.log('==================================');

  const today = new Date();
  const dateStr = formatDateToString(today);

  // Charger les bookings d'aujourd'hui
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('branch_id', '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e') // Branche du booking HTL3G4
    .neq('status', 'CANCELLED')
    .order('start_datetime');

  if (!allBookings) {
    console.log('❌ Erreur chargement bookings');
    return;
  }

  // Filtrer par date comme le frontend
  const bookings = allBookings.filter(b => {
    const bDate = extractLocalDateFromISO(b.start_datetime);
    return bDate === dateStr;
  });

  console.log(`\n📅 Bookings aujourd'hui: ${bookings.length}`);
  for (const b of bookings) {
    const start = new Date(b.game_start_datetime || b.start_datetime);
    console.log(`   - ${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')} ${b.reference_code}`);
  }

  // Tester avec config par défaut
  const visibleHoursStart = 10;
  const visibleHoursEnd = 23;

  const result = calculateEffectiveHours(bookings, today, visibleHoursStart, visibleHoursEnd);

  console.log(`\n✅ RÉSULTAT FINAL:`);
  console.log(`   minHour: ${result.minHour}h`);
  console.log(`   maxHour: ${result.maxHour}h`);
  console.log(`   Plage affichée: ${result.minHour}h - ${result.maxHour}h`);

  if (result.minHour <= 7 && result.maxHour >= 7) {
    console.log(`\n   ✅ L'agenda DEVRAIT afficher 7h`);
    console.log(`   Si tu ne le vois pas:`);
    console.log(`   1. Vide le cache du navigateur`);
    console.log(`   2. Vérifie que tu regardes la bonne branche`);
    console.log(`   3. Rafraîchis la page (F5)`);
  } else {
    console.log(`\n   ❌ L'agenda NE va PAS afficher 7h`);
    console.log(`   C'est un BUG dans la logique d'extension`);
  }
}

testAgendaExtension()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
