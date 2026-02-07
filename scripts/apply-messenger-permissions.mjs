import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyPermissions() {
  console.log('📝 Adding messenger permissions...')

  const permissions = [
    { role: 'super_admin', resource: 'messenger', can_view: true, can_create: true, can_edit: true, can_delete: true },
    { role: 'branch_admin', resource: 'messenger', can_view: true, can_create: true, can_edit: true, can_delete: false },
    { role: 'agent', resource: 'messenger', can_view: true, can_create: false, can_edit: false, can_delete: false }
  ]

  for (const perm of permissions) {
    const { data, error } = await supabase
      .from('role_permissions')
      .upsert(perm, {
        onConflict: 'role,resource',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Error for ${perm.role}:`, error.message)
    } else {
      console.log(`✅ ${perm.role}: view=${perm.can_view} create=${perm.can_create} edit=${perm.can_edit} delete=${perm.can_delete}`)
    }
  }

  console.log('✨ Done!')
}

applyPermissions()
