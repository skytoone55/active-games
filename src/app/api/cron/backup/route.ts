import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Protection: seul Vercel Cron peut appeler cette route
export async function GET(request: Request) {
  try {
    // Vérifier que c'est bien Vercel Cron qui appelle
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Début du backup automatique...');

    // Créer le client Supabase avec les droits admin
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Liste des tables à sauvegarder
    const tables = [
      'activity_logs',
      'ai_conversations',
      'ai_messages',
      'booking_contacts',
      'booking_slots',
      'bookings',
      'branch_settings',
      'branches',
      'contacts',
      'email_logs',
      'email_settings',
      'email_templates',
      'event_rooms',
      'game_sessions',
      'icount_event_formulas',
      'icount_products',
      'icount_rooms',
      'laser_rooms',
      'orders',
      'payment_credentials',
      'payments',
      'profiles',
      'role_permissions',
      'roles',
      'user_branches'
    ];

    const backupData: any = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      tables: {},
      metadata: {
        project: 'activelaser',
        database: 'zapwlcrjnabrfhoxfgqo'
      }
    };

    let totalRecords = 0;

    // Exporter toutes les tables
    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact' });

        if (error) {
          console.error(`❌ Erreur table ${table}:`, error.message);
          backupData.tables[table] = { error: error.message, records: 0 };
          continue;
        }

        backupData.tables[table] = {
          data: data || [],
          records: count || 0
        };

        totalRecords += count || 0;
        console.log(`✅ ${table}: ${count || 0} enregistrements`);
      } catch (err: any) {
        console.error(`❌ Exception table ${table}:`, err.message);
        backupData.tables[table] = { error: err.message, records: 0 };
      }
    }

    // Convertir en JSON
    const backupJSON = JSON.stringify(backupData, null, 2);
    const backupBuffer = Buffer.from(backupJSON);

    console.log(`📊 Total: ${totalRecords} enregistrements`);
    console.log(`📦 Taille: ${(backupBuffer.length / 1024).toFixed(2)} KB`);

    // Uploader dans Supabase Storage
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('backups')
      .upload(filename, backupBuffer, {
        contentType: 'application/json',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erreur upload:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'Upload failed',
        details: uploadError.message
      }, { status: 500 });
    }

    console.log(`✅ Backup uploadé: ${filename}`);

    // Nettoyer les vieux backups (garder les 30 derniers)
    const { data: files } = await supabase
      .storage
      .from('backups')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (files && files.length > 30) {
      const filesToDelete = files.slice(30).map(f => f.name);

      const { error: deleteError } = await supabase
        .storage
        .from('backups')
        .remove(filesToDelete);

      if (!deleteError) {
        console.log(`🗑️  ${filesToDelete.length} vieux backups supprimés`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Backup créé avec succès',
      filename,
      stats: {
        tables: Object.keys(backupData.tables).length,
        totalRecords,
        sizeKB: Math.round(backupBuffer.length / 1024),
        timestamp: backupData.timestamp
      }
    });

  } catch (error: any) {
    console.error('❌ Erreur backup:', error);
    return NextResponse.json({
      success: false,
      error: 'Backup failed',
      details: error.message
    }, { status: 500 });
  }
}

// Désactiver le cache pour les cron jobs
export const dynamic = 'force-dynamic';
export const revalidate = 0;
