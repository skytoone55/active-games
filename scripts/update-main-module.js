/**
 * Script pour mettre à jour le module MAIN avec un contenu de bienvenue
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY not found')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateMainModule() {
  console.log('🔄 Mise à jour du module MAIN...')

  const { data, error } = await supabase
    .from('messenger_modules')
    .update({
      content: {
        fr: 'Bienvenue chez Active Laser ! 🎯 Veuillez choisir votre succursale :',
        en: 'Welcome to Active Laser! 🎯 Please choose your branch:',
        he: 'ברוכים הבאים ל-Active Laser! 🎯 אנא בחר את הסניף שלך:'
      },
      updated_at: new Date().toISOString()
    })
    .eq('ref_code', 'MAIN')
    .select()

  if (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }

  console.log('✅ Module MAIN mis à jour avec succès!')
  console.log(data)
}

updateMainModule()
