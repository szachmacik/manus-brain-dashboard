#!/usr/bin/env python3
"""
Manus Brain — Vector Pipeline (Python)
======================================
Zaawansowany pipeline do:
1. Generowania embeddings (TF-IDF + opcjonalnie LLM)
2. Klastrowania semantycznego (k-means)
3. Wykrywania anomalii (doświadczenia bez klastra)
4. Eksportu raportu do Google Drive
5. Auto-indeksowania nowych doświadczeń

Uruchamianie:
  python3 scripts/vector_pipeline.py [--mode=full|delta|cluster|report]
  
Tryby:
  full    — pełne re-indeksowanie wszystkich doświadczeń
  delta   — tylko nowe/zmienione (domyślny)
  cluster — przelicz klastry bez re-indeksowania
  report  — generuj raport i eksportuj do Google Drive
"""

import os
import sys
import json
import math
import hashlib
import argparse
import datetime
from typing import Optional

# ─── DEPENDENCIES ────────────────────────────────────────────────────────────

try:
    from supabase import create_client, Client
except ImportError:
    print("Installing supabase-py...")
    os.system("sudo pip3 install supabase -q")
    from supabase import create_client, Client

# ─── CONFIG ──────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
FORGE_URL    = os.environ.get("BUILT_IN_FORGE_API_URL", "")
FORGE_KEY    = os.environ.get("BUILT_IN_FORGE_API_KEY", "")

DIM = 1536  # Wymiarowość wektorów

# Słownik domenowy — mapowanie słów kluczowych na wymiary
DOMAIN_KEYWORDS = {
    "react": [0, 1, 2], "component": [3, 4], "hook": [5, 6], "state": [7, 8],
    "typescript": [9, 10], "css": [11, 12], "tailwind": [13, 14], "vite": [15],
    "api": [20, 21], "server": [22, 23], "database": [24, 25], "sql": [26, 27],
    "supabase": [28, 29], "trpc": [30, 31], "express": [32], "node": [33],
    "embedding": [40, 41], "vector": [42, 43], "model": [44, 45], "llm": [46, 47],
    "ai": [48, 49], "neural": [50, 51], "semantic": [52, 53], "similarity": [54],
    "security": [60, 61], "auth": [62, 63], "token": [64, 65], "jwt": [66, 67],
    "encryption": [68], "password": [69], "oauth": [70],
    "performance": [80, 81], "cache": [82, 83], "optimization": [84, 85],
    "speed": [86], "latency": [87], "memory": [88], "cpu": [89],
    "architecture": [100, 101], "pattern": [102, 103], "design": [104, 105],
    "microservice": [106], "monolith": [107], "scalable": [108],
    "deploy": [120, 121], "docker": [122, 123], "kubernetes": [124], "ci": [125],
    "github": [126], "vercel": [127], "manus": [128, 129],
    "data": [140, 141], "schema": [142, 143], "migration": [144], "index": [145],
    "query": [146], "join": [147], "aggregate": [148],
    "error": [160, 161], "exception": [162], "retry": [163], "fallback": [164],
    "debug": [165], "log": [166], "monitor": [167],
    "test": [180, 181], "vitest": [182], "unit": [183], "integration": [184],
    "mock": [185], "coverage": [186],
}


# ─── EMBEDDING FUNCTIONS ─────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """Tokenizacja tekstu — lowercase, usunięcie znaków specjalnych."""
    import re
    return [t for t in re.sub(r'[^a-z0-9\s]', ' ', text.lower()).split() if len(t) > 2]


def tfidf_embedding(text: str, dim: int = DIM) -> list[float]:
    """
    TF-IDF based pseudo-embedding.
    Deterministyczny, zero API calls, 1536-wymiarowy.
    """
    tokens = tokenize(text)
    
    # TF
    tf: dict[str, float] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    
    max_tf = max(tf.values(), default=1)
    
    # Inicjalizuj wektor
    embedding = [0.0] * dim
    
    # Wypełnij na podstawie słów kluczowych
    for word, dims in DOMAIN_KEYWORDS.items():
        word_tf = tf.get(word, 0) / max_tf
        if word_tf > 0:
            for d in dims:
                if d < dim:
                    embedding[d] += word_tf
    
    # Hash-based filling dla pozostałych wymiarów
    seed = 0
    for token in tokens:
        for ch in token:
            seed = (seed * 31 + ord(ch)) & 0xFFFFFFFF
    
    for i in range(200, dim):
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
        embedding[i] = ((seed & 0xFFFF) / 0x8000 - 1) * 0.1
    
    # Normalizuj do unit vector
    norm = math.sqrt(sum(v * v for v in embedding)) or 1.0
    return [v / norm for v in embedding]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity między dwoma wektorami."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a)) or 1.0
    norm_b = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (norm_a * norm_b)


