/**
 * Manus Brain — Vector DB Setup
 * Tworzy tabele dla bazy wektorowej w Supabase przez SQL
 * Używa TF-IDF embeddings (bez zewnętrznych kluczy API)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_KEY are required');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkTable(name) {
  const { data, error } = await supabase.from(name).select('id').limit(1);
  return { exists: !error, error: error?.message };
}

async function main() {
  console.log('=== Manus Brain Vector DB Setup ===\n');

  // Sprawdź istniejące tabele
  const tables = ['manus_embeddings', 'manus_vector_clusters', 'manus_semantic_links'];
  for (const t of tables) {
    const { exists, error } = await checkTable(t);
    console.log(`${t}: ${exists ? 'EXISTS' : 'MISSING'} ${error ? '(' + error + ')' : ''}`);
  }

  // Sprawdź dane w experiences
  const { data: exps, error: expErr } = await supabase
    .from('manus_experiences')
    .select('id, title, summary, tags, domain, category')
    .eq('status', 'active');

  if (expErr) {
    console.error('Cannot read experiences:', expErr.message);
    return;
  }

  console.log(`\nFound ${exps.length} active experiences to index`);
  if (exps[0]) console.log('Sample:', exps[0].title);
}

main().catch(console.error);
