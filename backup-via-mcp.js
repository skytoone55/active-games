// Backup complet via MCP Supabase (avec structure)
const fs = require('fs');
const { execSync } = require('child_process');

const timestamp = new Date().toISOString().split('T')[0] + '_' +
  String(new Date().getHours()).padStart(2, '0') +
  String(new Date().getMinutes()).padStart(2, '0');

const filename = `backup_MCP_FULL_${timestamp}.sql`;

console.log('Création backup COMPLET via pg_dump avec MCP Supabase...\n');

try {
  // Utiliser le MCP Supabase configuré pour faire le dump
  const result = execSync(`npx supabase db dump --linked -f "supabase/backups/${filename}" --use-copy`, {
    encoding: 'utf-8',
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: process.env.VERCEL_OIDC_TOKEN || process.env.SUPABASE_ACCESS_TOKEN
    }
  });

  console.log(result);

  const stats = fs.statSync(`supabase/backups/${filename}`);
  console.log(`\n✅ Backup créé: ${filename}`);
  console.log(`   Taille: ${(stats.size / 1024).toFixed(0)} KB`);

} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.log('\n💡 Alternative: Utilise directement npx supabase db dump');
  process.exit(1);
}
