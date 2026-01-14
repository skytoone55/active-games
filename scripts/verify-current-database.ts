import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function verify() {
  console.log('🔍 Vérification de la base de données actuellement utilisée...\n')
  console.log('URL Supabase:', supabaseUrl || '❌ NON DÉFINI')
  console.log('Clé:', supabaseKey ? supabaseKey.substring(0, 30) + '...' : '❌ NON DÉFINIE\n')

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement manquantes dans .env.local')
    console.error('   Chargez-les avec: source .env.local (ou redémarrez le serveur)')
    process.exit(1)
  }

  // Vérifier quelle base on utilise
  const oldBase = 'mypstbvbekfwyaaewpfe.supabase.co'
  const newBase = 'zapwlcrjnabrfhoxfgqo.supabase.co'

  if (supabaseUrl.includes(oldBase)) {
    console.log('⚠️  ATTENTION: Vous êtes connecté à l\'ANCIENNE base (Jonathan)\n')
    console.log('   URL détectée:', oldBase)
  } else if (supabaseUrl.includes(newBase)) {
    console.log('✅ Vous êtes connecté à la NOUVELLE base (votre base dédiée)\n')
    console.log('   URL détectée:', newBase)
  } else {
    console.log('⚠️  Base inconnue:', supabaseUrl)
  }

  // Tester la connexion
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase.from('branches').select('count').limit(1)
    
    if (error) {
      console.log('\n❌ Erreur de connexion:', error.message)
    } else {
      console.log('\n✅ Connexion réussie à la base active\n')
    }
  } catch (e) {
    console.log('\n❌ Erreur:', e)
  }
}

verify()