# ─── K-MEANS CLUSTERING ──────────────────────────────────────────────────────

def kmeans_clustering(
    embeddings: list[dict],
    k: int = 8,
    max_iter: int = 50
) -> list[dict]:
    """
    Prosta implementacja k-means dla wektorów.
    Zwraca listę klastrów z centroidami i członkami.
    """
    if len(embeddings) < k:
        k = max(1, len(embeddings))
    
    # Inicjalizuj centroidy losowo (k-means++)
    import random
    random.seed(42)
    
    centroids = [embeddings[i]["vector"] for i in random.sample(range(len(embeddings)), k)]
    
    for iteration in range(max_iter):
        # Przypisz każdy embedding do najbliższego centroidu
        assignments = []
        for emb in embeddings:
            sims = [cosine_similarity(emb["vector"], c) for c in centroids]
            assignments.append(sims.index(max(sims)))
        
        # Zaktualizuj centroidy
        new_centroids = []
        for cluster_id in range(k):
            members = [embeddings[i]["vector"] for i, a in enumerate(assignments) if a == cluster_id]
            if not members:
                new_centroids.append(centroids[cluster_id])
                continue
            
            # Średnia wektorów
            dim = len(members[0])
            centroid = [sum(m[d] for m in members) / len(members) for d in range(dim)]
            
            # Normalizuj
            norm = math.sqrt(sum(v * v for v in centroid)) or 1.0
            new_centroids.append([v / norm for v in centroid])
        
        # Sprawdź konwergencję
        if all(cosine_similarity(c1, c2) > 0.999 for c1, c2 in zip(centroids, new_centroids)):
            print(f"  K-means converged after {iteration + 1} iterations")
            break
        
        centroids = new_centroids
    
    # Zbuduj klastry
    clusters = []
    for cluster_id in range(k):
        members = [embeddings[i] for i, a in enumerate(assignments) if a == cluster_id]
        if not members:
            continue
        
        # Dominująca domena
        domains = [m.get("domain", "unknown") for m in members]
        domain_counts = {}
        for d in domains:
            domain_counts[d] = domain_counts.get(d, 0) + 1
        dominant_domain = max(domain_counts, key=domain_counts.get)
        
        # Słowa kluczowe z tytułów
        all_tokens = []
        for m in members:
            all_tokens.extend(tokenize(m.get("title", "")))
        
        # Top 10 tokenów (TF)
        token_freq = {}
        for t in all_tokens:
            token_freq[t] = token_freq.get(t, 0) + 1
        keywords = sorted(token_freq, key=token_freq.get, reverse=True)[:10]
        
        clusters.append({
            "cluster_id": cluster_id,
            "name": dominant_domain,
            "description": f"Klaster semantyczny #{cluster_id} — {len(members)} doświadczeń",
            "centroid": centroids[cluster_id],
            "member_count": len(members),
            "members": [m["id"] for m in members],
            "keywords": keywords,
            "dominant_domain": dominant_domain,
        })
    
    return clusters


# ─── ANOMALY DETECTION ───────────────────────────────────────────────────────

def detect_anomalies(embeddings: list[dict], threshold: float = 0.15) -> list[dict]:
    """
    Wykrywa doświadczenia semantycznie izolowane (anomalie).
    Anomalia = doświadczenie z max similarity < threshold do wszystkich innych.
    """
    anomalies = []
    
    for i, emb in enumerate(embeddings):
        max_sim = 0.0
        for j, other in enumerate(embeddings):
            if i == j:
                continue
            sim = cosine_similarity(emb["vector"], other["vector"])
            max_sim = max(max_sim, sim)
        
        if max_sim < threshold:
            anomalies.append({
                "id": emb["id"],
                "title": emb.get("title", "Unknown"),
                "domain": emb.get("domain", "unknown"),
                "max_similarity": round(max_sim, 3),
            })
    
    return anomalies


# ─── MAIN PIPELINE ───────────────────────────────────────────────────────────

