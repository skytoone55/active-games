import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log('Test 1: Sans filtre archived')
  const { data: r1, error: e1 } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, archived_at')
    .eq('phone', '0586266770')
    .limit(1)
  console.log('Result:', r1)
  console.log('Error:', e1)

  console.log('\nTest 2: Avec filtre archived_at is null')
  const { data: r2, error: e2 } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, archived_at')
    .eq('phone', '0586266770')
    .is('archived_at', null)
    .limit(1)
  console.log('Result:', r2)
  console.log('Error:', e2)
}

test().catch(console.error)
