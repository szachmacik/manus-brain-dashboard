# Manus Brain Dashboard — TODO

## Backend tRPC
- [x] Router: brain.search — globalne wyszukiwanie po wszystkich tabelach Supabase
- [x] Router: brain.analytics — statystyki tygodniowe/miesięczne, trendy, wykresy
- [x] Router: brain.export — eksport danych do JSON/CSV
- [x] Router: brain.healthCheck — sprawdzenie stanu wszystkich tabel i połączeń
- [ ] Router: brain.autoTag — automatyczne tagowanie notatek na podstawie treści
- [x] Router: brain.timeline — chronologiczna oś czasu wszystkich aktywności
- [x] Router: brain.stats — zagregowane statystyki dla OverviewPanel

## Dashboard — nowe panele
- [x] Panel: SearchPanel — globalne wyszukiwanie z filtrami
- [x] Panel: AnalyticsPanel — wykresy trendów, aktywność, koszty w czasie
- [x] Panel: TimelinePanel — oś czasu wszystkich aktywności Manusa
- [x] Panel: ExportPanel — eksport danych do JSON/CSV/Markdown
- [x] Panel: NotificationsPanel — Web Push, historia alertów
- [x] Panel: ProceduresPanel — Centrum Procedur z Dekalogiem
- [x] Panel: AIModelsPanel — Multi-AI Router (Claude, Kimi, DeepSeek, Manus)
- [x] Panel: CrossProjectPanel — cross-project knowledge sharing
- [x] Panel: ProjectsPanel — kontekst aktywnych projektów
- [x] Panel: PatternsPanel — wzorce i anty-wzorce
- [x] Panel: HealthPanel — health score i trendy

## Dashboard — ulepszenia istniejących paneli
- [ ] OverviewPanel: podłączenie do tRPC brain.stats (zamiast Supabase direct)
- [ ] ExperiencesPanel: filtrowanie, sortowanie, paginacja
- [ ] NotesPanel: wyszukiwanie w notatkach, auto-tagging
- [ ] ProjectsPanel: progress bar, ostatnia aktywność, linki do projektów
- [ ] PatternsPanel: głosowanie na wzorce (przydatne/nieprzydatne)
- [ ] HealthPanel: real-time refresh, alerty przy niskim health score

## Skrypty Python
- [x] health_check.py — sprawdzenie stanu systemu i wysłanie push jeśli problemy
- [x] auto_tagger.py — automatyczne tagowanie notatek bez AI (regex + słowa kluczowe)
- [x] data_export.py — eksport całej bazy do JSON/CSV/Markdown
- [x] context_capture.py — szablon do szybkiego zapisywania kontekstu po rozmowie
- [x] weekly_report.py — tygodniowy raport push (niedziela 08:00)
- [x] manus_learning_engine_v2.py — nocny learning run z delta-only
- [ ] project_sync.py — synchronizacja projektów między Supabase a Google Drive

## Baza wiedzy Supabase
- [x] Seed v1: 13 doświadczeń, 6 wzorców, 7 projektów
- [x] Seed v2: domain_metrics (98 wpisów), system_health (15 snapshotów), knowledge_graph (22 krawędzie)
- [x] Seed v3: 23 doświadczenia, 17 wzorców/procedur, 6 notatek
- [x] Seed v4: 12 nowych doświadczeń (security, performance, UX, testing, architecture)

## GitHub repo manus-brain-skills
- [x] SKILL.md: manus-brain — instrukcje dla Manusa jak korzystać z bazy
- [x] SKILL.md: multi-ai-router — instrukcje dla Multi-AI Router
- [x] DECALOG.md — Centrum Procedur z 10 zasadami
- [x] templates/multi_ai_router_template.ts — szablon reużywalny
- [x] templates/web_push_service_worker.js — Service Worker template
- [x] templates/new_project_checklist.md — checklist nowego projektu
- [x] templates/note_template.py, project_update.py, experience_query.py
- [x] docs/: dokumentacja architektury systemu (knowledge/architecture.md)

