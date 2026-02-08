import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseServiceKey = 'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  console.log('🔍 Checking messenger tables schema...\n')

  // Check messenger_workflows columns
  const { data: workflowsData, error: workflowsError } = await supabase
    .from('messenger_workflows')
    .select('*')
    .limit(1)

  if (workflowsError) {
    console.error('❌ messenger_workflows error:', workflowsError.message)
  } else {
    console.log('✅ messenger_workflows exists')
    if (workflowsData && workflowsData[0]) {
      console.log('   Columns:', Object.keys(workflowsData[0]).join(', '))
    }
  }

  console.log('')

  // Check messenger_workflow_steps columns
  const { data: stepsData, error: stepsError } = await supabase
    .from('messenger_workflow_steps')
    .select('*')
    .limit(1)

  if (stepsError) {
    console.error('❌ messenger_workflow_steps error:', stepsError.message)
  } else {
    console.log('✅ messenger_workflow_steps exists')
    if (stepsData && stepsData[0]) {
      console.log('   Columns:', Object.keys(stepsData[0]).join(', '))
    }
  }

  console.log('')

  // Check if Clara columns already exist
  console.log('🔎 Checking for Clara-related columns...\n')

  if (stepsData && stepsData[0]) {
    const cols = Object.keys(stepsData[0])
    const claraColumns = cols.filter(c => c.includes('clara'))

    if (claraColumns.length > 0) {
      console.log('⚠️  Clara columns already exist:', claraColumns.join(', '))
    } else {
      console.log('✅ No Clara columns found - safe to add them')
    }
  }

  if (workflowsData && workflowsData[0]) {
    const cols = Object.keys(workflowsData[0])
    const claraColumns = cols.filter(c => c.includes('clara'))

    if (claraColumns.length > 0) {
      console.log('⚠️  Clara columns in workflows already exist:', claraColumns.join(', '))
    } else {
      console.log('✅ No Clara columns in workflows - safe to add them')
    }
  }
}

checkSchema()
