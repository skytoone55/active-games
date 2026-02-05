require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findOrderHTL3G4() {
  console.log('🔍 Recherche order HTL3G4...\n');

  // Chercher booking avec reference_code HTL3G4
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('reference_code', 'HTL3G4')
    .single();

  if (bookingError || !booking) {
    console.log('❌ Aucun booking avec reference_code HTL3G4');
    console.log('Error:', bookingError?.message);
    return;
  }

  console.log('✅ BOOKING TROUVÉ!');
  console.log('==================\n');

  const start = new Date(booking.game_start_datetime || booking.start_datetime);
  const end = new Date(booking.game_end_datetime || booking.end_datetime);

  console.log('📅 Booking ID:', booking.id);
  console.log('   Reference:', booking.reference_code);
  console.log('   Type:', booking.type);
  console.log('   Status:', booking.status);
  console.log('   Branch ID:', booking.branch_id);
  console.log('   Participants:', booking.participants_count);
  console.log('   Client:', booking.customer_first_name, booking.customer_last_name);
  console.log('');
  console.log('⏰ Horaires:');
  console.log('   Start:', start.toISOString());
  console.log('   Heure début:', `${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')}`);
  console.log('   Heure fin:', `${end.getHours()}h${String(end.getMinutes()).padStart(2,'0')}`);
  console.log('   Date:', start.toISOString().split('T')[0]);

  if (start.getHours() === 7) {
    console.log('\n   ✅ BOOKING À 7H DU MATIN CONFIRMÉ!');
  } else if (start.getHours() < 10) {
    console.log(`\n   ⚠️  BOOKING MATINAL (${start.getHours()}h) - avant 10h`);
  }

  // Chercher l'order associé
  console.log('\n📦 Recherche order associé...');
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('booking_id', booking.id)
    .single();

  if (orderError || !order) {
    console.log('   ❌ Aucun order associé à ce booking');
    console.log('   Error:', orderError?.message);
  } else {
    console.log('   ✅ Order trouvé:', order.id);
    console.log('   Type:', order.order_type);
    console.log('   Status:', order.status);
    console.log('   Total:', order.total_amount, '₪');
    console.log('   Créé:', new Date(order.created_at).toISOString());
  }

  // Vérifier si le booking apparaît dans la liste des bookings du jour
  console.log('\n🔍 Vérification affichage agenda...');
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: dayBookings, error: dayError } = await supabase
    .from('bookings')
    .select('id, reference_code, start_datetime, game_start_datetime, status')
    .eq('branch_id', booking.branch_id)
    .gte('start_datetime', dayStart.toISOString())
    .lte('start_datetime', dayEnd.toISOString())
    .order('start_datetime');

  if (!dayError && dayBookings) {
    console.log(`   Total bookings ce jour: ${dayBookings.length}`);
    console.log('\n   Bookings du jour:');
    for (const b of dayBookings) {
      const bStart = new Date(b.game_start_datetime || b.start_datetime);
      const mark = b.id === booking.id ? '→' : ' ';
      console.log(`   ${mark} ${bStart.getHours()}h${String(bStart.getMinutes()).padStart(2,'0')} - ${b.reference_code} - ${b.status}`);
    }
  }
}

findOrderHTL3G4()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
