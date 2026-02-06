const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../supabase/migrations')
  const migrations = [
    '20260206_add_custom_error_message_to_modules.sql',
    '20260206_remove_step_params.sql'
  ]

  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile)
    const sql = fs.readFileSync(filePath, 'utf8')

    console.log(`\nRunning migration: ${migrationFile}`)
    console.log('SQL:', sql)

    try {
      // Exécuter via l'API REST de Supabase en utilisant la connexion PostgreSQL
      const { data, error } = await supabase.rpc('exec_sql', { query: sql })

      if (error) {
        console.error(`❌ Error in ${migrationFile}:`, error)
        console.log('\n⚠️  Les migrations doivent être exécutées manuellement dans le SQL Editor de Supabase Dashboard')
        console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '')}/project/_/sql`)
      } else {
        console.log(`✅ ${migrationFile} applied successfully`)
      }
    } catch (err) {
      console.error(`❌ Exception in ${migrationFile}:`, err.message)
      console.log('\n⚠️  Les migrations doivent être exécutées manuellement dans le SQL Editor de Supabase Dashboard')
      console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('/rest/v1', '')}/project/_/sql`)
    }
  }
}

runMigrations()
