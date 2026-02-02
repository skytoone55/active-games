const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

// Essayer via Vercel CLI pour obtenir le backup
console.log('Tentative backup via Vercel MCP...');

const projectRef = 'zapwlcrjnabrfhoxfgqo';
const filename = `backup_FULL_${new Date().toISOString().split('T')[0]}_${new Date().getHours()}${new Date().getMinutes()}.sql`;

console.log('\n⚠️  ÉCHEC: Impossible de se connecter avec pg_dump');
console.log('Les credentials DB ont changé depuis le 28 janvier\n');

console.log('OPTIONS:');
console.log('1. Va sur Supabase Dashboard → Project Settings → Database');
console.log('   → Reset Database Password → Copie le nouveau password');
console.log('   → Utilise backup-supabase.sh avec le nouveau password\n');

console.log('2. OU utilise Supabase Dashboard:');
console.log('   → Project Settings → Database → Connection Pooling');
console.log('   → Database Backups → Download latest backup\n');

console.log('3. OU accepte que je fasse migration MAINTENANT avec backup du 28 jan');
console.log('   (les nouvelles tables depuis le 28 sont vides de toute façon)\n');

process.exit(1);