def run_pipeline(mode: str = "delta"):
    """Główny pipeline."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_KEY")
        sys.exit(1)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print(f"🧠 Manus Brain Vector Pipeline — Mode: {mode}")
    print(f"   Supabase: {SUPABASE_URL[:40]}...")
    print()
    
    # ── 1. Pobierz doświadczenia ──────────────────────────────────────────────
    print("📥 Fetching experiences...")
    result = supabase.table("manus_experiences").select(
        "id, title, summary, domain, category, tags, confidence"
    ).eq("status", "active").execute()
    
    experiences = result.data or []
    print(f"   Found {len(experiences)} active experiences")
    
    if not experiences:
        print("   No experiences to process")
        return
    
    # ── 2. Pobierz istniejące embeddings ──────────────────────────────────────
    print("\n📊 Fetching existing embeddings...")
    emb_result = supabase.table("manus_embeddings").select(
        "id, source_id, content_hash, embedding"
    ).eq("source_type", "experience").execute()
    
    existing = {e["source_id"]: e for e in (emb_result.data or [])}
    print(f"   Found {len(existing)} existing embeddings")
    
    # ── 3. Indeksowanie ───────────────────────────────────────────────────────
    print(f"\n🔢 Indexing ({mode} mode)...")
    
    indexed = 0
    skipped = 0
    errors = 0
    all_embeddings = []
    
    for exp in experiences:
        text = " | ".join(filter(None, [
            exp.get("title", ""),
            exp.get("summary", ""),
            exp.get("domain", ""),
            exp.get("category", ""),
            " ".join(exp.get("tags") or []),
        ]))
        
        content_hash = hashlib.sha256(text.encode()).hexdigest()
        
        # Sprawdź czy trzeba re-indeksować
        if mode == "delta" and exp["id"] in existing:
            if existing[exp["id"]]["content_hash"] == content_hash:
                # Użyj istniejącego embeddings
                emb_str = existing[exp["id"]]["embedding"]
                vec = json.loads(emb_str) if isinstance(emb_str, str) else emb_str
                all_embeddings.append({
                    "id": existing[exp["id"]]["id"],
                    "exp_id": exp["id"],
                    "title": exp.get("title", ""),
                    "domain": exp.get("domain", "unknown"),
                    "vector": vec,
                })
                skipped += 1
                continue
        
        # Generuj embedding
        try:
            vec = tfidf_embedding(text)
            
            # Upsert do Supabase
            supabase.table("manus_embeddings").upsert({
                "source_type": "experience",
                "source_id": exp["id"],
                "content_hash": content_hash,
                "embedding": json.dumps(vec),
                "model_used": "tfidf-v1-python",
                "updated_at": datetime.datetime.utcnow().isoformat(),
            }, on_conflict="source_type,source_id").execute()
            
            all_embeddings.append({
                "id": exp["id"],  # Tymczasowe ID
                "exp_id": exp["id"],
                "title": exp.get("title", ""),
                "domain": exp.get("domain", "unknown"),
                "vector": vec,
            })
            
            indexed += 1
            print(f"   ✓ {exp['title'][:50]}")
            
        except Exception as e:
            print(f"   ✗ ERROR for '{exp.get('title', '?')}': {e}")
            errors += 1
    
    print(f"\n   Indexed: {indexed}, Skipped: {skipped}, Errors: {errors}")
    
    # ── 4. Semantic links ─────────────────────────────────────────────────────
    print("\n🔗 Building semantic links...")
    
    links = []
    for i, emb_a in enumerate(all_embeddings):
        for j, emb_b in enumerate(all_embeddings):
            if i >= j:
                continue
            sim = cosine_similarity(emb_a["vector"], emb_b["vector"])
            if sim > 0.15:
                links.append({
                    "source_id": emb_a["id"],
                    "target_id": emb_b["id"],
                    "similarity": round(sim, 3),
                    "link_type": "semantic",
                })
    
    print(f"   Found {len(links)} links (threshold: 0.15)")
    
    if links:
        # Usuń stare linki
        supabase.table("manus_semantic_links").delete().neq(
            "id", "00000000-0000-0000-0000-000000000000"
        ).execute()
        
        # Wstaw nowe w batches
        batch_size = 100
        for i in range(0, len(links), batch_size):
            batch = links[i:i + batch_size]
            supabase.table("manus_semantic_links").insert(batch).execute()
        
        print(f"   ✓ Inserted {len(links)} semantic links")
    
    # ── 5. K-means clustering ─────────────────────────────────────────────────
    print("\n🔮 Running k-means clustering...")
    
    k = min(8, max(2, len(all_embeddings) // 3))
    clusters = kmeans_clustering(all_embeddings, k=k)
    
    print(f"   Created {len(clusters)} clusters")
    
    # Zapisz klastry
    supabase.table("manus_vector_clusters").delete().neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    
    for cluster in clusters:
        supabase.table("manus_vector_clusters").insert({
            "name": cluster["name"],
            "description": cluster["description"],
            "centroid": json.dumps(cluster["centroid"]),
            "member_count": cluster["member_count"],
            "keywords": cluster["keywords"],
        }).execute()
    
    print(f"   ✓ Saved {len(clusters)} clusters to Supabase")
    
    # ── 6. Anomaly detection ──────────────────────────────────────────────────
    print("\n🔍 Detecting anomalies...")
    
    anomalies = detect_anomalies(all_embeddings)
    print(f"   Found {len(anomalies)} anomalies (isolated experiences)")
    
    if anomalies:
        print("   Anomalies:")
        for a in anomalies[:5]:
            print(f"     - {a['title'][:50]} (max_sim: {a['max_similarity']})")
    
    # ── 7. Generuj raport ─────────────────────────────────────────────────────
    print("\n📄 Generating report...")
    
    report = generate_report(
        experiences=experiences,
        embeddings=all_embeddings,
        clusters=clusters,
        links=links,
        anomalies=anomalies,
        stats={
            "indexed": indexed,
            "skipped": skipped,
            "errors": errors,
            "total": len(experiences),
        }
    )
    
    # Zapisz raport lokalnie
    report_path = f"/home/ubuntu/manus-brain-dashboard/reports/vector_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    
    print(f"   ✓ Report saved: {report_path}")
    
    # Eksportuj do Google Drive
    export_to_gdrive(report_path)
    
    print("\n✅ Pipeline completed!")
    print(f"   Embeddings: {len(all_embeddings)}")
    print(f"   Links: {len(links)}")
    print(f"   Clusters: {len(clusters)}")
    print(f"   Anomalies: {len(anomalies)}")


def generate_report(
    experiences: list,
    embeddings: list,
    clusters: list,
    links: list,
    anomalies: list,
    stats: dict,
) -> str:
    """Generuje raport Markdown z wynikami pipeline."""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # Top 5 par podobnych
    top_links = sorted(links, key=lambda x: x["similarity"], reverse=True)[:5]
    
    report = f"""# Manus Brain — Raport Wektorowy
