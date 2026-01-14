/**
 * Script pour tester la connexion à Supabase
 * Usage: npx tsx scripts/test-supabase-connection.ts
 */

import { createClient } from '@supabase/supabase-js'

async function testConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erreur: Variables d\'environnement manquantes')
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || '❌ MANQUANT')
    console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Présent' : '❌ MANQUANT')
    process.exit(1)
  }

  console.log('🔗 Test de connexion à Supabase...\n')
  console.log('URL:', supabaseUrl)
  console.log('Clé:', supabaseKey.substring(0, 20) + '...\n')

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test 1: Vérifier que la connexion fonctionne
    console.log('1️⃣  Test de connexion basique...')
    const { data: healthCheck, error: healthError } = await supabase
      .from('branches')
      .select('count')
      .limit(0)

    if (healthError) {
      if (healthError.code === 'PGRST204' || healthError.message.includes('does not exist')) {
        console.log('   ⚠️  Table branches n\'existe pas encore - c\'est normal si migration pas faite\n')
      } else {
        console.error('   ❌ Erreur:', healthError.message)
        console.error('   Code:', healthError.code)
        process.exit(1)
      }
    } else {
      console.log('   ✅ Connexion réussie\n')
    }

    // Test 2: Lister les tables disponibles
    console.log('2️⃣  Vérification des tables...')
    const tables = ['branches', 'bookings', 'contacts', 'booking_contacts', 'event_rooms']
    const tableStatus: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(0)
        tableStatus[table] = !error
        if (error && error.code !== 'PGRST204') {
          console.log(`   ⚠️  ${table}: ${error.message}`)
        }
      } catch (e) {
        tableStatus[table] = false
      }
    }

    console.log('\n   📊 État des tables:')
    for (const [table, exists] of Object.entries(tableStatus)) {
      console.log(`   ${exists ? '✅' : '❌'} ${table}`)
    }

    const allExist = Object.values(tableStatus).every(v => v)
    
    if (!allExist) {
      console.log('\n   ⚠️  Certaines tables n\'existent pas encore.')
      console.log('   ➡️  Exécutez la migration SQL dans Supabase Dashboard:\n')
      console.log('   1. Allez sur https://supabase.com/dashboard')
      console.log('   2. Sélectionnez votre projet')
      console.log('   3. SQL Editor → New query')
      console.log('   4. Copiez-collez le contenu de:')
      console.log('      supabase/migrations/000_initial_schema.sql')
      console.log('   5. Cliquez "Run"\n')
    } else {
      console.log('\n   ✅ Toutes les tables existent !')
    }

    // Test 3: Vérifier auth
    console.log('\n3️⃣  Test de l\'authentification...')
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.log('   ⚠️  Pas de session active (normal si pas connecté)')
    } else {
      console.log('   ✅ Service auth accessible')
    }

    console.log('\n✅ Tests terminés !\n')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
    process.exit(1)
  }
}

testConnection().catch(error => {
  console.error('❌ Erreur fatale:', error)
  process.exit(1)
})
