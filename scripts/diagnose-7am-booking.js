require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Reproduire la même logique que le frontend
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

async function diagnose() {
  console.log('🔍 DIAGNOSTIC BOOKING 7H DU MATIN\n');
  console.log('==================================\n');

  // 1. Récupérer le booking HTL3G4
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('reference_code', 'HTL3G4')
    .single();

  if (!booking) {
    console.log('❌ Booking HTL3G4 non trouvé');
    return;
  }

  console.log('✅ Booking HTL3G4 trouvé\n');
  console.log('📅 Données brutes:');
  console.log('   start_datetime:', booking.start_datetime);
  console.log('   game_start_datetime:', booking.game_start_datetime);
  console.log('   branch_id:', booking.branch_id);
  console.log('   status:', booking.status);

  // 2. Simuler la conversion frontend
  console.log('\n🔧 Simulation conversion frontend:');
  const startDate = new Date(booking.start_datetime);
  const gameStartDate = new Date(booking.game_start_datetime || booking.start_datetime);

  console.log('   new Date(start_datetime):', startDate.toString());
  console.log('   Heure locale:', `${startDate.getHours()}h${String(startDate.getMinutes()).padStart(2,'0')}`);
  console.log('   extractLocalDateFromISO:', extractLocalDateFromISO(booking.start_datetime));

  // 3. Tester le filtre comme dans le frontend
  const today = new Date();
  const dateStr = formatDateToString(today);
  console.log('\n📆 Date actuelle:');
  console.log('   Aujourd\'hui:', today.toString());
  console.log('   dateStr formaté:', dateStr);

  // 4. Vérifier si le booking serait inclus
  const bookingDate = extractLocalDateFromISO(booking.start_datetime);
  const wouldBeIncluded = bookingDate === dateStr;

  console.log('\n🎯 Test filtre agenda:');
  console.log('   bookingDate:', bookingDate);
  console.log('   dateStr:', dateStr);
  console.log('   Match?', wouldBeIncluded ? '✅ OUI' : '❌ NON');

  if (!wouldBeIncluded) {
    console.log('\n   ⚠️  LE BOOKING N\'EST PAS POUR AUJOURD\'HUI!');
    console.log('   Le booking est pour:', bookingDate);
    console.log('   L\'agenda cherche:', dateStr);

    // Calculer pour quel jour
    const diff = new Date(bookingDate).getTime() - new Date(dateStr).getTime();
    const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) {
      console.log('   📌 Le booking est pour DEMAIN');
    } else if (daysDiff === -1) {
      console.log('   📌 Le booking était HIER');
    } else {
      console.log(`   📌 Le booking est dans ${daysDiff} jours`);
    }
  }

  // 5. Charger TOUS les bookings de cette branche
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, reference_code, start_datetime, game_start_datetime, status')
    .eq('branch_id', booking.branch_id)
    .neq('status', 'CANCELLED')
    .order('start_datetime');

  console.log(`\n📊 Total bookings branche (non-cancelled): ${allBookings?.length || 0}`);

  // Filtrer par date comme le frontend
  const todayBookings = allBookings?.filter(b => {
    const bDate = extractLocalDateFromISO(b.start_datetime);
    return bDate === dateStr;
  });

  console.log(`   Bookings aujourd'hui (${dateStr}): ${todayBookings?.length || 0}`);

  if (todayBookings && todayBookings.length > 0) {
    console.log('\n   Liste:');
    for (const b of todayBookings) {
      const start = new Date(b.game_start_datetime || b.start_datetime);
      console.log(`   - ${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')} ${b.reference_code} (${b.status})`);
    }
  }

  // Filtrer pour demain
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateToString(tomorrow);

  const tomorrowBookings = allBookings?.filter(b => {
    const bDate = extractLocalDateFromISO(b.start_datetime);
    return bDate === tomorrowStr;
  });

  console.log(`\n   Bookings demain (${tomorrowStr}): ${tomorrowBookings?.length || 0}`);

  if (tomorrowBookings && tomorrowBookings.length > 0) {
    console.log('\n   Liste:');
    for (const b of tomorrowBookings) {
      const start = new Date(b.game_start_datetime || b.start_datetime);
      const mark = b.reference_code === 'HTL3G4' ? '→ ' : '  ';
      console.log(`   ${mark}${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')} ${b.reference_code} (${b.status})`);
    }
  }

  // Conclusion
  console.log('\n==================================');
  console.log('📌 CONCLUSION:');
  if (bookingDate === tomorrowStr) {
    console.log('   Le booking HTL3G4 est programmé pour DEMAIN');
    console.log('   Pour le voir dans l\'agenda, il faut:');
    console.log('   1. Naviguer vers demain dans l\'agenda');
    console.log('   2. OU modifier le booking pour aujourd\'hui');
  } else if (bookingDate === dateStr) {
    console.log('   Le booking DEVRAIT apparaître aujourd\'hui');
    console.log('   Si tu ne le vois pas, le problème est ailleurs (cache, filtre branche, etc.)');
  } else {
    console.log(`   Le booking est pour: ${bookingDate}`);
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
