/**
 * Supabase Admin Client - Service Role
 * UTILISÉ UNIQUEMENT CÔTÉ SERVEUR POUR LES OPÉRATIONS ADMIN
 * 
 * Ce client utilise la clé service_role qui contourne RLS (Row Level Security)
 * et permet des opérations privilégiées comme :
 * - Création de comptes utilisateurs (auth.admin.createUser)
 * - Suppression de comptes utilisateurs (auth.admin.deleteUser)
 * - Accès à toutes les données sans restrictions RLS
 * 
 * ⚠️ SÉCURITÉ : Ne JAMAIS exposer ce client côté client !
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Crée un client Supabase avec les privilèges service_role
 * À utiliser UNIQUEMENT dans les API routes côté serveur
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
