/**
 * Script de création d'une sauvegarde complète de la base de données
 * Date: 2026-02-04
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createFullBackup() {
  console.log('🚀 CRÉATION BACKUP COMPLET DE LA BASE DE DONNÉES\n');

  const tables = [
    'profiles',
    'roles',
    'role_permissions',
    'branches',
    'branch_settings',
    'user_branches',
    'contacts',
    'orders',
    'calls',
    'laser_rooms',
    'event_rooms',
    'activity_logs',
    'icount_products',
    'payment_credentials',
    'payments',
    'email_settings',
    'email_templates',
    'email_logs',
    'system_settings',
    'clara_rate_limits',
    'public_conversations',
    'public_messages',
    'ai_conversations',
    'ai_messages'
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  let sql = `-- ============================================================================
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

  for (const table of tables) {
    console.log(`   Exporting ${table}...`);

    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' });

    if (error) {
      if (error.code === 'PGRST116') {
        // Table n'existe pas, on continue
        console.log(`   ⚠️  ${table} n'existe pas, ignoré`);
        continue;
      }
      console.error(`   ❌ Erreur sur ${table}:`, error.message);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`   ⚪ ${table} est vide`);
      continue;
    }

    totalRows += data.length;
    console.log(`   ✅ ${table}: ${count} lignes`);

    sql += `
-- ============================================================================
-- Table: ${table} (${count} rows)
-- ============================================================================

`;

    for (const row of data) {
      const columns = Object.keys(row).join(', ');
      const values = Object.values(row).map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v;
        if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
        return "'" + String(v).replace(/'/g, "''") + "'";
      }).join(', ');

      sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
    }
  }

  // Sauvegarder dans deux endroits
  const filename = `backup_COMPLET_2026-02-04_${timestamp}.sql`;

  // 1. Dans activelaser/supabase/backups
  const backupPath1 = path.join(__dirname, '../supabase/backups', filename);
  fs.writeFileSync(backupPath1, sql);
  console.log(`\n✅ Backup créé: ${backupPath1}`);

  // 2. Dans claude/data/supabase
  const backupPath2 = path.join(__dirname, '../../../data/supabase', filename);
  try {
    fs.writeFileSync(backupPath2, sql);
    console.log(`✅ Backup copié: ${backupPath2}`);
  } catch (err) {
    console.log(`⚠️  Impossible de copier dans ${backupPath2}: ${err.message}`);
  }

  console.log(`\n📊 STATISTIQUES:`);
  console.log(`   Total lignes exportées: ${totalRows}`);
  console.log(`   Taille fichier: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`\n✅ BACKUP TERMINÉ`);
}

createFullBackup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ ERREUR:', err);
    process.exit(1);
  });
