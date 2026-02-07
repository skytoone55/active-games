import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updatePermissions() {
  console.log('🔧 Updating branch_admin settings permissions...\n')

  const { data, error } = await supabase
    .from('role_permissions')
    .update({
      can_view: true,
      can_edit: true
    })
    .eq('role', 'branch_admin')
    .eq('resource', 'settings')
    .select()

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log('✅ Updated branch_admin settings permissions:')
  console.log('   view: true, edit: true (create: false, delete: false)\n')
}

updatePermissions()
