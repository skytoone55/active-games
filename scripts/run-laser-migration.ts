/**
 * Script pour exécuter la migration Laser via l'API Supabase
 * Usage: npx tsx scripts/run-laser-migration.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Configuration depuis les variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  process.exit(1)
}

// Créer le client Supabase avec la service role key (pour exécuter du SQL)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 Démarrage de la migration Laser...\n')

  try {
    // Lire le fichier SQL
    const migrationPath = join(process.cwd(), 'supabase/migrations/008_consolidated_laser_migration.sql')
    console.log(`📄 Lecture du fichier: ${migrationPath}`)
    
    const sql = readFileSync(migrationPath, 'utf-8')
    console.log(`✅ Fichier lu (${sql.length} caractères)\n`)

    // Exécuter le SQL via RPC (si disponible) ou via une fonction SQL
    // Note: Supabase ne permet pas d'exécuter du SQL arbitraire directement via l'API
    // Il faut utiliser une fonction RPC ou exécuter via le dashboard
    
    console.log('⚠️  Supabase ne permet pas d\'exécuter du SQL arbitraire via l\'API client.')
    console.log('📋 Veuillez exécuter le SQL manuellement via:')
    console.log('   1. Le dashboard Supabase (SQL Editor)')
    console.log('   2. Ou via psql si vous avez accès direct à la base')
    console.log('\n📄 Contenu du fichier SQL à exécuter:')
    console.log('─'.repeat(80))
    console.log(sql)
    console.log('─'.repeat(80))
    console.log('\n💡 Alternative: Créer une fonction RPC dans Supabase qui exécute ce SQL')
    
    // Option: Créer une fonction RPC dans Supabase qui exécute le SQL
    // Mais pour l'instant, on affiche juste les instructions
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution:', error)
    process.exit(1)
  }
}

// Exécuter
runMigration()
