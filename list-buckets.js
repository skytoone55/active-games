const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O'
);

async function listBuckets() {
  console.log('Liste des buckets Supabase:\n');

  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }

  data.forEach(bucket => {
    const visibility = bucket.public ? 'public' : 'private';
    console.log(`- ${bucket.name} (${visibility})`);
  });
}

listBuckets().then(() => process.exit(0));
