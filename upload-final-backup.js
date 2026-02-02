const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function upload() {
  const filename = 'backup_AVANT_GLILOT_2026-02-02_22-24-37.sql';
  const filepath = `/Users/jeremy/Desktop/claude/data/supabase/${filename}`;

  console.log('Upload BACKUP FINAL avant Glilot...\n');

  const fileBuffer = fs.readFileSync(filepath);
  const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`Fichier: ${filename}`);
  console.log(`Taille: ${sizeMB} MB`);

  const { data, error } = await supabase.storage
    .from('backups')
    .upload(`database/${filename}`, fileBuffer, {
      contentType: 'application/sql',
      upsert: true
    });

  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Upload réussi:', data.path);

  // Delete old reference backup
  await supabase.storage.from('backups').remove(['database/backup_REFERENCE_2026-01-28.sql']);
  console.log('✓ Ancien backup supprimé\n');

  // List final files
  const { data: files } = await supabase.storage.from('backups').list('database');
  console.log('Fichiers dans bucket:');
  files.forEach(f => {
    const size = f.metadata?.size ? (f.metadata.size / 1024 / 1024).toFixed(2) + ' MB' : '?';
    console.log(`  - ${f.name} (${size})`);
  });
}

upload().then(() => process.exit(0));
