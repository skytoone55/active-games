const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function createGlilotBranch() {
  console.log('🚀 CRÉATION BRANCH GLILOT\n');

  // 1. INSERT BRANCH
  console.log('1. Création branch...');
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .insert({
      slug: 'glilot',
      name: 'Glilot',
      name_en: 'Glilot',
      address: '',
      phone: '',
      phone_extension: '',
      timezone: 'Asia/Jerusalem',
      is_active: true
    })
    .select()
    .single();

  if (branchError) {
    console.error('❌ Erreur création branch:', branchError.message);
    process.exit(1);
  }

  const branchId = branch.id;
  console.log('✅ Branch créée:', branchId);

  // 2. INSERT BRANCH_SETTINGS
  console.log('\n2. Création settings...');
  const { error: settingsError } = await supabase
    .from('branch_settings')
    .insert({
      branch_id: branchId,
      max_concurrent_players: 24,
      slot_duration_minutes: 15,
      game_duration_minutes: 30,
      event_total_duration_minutes: 120,
      event_game_duration_minutes: 60,
      event_buffer_before_minutes: 15,
      event_buffer_after_minutes: 15,
      event_min_participants: 1,
      game_price_per_person: '0.00',
      bracelet_price: '0.00',
      event_price_15_29: '0.00',
      event_price_30_plus: '0.00',
      total_slots: 4,
      max_players_per_slot: 6,
      laser_total_vests: 30,
      laser_enabled: true,
      icount_auto_send_quote: true,
      clara_enabled: false,
      clara_settings: {},
      opening_hours: {
        monday: { open: '10:00', close: '22:00' },
        tuesday: { open: '10:00', close: '22:00' },
        wednesday: { open: '10:00', close: '22:00' },
        thursday: { open: '10:00', close: '22:00' },
        friday: { open: '10:00', close: '22:00' },
        saturday: { open: '10:00', close: '22:00' },
        sunday: { open: '10:00', close: '22:00' }
      }
    });

  if (settingsError) {
    console.error('❌ Erreur settings:', settingsError.message);
    process.exit(1);
  }

  console.log('✅ Settings créés');

  // 3. INSERT EVENT_ROOMS
  console.log('\n3. Création event rooms...');
  const { error: eventRoomsError } = await supabase
    .from('event_rooms')
    .insert([
      {
        branch_id: branchId,
        slug: 'salle-anniversaire-1',
        name: 'Salle Anniversaire 1',
        name_en: 'Birthday Room 1',
        capacity: 25,
        sort_order: 1,
        is_active: true
      },
      {
        branch_id: branchId,
        slug: 'salle-anniversaire-2',
        name: 'Salle Anniversaire 2',
        name_en: 'Birthday Room 2',
        capacity: 30,
        sort_order: 2,
        is_active: true
      }
    ]);

  if (eventRoomsError) {
    console.error('❌ Erreur event rooms:', eventRoomsError.message);
    process.exit(1);
  }

  console.log('✅ 2 event rooms créées');

  // 4. INSERT LASER_ROOMS
  console.log('\n4. Création laser room...');
  const { error: laserRoomError } = await supabase
    .from('laser_rooms')
    .insert({
      branch_id: branchId,
      slug: 'laser-glilot',
      name: 'Laser Glilot',
      name_en: 'Laser Glilot',
      capacity: 30,
      sort_order: 1,
      is_active: true
    });

  if (laserRoomError) {
    console.error('❌ Erreur laser room:', laserRoomError.message);
    process.exit(1);
  }

  console.log('✅ Laser room créée');

  // 5. VÉRIFICATION
  console.log('\n5. Vérification finale...');

  const { data: verification, error: verifyError } = await supabase
    .from('branches')
    .select(`
      slug,
      name,
      branch_settings(total_slots, laser_total_vests, laser_enabled),
      event_rooms(count),
      laser_rooms(count)
    `)
    .eq('id', branchId)
    .single();

  if (verifyError) {
    console.error('❌ Erreur vérification:', verifyError.message);
  }

  // Count icount_products
  const { count: productCount } = await supabase
    .from('icount_products')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', branchId);

  console.log('\n📊 RÉSULTAT:');
  console.log('   Branch:', verification.slug);
  console.log('   Slots:', verification.branch_settings[0]?.total_slots);
  console.log('   Laser vests:', verification.branch_settings[0]?.laser_total_vests);
  console.log('   Laser enabled:', verification.branch_settings[0]?.laser_enabled);
  console.log('   Event rooms:', verification.event_rooms.length);
  console.log('   Laser rooms:', verification.laser_rooms.length);
  console.log('   iCount products:', productCount);

  console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS');
}

createGlilotBranch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ ERREUR FATALE:', err);
    process.exit(1);
  });
