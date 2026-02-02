const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function fullBackup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  const filename = `full_backup_${timestamp}.sql`;

  console.log('Export FULL backup SQL...\n');

  const allTables = [
    'profiles', 'roles', 'role_permissions', 'user_branches',
    'branches', 'branch_settings', 'event_rooms', 'laser_rooms',
    'contacts', 'bookings', 'booking_slots', 'booking_contacts', 'game_sessions',
    'orders', 'payments', 'payment_credentials',
    'icount_products', 'icount_rooms', 'icount_event_formulas',
    'email_templates', 'email_logs',
    'activity_logs', 'calls',
    'ai_conversations', 'ai_messages',
    'public_conversations', 'public_messages',
    'system_settings'
  ];

  let sqlDump = `-- ============================================================================
-- FULL DATABASE BACKUP
-- ============================================================================
-- Generated: ${new Date().toISOString()}
-- Database: activelaser
-- Supabase Project: zapwlcrjnabrfhoxfgqo
-- ============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

`;

  let totalRows = 0;

  for (const table of allTables) {
    process.stdout.write(`Export ${table}...`);

    const { data, error } = await supabase.from(table).select('*');

    if (error) {
      console.log(` Skipped (${error.message})`);
      continue;
    }

    if (data && data.length > 0) {
      sqlDump += `\n-- ============================================================================\n`;
      sqlDump += `-- Table: ${table} (${data.length} rows)\n`;
      sqlDump += `-- ============================================================================\n\n`;

      // Get columns from first row
      const columns = Object.keys(data[0]);

      for (const row of data) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') {
            // Escape single quotes
            const escaped = val.replace(/'/g, "''").replace(/\\/g, '\\\\');
            return `'${escaped}'`;
          }
          if (typeof val === 'object') {
            const escaped = JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
            return `'${escaped}'::jsonb`;
          }
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          return val;
        }).join(', ');

        sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values});\n`;
      }

      totalRows += data.length;
      console.log(` ✓ ${data.length} rows`);
    } else {
      console.log(` ✓ 0 rows`);
    }
  }

  sqlDump += `\n-- ============================================================================\n`;
  sqlDump += `-- BACKUP COMPLETE\n`;
  sqlDump += `-- Total rows exported: ${totalRows}\n`;
  sqlDump += `-- ============================================================================\n`;

  fs.mkdirSync('supabase/backups', { recursive: true });
  fs.writeFileSync(`supabase/backups/${filename}`, sqlDump);

  const stats = fs.statSync(`supabase/backups/${filename}`);
  console.log(`\n✓ Backup créé: ${filename}`);
  console.log(`  Taille: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total rows: ${totalRows}`);

  return filename;
}

fullBackup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
