const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function verify() {
  console.log('VÉRIFICATION BACKUP STORAGE\n');

  const { data: files, error } = await supabase.storage
    .from('backups')
    .list('database');

  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  const backup = files.find(f => f.name === 'backup_AVANT_GLILOT_2026-02-02_22-24-37.sql');

  if (!backup) {
    console.error('❌ BACKUP INTROUVABLE');
    process.exit(1);
  }

  console.log('✅ Backup trouvé:');
  console.log('   Nom:', backup.name);
  console.log('   Taille:', (backup.metadata.size / 1024 / 1024).toFixed(2), 'MB');
  console.log('   Créé:', new Date(backup.created_at).toLocaleString());
  console.log('   ID:', backup.id);
}

verify().then(() => process.exit(0));
