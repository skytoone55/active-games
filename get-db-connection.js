const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function getDatabasePassword() {
  console.log('Récupération des infos de connexion DB...\n');

  // Try to get database config via SQL
  const { data, error } = await supabase.rpc('get_database_info');

  if (error) {
    console.log('Tentative 2: Via settings...');

    // Alternative: get from project settings
    const response = await fetch('https://api.supabase.com/v1/projects/zapwlcrjnabrfhoxfgqo', {
      headers: {
        'Authorization': 'Bearer sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
      }
    });

    if (!response.ok) {
      console.error('Erreur API:', response.status);
      console.log('\n⚠️  Je ne peux pas récupérer le password DB automatiquement');
      console.log('\nVa sur: https://supabase.com/dashboard/project/zapwlcrjnabrfhoxfgqo/settings/database');
      console.log('→ Connection string → Database password');
      process.exit(1);
    }

    const project = await response.json();
    console.log('Project info:', project);
  } else {
    console.log('Database info:', data);
  }
}

getDatabasePassword().then(() => process.exit(0));
