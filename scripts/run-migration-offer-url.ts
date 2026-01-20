/**
 * Script: Apply migration to add icount_offer_url column
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function runMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('🔄 Adding icount_offer_url column to bookings...')

  // Try to add the column using rpc
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS icount_offer_url TEXT;

      COMMENT ON COLUMN bookings.icount_offer_url IS 'URL to view the iCount offer document online';
    `
  })

  if (error) {
    // If exec_sql doesn't exist, we need another approach
    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.log('ℹ️  exec_sql function not available')
      console.log('❌ Please apply the migration manually via Supabase dashboard SQL editor:')
      console.log('')
      console.log('ALTER TABLE bookings')
      console.log("ADD COLUMN IF NOT EXISTS icount_offer_url TEXT;")
      console.log('')
      console.log("COMMENT ON COLUMN bookings.icount_offer_url IS 'URL to view the iCount offer document online';")
    } else {
      console.log('Error:', error.message)
    }
    return
  }

  console.log('✅ Migration applied successfully!')

  // Verify the column exists
  const { data, error: verifyError } = await supabase
    .from('bookings')
    .select('icount_offer_url')
    .limit(1)

  if (verifyError) {
    console.log('⚠️  Verification failed:', verifyError.message)
  } else {
    console.log('✅ Column verified!')
  }
}

runMigration().catch(console.error)
