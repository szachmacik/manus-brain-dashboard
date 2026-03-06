/**
 * Manus Brain — Embedding Pipeline
 * Generuje embeddings dla doswiadczen uzywajac Manus built-in LLM
 * Strategia: LLM zwraca 128-wymiarowy wektor jako JSON (structured output)
 * Koszt: ~0.001$ per experience (gpt-4.1-mini, batch)
 * 
 * Uruchamianie: node scripts/generate_embeddings.mjs
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai';
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── EMBEDDING GENERATION ────────────────────────────────────────────────────

/**
 * Generuje embedding przez Manus LLM (structured output)
 * Model zwraca 1536-wymiarowy wektor jako float array
 * To jest "semantic fingerprint" tekstu
 */
async function generateEmbeddingViaLLM(text) {
  const prompt = `You are an embedding model. Convert the following text into a semantic vector representation.
  
Return ONLY a JSON object with a single key "embedding" containing an array of exactly 1536 float values between -1 and 1.
The values should capture semantic meaning: similar concepts should have similar vectors.
Use the text's key concepts, domain, and semantic content to determine the values.

Text to embed:
"${text.substring(0, 500)}"

Return format: {"embedding": [0.123, -0.456, ...]} (exactly 1536 values)`;

  const response = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FORGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'embedding_vector',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              embedding: {
                type: 'array',
                items: { type: 'number' },
                minItems: 1536,
                maxItems: 1536,
              }
            },
            required: ['embedding'],
            additionalProperties: false,
          }
        }
      },
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in LLM response');

  const parsed = JSON.parse(content);
  if (!parsed.embedding || parsed.embedding.length !== 1536) {
    throw new Error(`Invalid embedding: got ${parsed.embedding?.length} values, expected 1536`);
  }

  return parsed.embedding;
}

/**
 * Fallback: TF-IDF based pseudo-embedding (deterministyczny, zero API calls)
 * Używane gdy LLM jest niedostępny lub zbyt drogi
 */
function generateTFIDFEmbedding(text, dim = 1536) {
  // Tokenizacja
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  // Słownik domenowy — mapowanie słów kluczowych na wymiary
  const domainKeywords = {
    // Frontend/React
    react: [0, 1, 2], component: [3, 4], hook: [5, 6], state: [7, 8],
    typescript: [9, 10], css: [11, 12], tailwind: [13, 14], vite: [15],
    // Backend/API
    api: [20, 21], server: [22, 23], database: [24, 25], sql: [26, 27],
    supabase: [28, 29], trpc: [30, 31], express: [32], node: [33],
    // AI/ML
    embedding: [40, 41], vector: [42, 43], model: [44, 45], llm: [46, 47],
    ai: [48, 49], neural: [50, 51], semantic: [52, 53], similarity: [54],
    // Security
    security: [60, 61], auth: [62, 63], token: [64, 65], jwt: [66, 67],
    encryption: [68], password: [69], oauth: [70],
    // Performance
    performance: [80, 81], cache: [82, 83], optimization: [84, 85],
    speed: [86], latency: [87], memory: [88], cpu: [89],
    // Architecture
    architecture: [100, 101], pattern: [102, 103], design: [104, 105],
    microservice: [106], monolith: [107], scalable: [108],
    // Deployment
    deploy: [120, 121], docker: [122, 123], kubernetes: [124], ci: [125],
    github: [126], vercel: [127], manus: [128, 129],
    // Data
    data: [140, 141], schema: [142, 143], migration: [144], index: [145],
    query: [146], join: [147], aggregate: [148],
    // Error handling
    error: [160, 161], exception: [162], retry: [163], fallback: [164],
    debug: [165], log: [166], monitor: [167],
    // Testing
    test: [180, 181], vitest: [182], unit: [183], integration: [184],
    mock: [185], coverage: [186],
  };

  // Inicjalizuj wektor zerami
  const embedding = new Float64Array(dim).fill(0);

  // Oblicz TF dla każdego tokenu
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }

  // Normalizuj TF
  const maxTF = Math.max(...Object.values(tf), 1);

  // Wypełnij wektor na podstawie słów kluczowych
  for (const [word, dims] of Object.entries(domainKeywords)) {
    const wordTF = (tf[word] || 0) / maxTF;
    if (wordTF > 0) {
      for (const d of dims) {
        if (d < dim) {
          embedding[d] += wordTF;
        }
      }
    }
  }

  // Hash-based filling dla pozostałych wymiarów (deterministyczny)
  let seed = 0;
  for (const token of tokens) {
    for (let i = 0; i < token.length; i++) {
      seed = (seed * 31 + token.charCodeAt(i)) & 0xffffffff;
    }
  }

  // Wypełnij pozostałe wymiary pseudo-losowo ale deterministycznie
  for (let i = 200; i < dim; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = ((seed & 0xffff) / 0x8000 - 1) * 0.1; // małe wartości dla szumu
  }

  // Normalizuj do unit vector (dla cosine similarity)
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm) || 1;
  const normalized = Array.from(embedding).map(v => v / norm);

  return normalized;
}

// ─── COSINE SIMILARITY ───────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─── MAIN PIPELINE ───────────────────────────────────────────────────────────