## Testy i jakość
- [x] Vitest: 9/9 testów przechodzi (brain.test.ts + auth.logout.test.ts)
- [x] TypeScript: zero błędów po wszystkich zmianach
- [x] Checkpoint v7 — Multi-AI Router, panel AI Models
- [x] Checkpoint v8 — Baza Wektorowa (pgvector + TF-IDF + Knowledge Graph)

## Web Push
- [x] VAPID keys wygenerowane i skonfigurowane
- [x] Service Worker (client/public/sw.js)
- [x] Backend: subscribe, unsubscribe, sendNotification, getHistory, sendWeeklyReport
- [x] Frontend: usePushNotifications hook, NotificationsPanel
- [x] Harmonogram tygodniowy: niedziela 08:00
- [ ] Przetestować na prawdziwym urządzeniu mobilnym po Publish

## Multi-AI Router
- [x] Backend: server/routers/ai.ts (Claude, Kimi K2, DeepSeek V3, Manus)
- [x] Frontend: AIModelsPanel z testowaniem modeli
- [x] Tabela ai_usage_logs w MySQL
- [ ] Dodać klucze API: ANTHROPIC_API_KEY, MOONSHOT_API_KEY, DEEPSEEK_API_KEY

## Baza Wektorowa (pgvector + TF-IDF)
- [x] Aktywacja pgvector w Supabase (rozszerzenie vector 0.8.0)
- [x] Tabele: manus_embeddings, manus_vector_clusters, manus_semantic_links
- [x] Pipeline JS: scripts/generate_embeddings.mjs — TF-IDF 1536-dim
- [x] Pipeline Python: scripts/vector_pipeline.py — full/delta/cluster/report
- [x] Indeksowanie 23 doświadczeń (100% pokrycie)
- [x] 24 semantic links (próg: 0.15)
- [x] 7 klastrów semantycznych (k-means)
- [x] 5 anomalii wykrytych (izolowane doświadczenia)
- [x] Router tRPC: vector.stats, semanticSearch, findSimilar, clusters, knowledgeGraph, indexNew, coverage
- [x] VectorPanel: Knowledge Graph (force simulation), Semantic Search, Klastry, Pokrycie
- [x] Integracja z ExperiencesPanel: "Podobne doświadczenia" w szczegółach
- [x] Integracja z OverviewPanel: Vector DB row (embeddings, links, clusters, coverage)
- [x] Sidebar: nowy wpis "Baza Wektorowa" z ikoną Network
- [x] 14 testów vitest dla TF-IDF i cosine similarity
- [x] Raport wektorowy wyeksportowany do Google Drive
- [x] Checkpoint v8 — Baza Wektorowa

## Checkpoint v9 — Autonomiczne rozszerzenia
- [x] Auto-reindeksowanie po learning run (vector.indexNew w brain router)
- [x] Semantic Search w SearchPanel (tryb "po znaczeniu")
- [x] Cluster Evolution Tracking — tabela manus_cluster_history + wizualizacja
- [x] VectorPanel: zakładka Ewolucja (bar chart + trend per klaster)
- [x] Seed v4 — 12 nowych doświadczeń (security, performance, UX, testing, architecture)
- [x] Pipeline Manager (SchedulerPanel) — Full Pipeline, historia uruchomień
- [x] Scheduler Router — runFullPipeline, status, history, snapshotClusters
- [x] Tabela manus_scheduler_jobs w Supabase
- [x] Dokumentacja architektury — knowledge/architecture.md w GitHub
- [x] 38 testów vitest (4 pliki testowe)
- [x] Checkpoint v9 + GitHub + Google Drive

## Checkpoint v10 — Sugestie v9 + Autodeployment
- [x] Auto-reindeksowanie webhook — brain.saveLearningRun z TF-IDF pipeline
- [x] Tygodniowy raport wektorowy — scheduler.weeklyVectorReport + Web Push
- [x] Eksport grafu do Gephi/Cytoscape — GEXF, GraphML, Cytoscape.js, JSON w ExportPanel
- [x] 61 testów vitest (5 plików testowych)
- [ ] Lista uprawnień do autodeploymentu — dokumentacja
