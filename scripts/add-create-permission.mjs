import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updatePermissions() {
  console.log('🔧 Adding can_create permission for branch_admin on settings...\n')

  const { data, error } = await supabase
    .from('role_permissions')
    .update({ can_create: true })
    .eq('role', 'branch_admin')
    .eq('resource', 'settings')
    .select()

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log('✅ Updated branch_admin settings permissions:')
  console.log('   view: true, create: true, edit: true, delete: false\n')
}

updatePermissions()
