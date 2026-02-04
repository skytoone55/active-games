/**
 * Migration Script: Add missing calls permission for viewer role
 * Date: 2026-02-04
 *
 * Issue: The viewer role was missing from the initial calls permissions migration.
 * This script adds the permission for viewer to view calls (read-only access).
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  console.error('   Assurez-vous que .env.local contient:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addViewerCallsPermission() {
  console.log('🚀 AJOUT PERMISSION CALLS POUR ROLE VIEWER\n');

  // 1. Vérifier si la permission existe déjà
  console.log('1. Vérification permission existante...');
  const { data: existing, error: checkError } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('role', 'viewer')
    .eq('resource', 'calls')
    .maybeSingle();

  if (checkError) {
    console.error('❌ Erreur lors de la vérification:', checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.log('ℹ️  Permission déjà existante:');
    console.log('   can_view:', existing.can_view);
    console.log('   can_create:', existing.can_create);
    console.log('   can_edit:', existing.can_edit);
    console.log('   can_delete:', existing.can_delete);
    console.log('\n✅ Aucune action nécessaire');
    return;
  }

  console.log('   → Permission non trouvée, création...\n');

  // 2. Récupérer l'ID du rôle viewer
  console.log('2. Récupération ID du rôle viewer...');
  const { data: viewerRole, error: roleError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', 'viewer')
    .single();

  if (roleError || !viewerRole) {
    console.error('❌ Erreur: Rôle viewer non trouvé:', roleError?.message);
    process.exit(1);
  }

  console.log('   ✅ Rôle trouvé:', viewerRole.id);

  // 3. Insérer la permission
  console.log('\n3. Insertion permission...');
  const { data: newPermission, error: insertError } = await supabase
    .from('role_permissions')
    .insert({
      role: 'viewer',
      resource: 'calls',
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
      role_id: viewerRole.id
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Erreur lors de l\'insertion:', insertError.message);
    process.exit(1);
  }

  console.log('   ✅ Permission créée:', newPermission.id);

  // 4. Vérification finale
  console.log('\n4. Vérification finale...');
  const { data: allViewerPermissions, error: verifyError } = await supabase
    .from('role_permissions')
    .select('resource, can_view, can_create, can_edit, can_delete')
    .eq('role', 'viewer')
    .order('resource');

  if (verifyError) {
    console.error('❌ Erreur vérification:', verifyError.message);
  } else {
    console.log('\n📊 TOUTES LES PERMISSIONS VIEWER:');
    console.table(allViewerPermissions);
  }

  console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS');
  console.log('   Le rôle viewer peut maintenant voir les calls dans l\'interface permissions');
}

addViewerCallsPermission()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ ERREUR FATALE:', err);
    process.exit(1);
  });
