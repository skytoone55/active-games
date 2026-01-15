/**
 * Script pour exécuter la migration Laser via l'API Supabase
 * Usage: npx tsx scripts/execute-laser-migration.ts
 * 
 * Note: Ce script utilise l'API Supabase pour exécuter le SQL.
 * Il faut avoir la SUPABASE_SERVICE_ROLE_KEY dans les variables d'environnement.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Configuration depuis les variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (nécessaire pour exécuter du SQL)')
  console.error('\n💡 Pour obtenir la service role key:')
  console.error('   1. Va sur https://supabase.com/dashboard')
  console.error('   2. Sélectionne ton projet')
  console.error('   3. Va dans Settings > API')
  console.error('   4. Copie la "service_role" key (secret)')
  process.exit(1)
}

// Créer le client Supabase avec la service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSQL(sql: string): Promise<void> {
  // Supabase ne permet pas d'exécuter du SQL arbitraire directement via l'API
  // On doit utiliser une fonction RPC ou exécuter via le dashboard
  
  // Option 1: Créer une fonction RPC temporaire qui exécute le SQL
  // Option 2: Utiliser le dashboard Supabase
  
  // Pour l'instant, on va créer une fonction RPC qui exécute le SQL
  const createRPCFunction = `
    CREATE OR REPLACE FUNCTION execute_laser_migration()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      ${sql.replace(/\$\$/g, '$$$')} -- Échapper les $$ dans le SQL
    END;
    $$;
  `
  
  try {
    // Essayer d'exécuter via RPC
    const { error: rpcError } = await supabase.rpc('execute_sql', { sql_query: sql })
    
    if (rpcError) {
      // Si la fonction RPC n'existe pas, on doit la créer d'abord
      console.log('⚠️  La fonction RPC n\'existe pas. Création...')
      
      // Créer la fonction RPC qui permet d'exécuter du SQL
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_query;
        END;
        $$;
      `
      
      // Exécuter la création de la fonction via une requête directe
      // Note: Cela nécessite d'utiliser le client PostgreSQL directement
      console.log('📋 Pour exécuter cette migration, utilisez l\'une des méthodes suivantes:')
      console.log('\n1️⃣  Via le Dashboard Supabase:')
      console.log('   - Allez sur https://supabase.com/dashboard')
      console.log('   - Sélectionnez votre projet')
      console.log('   - Allez dans SQL Editor')
      console.log('   - Collez le contenu du fichier: supabase/migrations/008_consolidated_laser_migration.sql')
      console.log('   - Cliquez sur "Run"')
      
      console.log('\n2️⃣  Via psql (si vous avez accès):')
      console.log('   psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/008_consolidated_laser_migration.sql')
      
      console.log('\n3️⃣  Via une fonction RPC (à créer manuellement):')
      console.log('   Créez d\'abord cette fonction dans Supabase SQL Editor:')
      console.log('   ─'.repeat(60))
      console.log(createFunctionSQL)
      console.log('   ─'.repeat(60))
      console.log('   Puis réexécutez ce script.')
      
      return
    }
    
    console.log('✅ Migration exécutée avec succès!')
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution:', error)
    throw error
  }
}

async function runMigration() {
  console.log('🚀 Démarrage de la migration Laser...\n')

  try {
    // Lire le fichier SQL
    const migrationPath = join(process.cwd(), 'supabase/migrations/008_consolidated_laser_migration.sql')
    console.log(`📄 Lecture du fichier: ${migrationPath}`)
    
    const sql = readFileSync(migrationPath, 'utf-8')
    console.log(`✅ Fichier lu (${sql.length} caractères)\n`)

    // Afficher le SQL pour que l'utilisateur puisse l'exécuter manuellement
    console.log('📋 SQL à exécuter:')
    console.log('─'.repeat(80))
    console.log(sql)
    console.log('─'.repeat(80))
    console.log('\n💡 Instructions:')
    console.log('   1. Copiez le SQL ci-dessus')
    console.log('   2. Allez sur https://supabase.com/dashboard > SQL Editor')
    console.log('   3. Collez le SQL et cliquez sur "Run"')
    console.log('\n   OU utilisez le script suivant pour exécuter automatiquement:')
    console.log('   npx tsx scripts/execute-laser-migration-auto.ts')
    
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du fichier:', error)
    process.exit(1)
  }
}

// Exécuter
runMigration()