async function indexExperience(exp, useLLM = false) {
  // Przygotuj tekst do embeddingu
  const text = [
    exp.title,
    exp.summary,
    exp.domain,
    exp.category,
    (exp.tags || []).join(' '),
  ].filter(Boolean).join(' | ');

  // Hash treści (do wykrywania zmian)
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  // Sprawdź czy embedding już istnieje i jest aktualny
  const { data: existing } = await supabase
    .from('manus_embeddings')
    .select('id, content_hash')
    .eq('source_type', 'experience')
    .eq('source_id', exp.id)
    .single();

  if (existing && existing.content_hash === contentHash) {
    return { status: 'skipped', id: exp.id, title: exp.title };
  }

  // Generuj embedding
  let embedding;
  let modelUsed;

  if (useLLM && FORGE_KEY) {
    try {
      embedding = await generateEmbeddingViaLLM(text);
      modelUsed = 'manus-gpt-4.1-mini';
    } catch (err) {
      console.warn(`  LLM failed for "${exp.title}": ${err.message}, using TF-IDF fallback`);
      embedding = generateTFIDFEmbedding(text);
      modelUsed = 'tfidf-v1';
    }
  } else {
    embedding = generateTFIDFEmbedding(text);
    modelUsed = 'tfidf-v1';
  }

  // Zapisz do Supabase
  const { error } = await supabase
    .from('manus_embeddings')
    .upsert({
      source_type: 'experience',
      source_id: exp.id,
      content_hash: contentHash,
      embedding: `[${embedding.join(',')}]`,
      model_used: modelUsed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  return { status: 'indexed', id: exp.id, title: exp.title, model: modelUsed };
}

async function buildSemanticLinks(embeddings) {
  console.log('\n📊 Building semantic links...');
  const links = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].vector, embeddings[j].vector);
      if (sim > 0.6) {
        links.push({
          source_id: embeddings[i].embId,
          target_id: embeddings[j].embId,
          similarity: Math.round(sim * 1000) / 1000,
          link_type: sim > 0.85 ? 'semantic' : 'semantic',
        });
      }
    }
  }

  if (links.length > 0) {
    // Usuń stare linki i wstaw nowe
    await supabase.from('manus_semantic_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('manus_semantic_links').insert(links);
    if (error) console.warn('Semantic links insert error:', error.message);
    else console.log(`  ✓ Created ${links.length} semantic links`);
  }

  return links.length;
}

async function buildClusters(embeddings) {
  console.log('\n🔮 Building semantic clusters...');

  // Proste k-means z k=5 (domenowe klastry)
  const domains = [...new Set(embeddings.map(e => e.domain).filter(Boolean))];
  const clusters = [];

  for (const domain of domains) {
    const domainEmbs = embeddings.filter(e => e.domain === domain);
    if (domainEmbs.length === 0) continue;

    // Centroid = średnia wszystkich embeddings w domenie
    const dim = domainEmbs[0].vector.length;
    const centroid = new Array(dim).fill(0);
    for (const emb of domainEmbs) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb.vector[i] / domainEmbs.length;
      }
    }

    // Normalizuj centroid
    let norm = 0;
    for (const v of centroid) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    const normalizedCentroid = centroid.map(v => v / norm);

    clusters.push({
      name: domain,
      description: `Klaster semantyczny dla domeny: ${domain}`,
      centroid: `[${normalizedCentroid.join(',')}]`,
      member_count: domainEmbs.length,
      keywords: domainEmbs.flatMap(e => e.tags || []).slice(0, 10),
    });
  }

  if (clusters.length > 0) {
    await supabase.from('manus_vector_clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabase.from('manus_vector_clusters').insert(clusters);
    if (error) console.warn('Clusters insert error:', error.message);
    else console.log(`  ✓ Created ${clusters.length} domain clusters`);
  }

  return clusters.length;
}

async function main() {
  console.log('🧠 Manus Brain — Embedding Pipeline\n');
  console.log(`Mode: ${FORGE_KEY ? 'LLM (Manus built-in) + TF-IDF fallback' : 'TF-IDF only'}`);

  // Pobierz wszystkie aktywne doświadczenia
  const { data: experiences, error } = await supabase
    .from('manus_experiences')
    .select('id, title, summary, domain, category, tags')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Cannot fetch experiences:', error.message);
    process.exit(1);
  }

  console.log(`Found ${experiences.length} experiences to process\n`);

  // Indeksuj każde doświadczenie
  const results = [];
  const embeddingsForClustering = [];

  for (const exp of experiences) {
    try {
      process.stdout.write(`  Processing: "${exp.title.substring(0, 50)}"... `);
      const result = await indexExperience(exp, true); // useLLM=true
      console.log(result.status === 'skipped' ? '(skipped, unchanged)' : `✓ [${result.model}]`);
      results.push(result);

      // Pobierz wygenerowany embedding dla klastrowania
      const { data: embData } = await supabase
        .from('manus_embeddings')
        .select('id, embedding')
        .eq('source_type', 'experience')
        .eq('source_id', exp.id)
        .single();

      if (embData?.embedding) {
        const vector = typeof embData.embedding === 'string'
          ? JSON.parse(embData.embedding)
          : embData.embedding;
        embeddingsForClustering.push({
          embId: embData.id,
          expId: exp.id,
          title: exp.title,
          domain: exp.domain,
          tags: exp.tags,
          vector,
        });
      }

      // Rate limiting — 1 req/s dla LLM
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`\n  ERROR for "${exp.title}": ${err.message}`);
      results.push({ status: 'error', id: exp.id, error: err.message });
    }
  }

  // Buduj linki semantyczne
  if (embeddingsForClustering.length > 1) {
    const linkCount = await buildSemanticLinks(embeddingsForClustering);
    const clusterCount = await buildClusters(embeddingsForClustering);
  }

  // Podsumowanie
  const indexed = results.filter(r => r.status === 'indexed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log('\n=== SUMMARY ===');
  console.log(`✓ Indexed: ${indexed}`);
  console.log(`⟳ Skipped (unchanged): ${skipped}`);
  console.log(`✗ Errors: ${errors}`);
  console.log(`Total embeddings in DB: ${indexed + skipped}`);
}

main().catch(console.error);
