import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkCallsTable() {
  console.log('🔍 Vérification de la table calls...\n')

  // Check if table exists and count rows
  const { data, error, count } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.log('❌ La table calls n existe pas encore')
    console.log('   Erreur:', error.message)
    console.log('\n⚠️  Tu dois exécuter la migration SQL:')
    console.log('   supabase/migrations/20260202_add_calls_table.sql\n')
    return false
  }

  console.log(`✅ Table calls existe: ${count} appels trouvés\n`)

  // Check permissions
  const { data: perms, error: permError } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('resource', 'calls')

  if (permError) {
    console.log('❌ Erreur permissions:', permError.message)
    return false
  }

  console.log(`✅ Permissions configurées: ${perms?.length || 0} rôles\n`)
  perms?.forEach(p => {
    console.log(`   ${p.role}:`)
    console.log(`      view=${p.can_view}, create=${p.can_create}, edit=${p.can_edit}, delete=${p.can_delete}`)
  })

  // Sample data
  if (count && count > 0) {
    console.log('\n📞 Exemples d appels:')
    const { data: samples } = await supabase
      .from('calls')
      .select('id, direction, status, from_number, to_number, started_at')
      .limit(3)

    samples?.forEach(call => {
      console.log(`   - ${call.direction} | ${call.status} | ${call.from_number} → ${call.to_number}`)
    })
  }

  return true
}

checkCallsTable()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
