require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBookingDisplay() {
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, game_sessions(*), booking_slots(*)')
    .eq('reference_code', 'HTL3G4')
    .single();

  if (!booking) {
    console.log('❌ Booking non trouvé');
    return;
  }

  console.log('📊 DÉTAILS AFFICHAGE BOOKING HTL3G4\n');
  console.log('Type:', booking.type);
  console.log('Status:', booking.status);
  console.log('Branch ID:', booking.branch_id);
  console.log('Start:', new Date(booking.start_datetime).toString());
  console.log('Game start:', new Date(booking.game_start_datetime).toString());
  console.log('');

  console.log('🎮 Game Sessions:', booking.game_sessions?.length || 0);
  if (booking.game_sessions && booking.game_sessions.length > 0) {
    for (const session of booking.game_sessions) {
      const start = new Date(session.start_datetime);
      console.log(`  - Session ${session.session_order}: ${session.game_area}`);
      console.log(`    Start: ${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')}`);
      console.log(`    Laser Room ID: ${session.laser_room_id || 'NULL'}`);
      console.log(`    ID: ${session.id}`);
    }
  } else {
    console.log('  ⚠️  AUCUNE GAME SESSION!');
    console.log('  → Le booking ne peut PAS être affiché dans les colonnes LASER/ACTIVE');
  }

  console.log('\n📍 Booking Slots:', booking.booking_slots?.length || 0);
  if (booking.booking_slots && booking.booking_slots.length > 0) {
    for (const slot of booking.booking_slots) {
      const start = new Date(slot.slot_start);
      const end = new Date(slot.slot_end);
      console.log(`  - ${start.getHours()}h${String(start.getMinutes()).padStart(2,'0')} - ${end.getHours()}h${String(end.getMinutes()).padStart(2,'0')}`);
      console.log(`    Type: ${slot.slot_type}`);
      console.log(`    Participants: ${slot.participants_count}`);
    }
  } else {
    console.log('  ⚠️  AUCUN SLOT!');
    console.log('  → Le booking ne peut PAS être positionné dans l\'agenda');
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC:');
  console.log('═══════════════════════════════════════\n');

  let problemFound = false;

  if (!booking.game_sessions || booking.game_sessions.length === 0) {
    console.log('❌ PROBLÈME 1: Pas de game_sessions');
    console.log('   Les bookings GAME doivent avoir au moins une game_session');
    console.log('   pour être affichés dans les colonnes de slots (S1-S14, Laser)');
    problemFound = true;
  }

  if (!booking.booking_slots || booking.booking_slots.length === 0) {
    console.log('❌ PROBLÈME 2: Pas de booking_slots');
    console.log('   Les slots définissent où le booking apparaît dans la grille');
    problemFound = true;
  }

  if (problemFound) {
    console.log('\n💡 SOLUTION:');
    console.log('   Le booking a été créé SANS game_sessions et/ou booking_slots.');
    console.log('   C\'est un bug dans la création du booking via l\'API.');
    console.log('   Pour corriger:');
    console.log('   1. Supprimer ce booking défectueux');
    console.log('   2. Recréer la commande correctement');
    console.log('   3. OU ajouter manuellement les game_sessions et booking_slots manquants');
  } else {
    console.log('✅ Le booking a game_sessions ET booking_slots');
    console.log('   Le problème est ailleurs (cache, rendu, etc.)');
  }
}

checkBookingDisplay()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
