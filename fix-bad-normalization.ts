/**
 * Corriger la mauvaise normalisation des numéros (086266770 -> 0586266770)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

function normalizePhone(phone: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  // Chercher le pattern "5" suivi de 8 chiffres
  const match = cleaned.match(/(5\d{8})/)
  if (match) return '0' + match[1]
  return null
}

async function fixNormalization() {
  console.log('=== CORRECTION NORMALISATION ===\n')

  // Récupérer tous les appels
  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log(`Appels à vérifier: ${calls?.length}\n`)

  let fixed = 0
  let alreadyGood = 0
  let cantFix = 0

  for (const call of calls || []) {
    // Re-normaliser from_number
    const newFromNormalized = normalizePhone(call.from_number)
    const newToNormalized = normalizePhone(call.to_number)

    if (newFromNormalized !== call.from_number_normalized ||
        newToNormalized !== call.to_number_normalized) {

      console.log(`Appel ${call.id}:`)
      console.log(`  From: ${call.from_number_normalized} -> ${newFromNormalized}`)
      console.log(`  To: ${call.to_number_normalized} -> ${newToNormalized}`)

      // Mettre à jour
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          from_number_normalized: newFromNormalized,
          to_number_normalized: newToNormalized
        })
        .eq('id', call.id)

      if (updateError) {
        console.error(`  ❌ Erreur:`, updateError)
        cantFix++
      } else {
        console.log(`  ✅ Corrigé`)
        fixed++
      }
    } else {
      alreadyGood++
    }
  }

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`Corrigés: ${fixed}`)
  console.log(`Déjà OK: ${alreadyGood}`)
  console.log(`Erreurs: ${cantFix}`)
}

fixNormalization().catch(console.error)
