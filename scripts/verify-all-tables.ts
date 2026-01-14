import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_publishable_WQMe7MkqlJjviPkQZ5gYoQ_B-TprBmF'
)

const allTables = [
  'branches',
  'branch_settings', 
  'event_rooms',
  'profiles',
  'user_branches',
  'bookings',
  'booking_slots',
  'contacts',
  'booking_contacts'
]

async function verify() {
  console.log('🔍 Vérification complète des tables...\n')
  
  for (const table of allTables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(0)
      if (error) {
        if (error.code === 'PGRST204') {
          console.log(`❌ ${table}: Table inexistante`)
        } else {
          console.log(`⚠️  ${table}: ${error.message}`)
        }
      } else {
        console.log(`✅ ${table}: OK`)
      }
    } catch (e) {
      console.log(`❌ ${table}: Erreur - ${e}`)
    }
  }
}

verify()
