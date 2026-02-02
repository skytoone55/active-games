const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function upload() {
  const filename = 'backup_REFERENCE_2026-01-28.sql';
  const filepath = `supabase/backups/${filename}`;

  console.log('Upload backup REFERENCE (pg_dump complet)...');

  const fileBuffer = fs.readFileSync(filepath);

  const { data, error } = await supabase.storage
    .from('backups')
    .upload(`database/${filename}`, fileBuffer, {
      contentType: 'application/sql',
      upsert: true
    });

  if (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }

  console.log('✓ Upload réussi:', data.path);
  console.log('  Taille:', (fileBuffer.length / 1024).toFixed(0), 'KB');

  // Clean old incomplete backup
  await supabase.storage.from('backups').remove(['database/full_backup_2026-02-02_2203.sql']);
  console.log('\n✓ Ancien backup incomplet supprimé');

  console.log('\nFichier final dans bucket:');
  const { data: files } = await supabase.storage.from('backups').list('database');
  files.forEach(f => console.log(`  - ${f.name}`));
}

upload().then(() => process.exit(0));
