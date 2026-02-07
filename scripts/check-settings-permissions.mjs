import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPermissions() {
  console.log('📋 Current settings permissions:\n')

  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('resource', 'settings')
    .order('role')

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No settings permissions found')
    return
  }

  data.forEach(perm => {
    console.log(`${perm.role}:`)
    console.log(`  view: ${perm.can_view}, create: ${perm.can_create}, edit: ${perm.can_edit}, delete: ${perm.can_delete}`)
  })
}

checkPermissions()