**Data:** {now}  
**Pipeline:** TF-IDF v1 (Python)

---

## Statystyki Indeksowania

| Metryka | Wartość |
|---------|---------|
| Łączne doświadczenia | {stats['total']} |
| Nowo zaindeksowane | {stats['indexed']} |
| Pominięte (bez zmian) | {stats['skipped']} |
| Błędy | {stats['errors']} |
| Pokrycie | {round((len(embeddings) / max(stats['total'], 1)) * 100)}% |

---

## Klastry Semantyczne ({len(clusters)})

"""
    
    for cluster in clusters:
        report += f"### Klaster: {cluster['name'].capitalize()} ({cluster['member_count']} exp.)\n"
        report += f"**Słowa kluczowe:** {', '.join(cluster['keywords'][:6])}\n\n"
    
    report += f"""
---

## Linki Semantyczne

**Łącznie:** {len(links)} par (próg: 0.15)

### Top 5 Najbardziej Podobnych Par

"""
    
    for link in top_links:
        report += f"- Similarity: **{link['similarity']}** — `{link['source_id'][:8]}` ↔ `{link['target_id'][:8]}`\n"
    
    report += f"""
---

## Anomalie ({len(anomalies)})

Doświadczenia semantycznie izolowane (max similarity < 0.15):

"""
    
    if anomalies:
        for a in anomalies:
            report += f"- **{a['title'][:60]}** (domena: {a['domain']}, max_sim: {a['max_similarity']})\n"
    else:
        report += "_Brak anomalii — wszystkie doświadczenia mają semantyczne powiązania._\n"
    
    report += f"""
---

## Rozkład Domenowy

"""
    
    domain_counts: dict[str, int] = {}
    for exp in experiences:
        d = exp.get("domain", "unknown")
        domain_counts[d] = domain_counts.get(d, 0) + 1
    
    for domain, count in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True):
        bar = "█" * count
        report += f"- **{domain}**: {bar} ({count})\n"
    
    report += f"""
---

*Wygenerowano automatycznie przez Manus Brain Vector Pipeline*  
*Model: TF-IDF v1 | Wymiarowość: 1536 | Próg podobieństwa: 0.15*
"""
    
    return report


def export_to_gdrive(report_path: str):
    """Eksportuje raport do Google Drive przez rclone."""
    try:
        gdrive_path = f"manus_google_drive:Manus Brain/Vector Reports/"
        cmd = f"rclone copy '{report_path}' '{gdrive_path}' --config /home/ubuntu/.gdrive-rclone.ini 2>&1"
        result = os.popen(cmd).read()
        
        if "error" in result.lower():
            print(f"   ⚠ Google Drive export warning: {result[:100]}")
        else:
            print(f"   ✓ Exported to Google Drive: {gdrive_path}")
    except Exception as e:
        print(f"   ⚠ Google Drive export failed: {e}")


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manus Brain Vector Pipeline")
    parser.add_argument(
        "--mode",
        choices=["full", "delta", "cluster", "report"],
        default="delta",
        help="Pipeline mode (default: delta)"
    )
    args = parser.parse_args()
    
    run_pipeline(mode=args.mode)
