require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllSlots() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, reference_code, start_datetime, game_start_datetime, booking_slots(*)')
    .gte('start_datetime', today.toISOString())
    .lt('start_datetime', tomorrow.toISOString())
    .order('start_datetime');

  console.log('🔍 VÉRIFICATION TOUS LES SLOTS AUJOURD\'HUI\n');

  for (const b of bookings || []) {
    const start = new Date(b.game_start_datetime || b.start_datetime);
    console.log(`${b.reference_code} - ${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')}`);

    if (b.booking_slots && b.booking_slots.length > 0) {
      for (const slot of b.booking_slots) {
        const slotStart = new Date(slot.slot_start);
        const slotEnd = new Date(slot.slot_end);
        const duration = Math.round((slotEnd - slotStart) / 60000);
        console.log(`  → Slot: ${slotStart.getHours()}h${String(slotStart.getMinutes()).padStart(2,'0')} - ${slotEnd.getHours()}h${String(slotEnd.getMinutes()).padStart(2,'0')} (durée: ${duration} min)`);

        if (duration === 1) {
          console.log('     ⚠️  SLOT DE 1 MINUTE - BUG !');
        } else if (duration > 1) {
          console.log('     ✅ Slot OK');
        }
      }
    } else {
      console.log('  → Pas de slots');
    }
    console.log('');
  }
}

checkAllSlots()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
