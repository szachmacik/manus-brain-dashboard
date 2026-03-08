# Manus Brain — Uprawnienia do Autodeploymentu

**Data:** 8 marca 2026  
**Status:** Analiza i wymagania

---

## Co już działa (bez dodatkowych uprawnień)

Poniższe elementy są w pełni operacyjne w aktualnej konfiguracji:

| Komponent | Status | Opis |
|-----------|--------|------|
| Manus Webdev Hosting | ✅ Działa | Aplikacja hostowana na `*.manus.space` |
| Supabase MCP | ✅ Działa | Pełny dostęp: SQL, migracje, Edge Functions |
| GitHub MCP | ✅ Działa | Push/pull do `szachmacik/manus-brain-kb` |
| Google Drive (rclone) | ✅ Działa | Eksport raportów do `Manus Brain/` |
| Vercel MCP | ✅ Działa | Deploy, logi, domeny |
| Web Push (Manus built-in) | ✅ Działa | `notifyOwner()` — alerty do właściciela |
| tRPC + Express | ✅ Działa | Backend API w pełni operacyjny |
| pgvector (Supabase) | ✅ Działa | Baza wektorowa aktywna |

---

## Co wymaga dodatkowych uprawnień / konfiguracji

### 1. GitHub Actions — Autodeployment CI/CD

**Co to daje:** Każdy push do `main` automatycznie deployuje aplikację bez ręcznego klikania "Publish" w Manus UI.

**Wymagane kroki:**
1. Dodaj secret `MANUS_DEPLOY_TOKEN` do repozytorium GitHub
2. Utwórz plik `.github/workflows/deploy.yml` (mogę to zrobić autonomicznie)
3. Wygeneruj token deploymentu w Manus Settings → API Keys

**Alternatywa:** Użyj Vercel MCP `deploy_to_vercel` — już mam dostęp, mogę deployować na Vercel bez dodatkowych uprawnień.

---

### 2. Vercel Autodeployment (zalecane — już dostępne)

**Co to daje:** Deploy na Vercel z własną domeną, automatyczny CI/CD z GitHub.

**Wymagane kroki:**
1. Połącz repozytorium `szachmacik/manus-brain-dashboard` z Vercel
2. Dodaj zmienne środowiskowe do Vercel:
   - `SUPABASE_URL` — już mam wartość
   - `SUPABASE_KEY` — już mam wartość
   - `DATABASE_URL` — z Manus env
   - `JWT_SECRET` — z Manus env
   - `BUILT_IN_FORGE_API_KEY` — z Manus env
   - `BUILT_IN_FORGE_API_URL` — z Manus env
3. Vercel automatycznie deployuje po każdym push do `main`

**Uwaga:** Manus webdev hosting i Vercel to dwa oddzielne środowiska. Vercel wymaga własnej bazy danych (np. Supabase — już mamy).

---

### 3. Scheduled Cron — Automatyczne pipeline'y

**Co to daje:** Automatyczne uruchamianie `weeklyVectorReport` i `runFullPipeline` bez ręcznego klikania.

**Opcja A — Supabase Edge Functions (zalecane):**
- Utwórz Edge Function `cron-pipeline` w Supabase
- Skonfiguruj cron schedule: `0 2 * * 1` (poniedziałek 2:00 UTC)
- Mam już dostęp przez Supabase MCP (`deploy_edge_function`)
- **Mogę to zrobić autonomicznie** — nie wymaga dodatkowych uprawnień

**Opcja B — GitHub Actions cron:**
- Workflow uruchamiany co tydzień wywołuje endpoint `/api/trpc/scheduler.weeklyVectorReport`
- Wymaga: `MANUS_APP_URL` secret w GitHub

**Opcja C — Zewnętrzny cron (cron-job.org):**
- Darmowy serwis wywołujący endpoint HTTP co tydzień
- Nie wymaga żadnych uprawnień — tylko URL aplikacji

---

### 4. Własna domena

**Co to daje:** `brain.szachmacik.pl` lub `manus.offshore.dev` zamiast `*.manus.space`.

**Wymagane kroki:**
1. W Manus UI: Settings → Domains → dodaj domenę
2. Lub przez Vercel: automatyczne SSL + CDN
3. Cloudflare DNS: dodaj CNAME rekord

**Mam już dostęp:** Vercel MCP `check_domain_availability_and_price` — mogę sprawdzić dostępność domen.

---

### 5. Automatyczny backup bazy danych

**Co to daje:** Codzienne kopie zapasowe Supabase do Google Drive.

**Wymagane kroki:**
1. Supabase MCP `create_branch` — snapshoty bazy
2. Skrypt Python exportujący dane do Google Drive (już mam `rclone`)
3. GitHub Actions cron wywołujący skrypt

**Mogę to zrobić autonomicznie** — mam wszystkie wymagane uprawnienia.

---

### 6. Monitoring i alerty produkcyjne

**Co to daje:** Automatyczne alerty gdy serwer pada, błędy 5xx, wolne zapytania.

**Opcje:**
- **Vercel Analytics** — wbudowane, włącza się automatycznie po deploy
- **Supabase Advisors** — `get_advisors` — już mam dostęp
- **Uptime Robot** (darmowy) — monitoring URL co 5 min, alert na email/Telegram

---

## Podsumowanie — Co mogę zrobić TERAZ bez dodatkowych uprawnień

| Zadanie | Czas | Metoda |
|---------|------|--------|
| Deploy na Vercel | ~10 min | Vercel MCP `deploy_to_vercel` |
| Supabase Edge Function cron | ~15 min | Supabase MCP `deploy_edge_function` |
| GitHub Actions CI/CD | ~10 min | `gh` CLI + plik workflow |
| Automatyczny backup do Drive | ~20 min | Python + rclone + cron |
| Eksport grafu do GitHub Pages | ~15 min | `gh` CLI + static HTML |

## Co wymaga Twojej akcji (jednorazowe)

| Akcja | Gdzie | Czas |
|-------|-------|------|
| Połącz repo z Vercel | vercel.com → Import Project | 2 min |
| Dodaj env vars do Vercel | Vercel Dashboard → Settings → Env | 5 min |
| Włącz GitHub Actions w repo | GitHub → Settings → Actions → Allow | 1 min |
| Domena (opcjonalne) | Manus UI → Settings → Domains | 5 min |

---

## Rekomendowana kolejność wdrożenia

**Etap 1 (autonomiczny — mogę zrobić teraz):**
1. Supabase Edge Function cron dla `weeklyVectorReport`
2. GitHub Actions workflow dla CI/CD
3. Automatyczny backup bazy do Google Drive

**Etap 2 (wymaga Twojej akcji):**
1. Połącz z Vercel → autodeployment po każdym push
2. Dodaj env vars do Vercel
3. Opcjonalnie: własna domena

**Etap 3 (po wdrożeniu na produkcję):**
1. Monitoring Uptime Robot
2. Vercel Analytics
3. Supabase Advisors — automatyczne alerty wydajności

---

*Dokument wygenerowany autonomicznie przez Manus Brain Dashboard Agent*
