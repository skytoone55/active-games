/**
 * Script pour créer un utilisateur admin initial
 * Usage: npx tsx scripts/create-admin-user.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function createAdminUser() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables d\'environnement manquantes')
    console.error('   Chargez .env.local ou définissez:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY\n')
    process.exit(1)
  }

  console.log('🔐 Création d\'un utilisateur admin initial...\n')

  // Utiliser service_role key pour créer un utilisateur
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Demander les infos
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string) =>
    new Promise<string>((resolve) => readline.question(query, resolve))

  try {
    const email = await question('Email: ')
    const password = await question('Mot de passe (min 6 caractères): ')

    if (!email || !password) {
      console.error('❌ Email et mot de passe requis')
      process.exit(1)
    }

    if (password.length < 6) {
      console.error('❌ Le mot de passe doit contenir au moins 6 caractères')
      process.exit(1)
    }

    console.log('\n⏳ Création de l\'utilisateur...')

    // Créer l'utilisateur
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmer l'email automatiquement
      user_metadata: {
        full_name: email.split('@')[0],
      },
    })

    if (authError) {
      console.error('❌ Erreur lors de la création:', authError.message)
      process.exit(1)
    }

    if (!authData.user) {
      console.error('❌ Aucun utilisateur créé')
      process.exit(1)
    }

    console.log('✅ Utilisateur créé:', authData.user.email)
    console.log('   ID:', authData.user.id)

    // Créer le profil (sera créé automatiquement au login, mais créons-le maintenant)
    console.log('\n⏳ Création du profil...')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      role: 'super_admin',
      full_name: email.split('@')[0],
    } as any)

    if (profileError) {
      if (profileError.code === '23505') {
        console.log('   ⚠️  Profil déjà existant (normal si créé automatiquement)')
      } else {
        console.error('   ⚠️  Erreur lors de la création du profil:', profileError.message)
        console.log('   ➡️  Le profil sera créé automatiquement lors de la première connexion')
      }
    } else {
      console.log('   ✅ Profil créé avec rôle: super_admin')
    }

    console.log('\n✅ Utilisateur admin créé avec succès !\n')
    console.log('Vous pouvez maintenant vous connecter avec:')
    console.log('   Email:', email)
    console.log('   Mot de passe:', '*'.repeat(password.length), '\n')

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  } finally {
    readline.close()
  }
}

createAdminUser()
