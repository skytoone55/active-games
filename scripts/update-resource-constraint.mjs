import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }
})

async function updateConstraint() {
  console.log('🔧 Updating resource constraint to include messenger...')

  // Drop old constraint
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_resource_check;'
  })

  if (dropError) {
    console.log('Note: Could not drop constraint (may not exist or need direct SQL)')
  }

  // Add new constraint with messenger
  const { error: addError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_resource_check
          CHECK (resource IN ('agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions', 'calls', 'messenger'));`
  })

  if (addError) {
    console.log('Note: Could not add constraint (need direct SQL access)')
  }

  console.log('✨ Constraint update attempted')
}

updateConstraint()
