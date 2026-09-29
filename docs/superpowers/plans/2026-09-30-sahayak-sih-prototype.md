# Sahayak SIH Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Sahayak chatbot into a complete SIH PS 26088 prototype. That
means a multilingual UI, a seeded and resilient KB, a grievance workflow with an
officer dashboard and public tracking, a PWA, and a Raspberry Pi 4 voice kiosk.

**Architecture:** One Next.js 15 app plus a Convex cloud backend serves phones,
laptops and the Pi kiosk. The kiosk is a voice-first `/kiosk` page running on
the Pi (Chromium kiosk mode, local `next start`) under a kiosk-role account.
Hardware glue (GPIO TALK button, printer, autostart) lives in `hardware/pi/`.

**Tech Stack:** Next.js 15 / React 19, Convex 1.46 (+ Convex Auth), AI SDK 4.3,
CallMissed (LLM, embeddings, saaras STT, bulbul TTS), Vitest + convex-test,
Python 3 (gpiozero, evdev) on Raspberry Pi OS Bookworm.

**Spec:** `docs/superpowers/specs/2026-09-30-sahayak-sih-prototype-design.md`

## Global Constraints

- The embedding dimension stays **1536** (`text-embedding-3-small`) for `memories` and `kb_entries`.
- KB categories are exactly `laws | schemes | pmfby | finance | grievance | general`, defined once in `lib/constants.ts`.
- Grievance categories are exactly `membership | loan_credit | election | bylaw_violation | financial_fraud | service_denial | scheme_benefit | other`, defined once in `lib/constants.ts`.
- Grievance statuses are exactly `submitted | in_review | resolved | rejected`.
- Roles are exactly `member | officer | admin | kiosk`. Staff means `officer` or `admin`. `ADMIN_EMAILS` (Convex env, comma-separated, case-insensitive) always resolves to `admin`.
- The language cookie is `sahayak-lang`, holding a short code (`hi`). The BCP-47 code sent to STT/TTS is `<code>-IN` (for example `hi-IN`), except `en`, which uses `en-IN`.
- TTS-capable languages are exactly `en, hi, bn, ta, te, kn, ml, mr, gu, pa, or`.
- PMFBY farmer premium rates: kharif **2%**, rabi **1.5%**, annual commercial/horticultural **5%** of sum insured.
- Never log user message content or PII in the Next.js route.
- Convex functions use object syntax with `v` validators (`.cursor/rules/convex.mdc`).

## Review Focus

1. **Embeddings API down (502):** KB ingest must still store chunks, and search must still return full-text hits. Test in Task 3.
2. **A non-staff user calling KB ingest/delete or grievance status mutations directly:** must throw `Forbidden`. Tests in Tasks 2, 3 and 6.
3. **`/track` with an unknown or malformed ref ID:** must show "not found" and never leak `userId`, `contact` or `description`. Test in Task 6.
4. **The kiosk left mid-conversation:** after 120 s idle the kiosk must reset to the language screen so the next citizen doesn't see the previous chat. Unit test on the idle-reset reducer in Task 9.
5. **`ingestUrl` pointed at `http://127.0.0.1`, `http://169.254.169.254` or a `file://` URL:** must be rejected before fetching. Test in Task 3.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/constants.ts` (new) | KB/grievance categories, statuses and roles, shared by Convex and the UI |
| `lib/kb/chunk.ts` (new) | Pure `chunkText()` |
| `lib/kb/url-guard.ts` (new) | Pure `assertPublicHttpUrl()` |
| `lib/pmfby.ts` (new) | Pure `calculatePmfbyPremium()` |
| `lib/languages.ts` | Add `toBcp47()`, `TTS_LANGUAGES`, `isTtsLanguage()` |
| `lib/i18n.tsx` | Dictionary for the 11 TTS languages, SSR-aware initial language |
| `convex/roles.ts` (new) | `getRole()`, `requireStaff()`, `setRole` mutation, `me` query |
| `convex/kb.ts` | Staff-only writes, optional embeddings + full-text fallback, query log, seed, backfill |
| `convex/grievances.ts` | Timeline, `updateStatus`, `listAll`, `track`, `stats` |
| `convex/analytics.ts` (new) | Dashboard aggregates |
| `convex/voice.ts` | Language-aware TTS, audio cleanup |
| `convex/crons.ts` (new) | Hourly TTS-audio cleanup |
| `lib/ai/tools/pmfby-premium.ts` (new) | Tool wrapper over `lib/pmfby.ts` |
| `app/(chat)/api/chat/route.ts` | Language name in the prompt, tool set, no PII logs, save chat language |
| `app/(chat)/admin/*` (new) | Officer dashboard, grievance console, user roles |
| `app/track/page.tsx` (new) | Public grievance tracking |
| `app/kiosk/*` (new) | Pi kiosk UI |
| `lib/kiosk/session.ts` (new) | Pure kiosk state reducer (idle reset) |
| `app/manifest.ts`, `public/icons/*` (new) | PWA |
| `data/kb/*.md` (new), `scripts/seed-kb.mjs` (new) | Curated corpus and seeder |
| `hardware/pi/*` (new) | setup.sh, kiosk launcher, systemd units, GPIO button daemon, BOM/wiring docs |
| `vitest.config.mts`, `**/*.test.ts` (new) | Tests |

---

### Task 1: Test tooling and shared pure modules

**Files:**
- Create: `vitest.config.mts`, `lib/constants.ts`, `lib/kb/chunk.ts`, `lib/kb/chunk.test.ts`, `lib/pmfby.ts`, `lib/pmfby.test.ts`
- Modify: `package.json` (add devDeps `vitest`, `convex-test`, `@edge-runtime/vm`; script `"test": "vitest run"`), `lib/languages.ts` (+ `lib/languages.test.ts`), `convex/kb.ts` (import `chunkText`)

**Interfaces (produced):**
- `chunkText(input: string, target?: number): string[]`
- `calculatePmfbyPremium({ season: "kharif"|"rabi"|"commercial_horticulture", sumInsured: number }) → { farmerRatePct: number; farmerPremium: number; sumInsured: number; season }`, which throws `RangeError` if `sumInsured <= 0` or isn't finite
- `toBcp47(code: string): string` (`"hi"→"hi-IN"`, `"en"→"en-IN"`), `TTS_LANGUAGES: string[]`, `isTtsLanguage(code): boolean`
- `KB_CATEGORIES`, `GRIEVANCE_CATEGORIES`, `GRIEVANCE_STATUSES`, `ROLES` as `readonly` tuples plus their union types

- [ ] Write the tests: chunkText splits a 5000-char paragraph into chunks ≤ 1800, drops chunks < 20 chars, and returns `[]` for whitespace. PMFBY: kharif ₹1,00,000 → ₹2,000; rabi → ₹1,500; commercial → ₹5,000; `0` throws. Languages: `toBcp47("mr") === "mr-IN"`, `isTtsLanguage("ur") === false`.
- [ ] Run `npx vitest run` and expect FAIL (modules missing).
- [ ] Implement the modules and move `chunkText` out of `convex/kb.ts`.
- [ ] Run `npx vitest run` (PASS) and `npx tsc --noEmit` (PASS).
- [ ] Commit `chore: add vitest, shared constants, chunk/pmfby/language helpers`.

### Task 2: Roles

**Files:** Create `convex/roles.ts`, `convex/roles.test.ts`. Modify `convex/schema.ts` (users `role: v.optional(v.string())`, `index("by_role")`).

**Interfaces (produced):**
- `getRole(ctx: QueryCtx|MutationCtx|ActionCtx-via-runQuery, userId: Id<"users">): Promise<Role>`. It reads the user, uses `ADMIN_EMAILS` for admin, and otherwise returns `user.role ?? "member"`.
- `requireStaff(ctx): Promise<Id<"users">>`, which throws `"Not authenticated"` or `"Forbidden"`
- `internal.roles.roleOf({ userId }) → Role` (internalQuery, for actions)
- `api.roles.me → { userId, role, email, name } | null`
- `api.roles.setRole({ email, role })`, admin-only
- `api.roles.listStaff → users with role ≠ member`, admin-only

- [ ] Write the tests (convex-test): a user whose email is in `ADMIN_EMAILS` gets `me.role === "admin"`; a plain user gets `"member"`; a member calling `setRole` throws Forbidden; an admin sets an officer by email, and that user then gets `"officer"`.
- [ ] Run the tests (FAIL), then implement, then run them (PASS).
- [ ] Commit `feat: user roles (member/officer/admin/kiosk)`.

### Task 3: Resilient, staff-only knowledge base

**Files:** Modify `convex/schema.ts` (`kb_entries.embedding` optional, `.searchIndex("search_content", { searchField: "content", filterFields: ["category"] })`, new table `kb_queries { query, category?, language?, hits, topScore?, mode: "vector"|"text"|"none", createdAt }` with index `by_createdAt`), `convex/kb.ts`. Create `lib/kb/url-guard.ts`, `lib/kb/url-guard.test.ts`, `convex/kb.test.ts`.

**Interfaces:**
- `assertPublicHttpUrl(raw: string): URL`. It rejects non-http(s) URLs, `localhost`, `*.local`, IPv4 private/loopback/link-local (10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 0/8) and IPv6 `::1`, `fc00::/7` and `fe80::/10`.
- `ingest*` actions call `internal.roles.roleOf` and require staff. `deleteEntry` requires staff.
- If embedding fails, chunks are inserted without `embedding` (and the error is logged). `api.kb.backfillEmbeddings` (staff) and `internal.kb.backfillEmbeddingsInternal` embed missing chunks in batches of 32.
- `searchKnowledgeBase({ query, category?, k?, language? }) → string`. It tries vector search (`mode:"vector"`, and keeps results only if topScore ≥ 0.25). On failure or no results it uses the full-text index (`mode:"text"`), then logs to `kb_queries`. The output format is unchanged.
- `internal.kb.seedIngest({ title, category, source?, content })` runs ingestion without an auth check, for the CLI seeder.

- [ ] Write the tests: the url-guard cases from Review Focus #5 plus `https://pmfby.gov.in` passing. convex-test: a member calling `deleteEntry` throws Forbidden. `insertChunks` without embeddings, then `textSearch` (an internal query wrapping the search index), finds the chunk by keyword.
- [ ] Run the tests (FAIL), then implement, then run them (PASS). Then `npx convex dev --once` and confirm the schema pushes.
- [ ] Update `app/(chat)/knowledge/page.tsx`: hide the forms for non-staff (via `api.roles.me`), show a "N chunks awaiting embedding" line and a Backfill button, and use `KB_CATEGORIES` from constants.
- [ ] Commit `feat(kb): staff-only writes, SSRF guard, full-text fallback, query log`.

### Task 4: Curated KB corpus and seeder

**Files:** Create `data/kb/{mscs-act-and-amendments,pacs-model-byelaws,ministry-of-cooperation-schemes,pmfby,kcc-and-interest-subvention,financial-literacy-and-fraud-safety,grievance-redressal,pacs-member-services}.md`, each with front matter `title`, `category` and `source` (official URL). Create `scripts/seed-kb.mjs` and add the `package.json` script `"seed:kb": "node scripts/seed-kb.mjs"`.

- Content rules: plain language, facts only where well established, no invented section numbers or amounts, an official source URL per file, and a "verify at the official portal" line.
- The seeder parses front matter, skips titles already present (`internal.kb.hasTitle`), and calls `npx convex run kb:seedIngest '<json>'` per file.
- [ ] Run `npm run seed:kb`. Expected: 8 entries, visible at `/knowledge`. Then `npx convex run kb:searchKnowledgeBase '{"query":"PMFBY premium"}'` returns the PMFBY chunk (vector or text mode).
- [ ] Commit `feat(kb): curated cooperative-governance corpus + seeder`.

### Task 5: Chat core: language, tools, cleanup

**Files:** Modify `lib/ai/prompts.ts` (drop code/sheet guidance, add `languageByCode(language).name` plus the native name, and add PMFBY tool guidance), `app/(chat)/api/chat/route.ts` (remove weather and PII logs, add `calculatePmfbyPremium`, give the reasoning model the KB/grievance/PMFBY tools, pass `language` to KB search and `saveChat`), `lib/ai/tools/search-kb.ts` (accept a language), `convex/schema.ts` + `convex/chats.ts` (optional `language` on chats). Create `lib/ai/tools/pmfby-premium.ts`. Update `components/tool-ui.tsx` (PMFBY result card, KB source list) and `components/message.tsx` (render them, drop weather).

**Interfaces:**
- `calculatePmfbyPremium` tool with params `{ season, sumInsured }` returning the `lib/pmfby.ts` result plus `note` ("Government pays the balance premium…").
- `searchKnowledgeBase` is now a factory `searchKnowledgeBase(language: string)`.

- [ ] Run `npx tsc --noEmit` and `npx vitest run`, then a manual smoke test: in Hindi, ask "रबी में 50000 बीमा राशि का प्रीमियम?" and expect the PMFBY tool card showing ₹750.
- [ ] Commit `feat(chat): language-aware prompt, PMFBY tool, remove weather/PII logging`.

### Task 6: Grievance workflow and public tracking

**Files:** Modify `convex/schema.ts` (grievances: `channel: v.optional(v.string())`, `district`, `societyName`, `language`, `updates: v.optional(v.array(v.object({ status, note, at, byName })))`, index `by_status`), `convex/grievances.ts`, `lib/ai/tools/file-grievance.ts` (district/society params, channel from role), `app/(chat)/grievances/page.tsx` (timeline, loading state). Create `app/track/page.tsx`, `convex/grievances.test.ts`.

**Interfaces:**
- `file({ category, subject, description, contact?, district?, societyName?, language? }) → { refId }`. It sets `channel` to `"kiosk"` when the caller's role is kiosk, else `"web"`, and seeds `updates` with a `submitted` entry.
- `updateStatus({ refId, status, note })` is staff-only and appends to `updates`.
- `listAll({ status?, category? })` is staff-only, newest first, max 200.
- `track({ refId }) → { refId, category, subject, status, createdAt, updates } | null`. It's public, never returns userId/contact/description, and matches the ref case-insensitively after trim.
- `stats` (staff) returns counts by status and by category.

- [ ] Write the tests: a member calling `updateStatus` throws Forbidden; an officer's update appends to the timeline; `track` of an unknown ref returns null; `track` output has no `userId`/`contact`/`description` keys.
- [ ] Run the tests (FAIL), then implement, then run them (PASS).
- [ ] Commit `feat(grievances): officer workflow, timeline, public tracking`.

### Task 7: Officer dashboard

**Files:** Create `convex/analytics.ts` (`overview`: grievance stats, KB entry and chunk counts, pending embeddings, queries by language, category and mode over the last 30 days, and the 20 most recent `mode:"none"` or zero-hit queries as "unanswered"; staff-only), `app/(chat)/admin/page.tsx` (stat tiles, bar lists, unanswered questions), `app/(chat)/admin/grievances/page.tsx` (filterable table and status-update dialog), `app/(chat)/admin/users/page.tsx` (admin: set a role by email, list staff). Modify `components/app-sidebar.tsx` (show a "Dashboard" link to staff).

- [ ] Smoke test: set `ADMIN_EMAILS` to the tester's email, open `/admin`, and see tiles. Update a grievance, and `/track` reflects it live.
- [ ] Commit `feat(admin): officer dashboard, grievance console, role management`.

### Task 8: Multilingual UI and voice

**Files:** Modify `lib/i18n.tsx` (keys for greeting, suggestions, placeholder, voice toasts, nav labels, grievances/track/kiosk strings, in en, hi, bn, ta, te, kn, ml, mr, gu, pa and or, falling back to en; SSR initial language from the cookie through the provider prop), `app/layout.tsx` (read the cookie, set `<html lang>`, pass `initialLang`), `components/overview.tsx`, `components/suggested-actions.tsx`, `components/multi-modal-input.tsx` (placeholder), `components/voice-input-button.tsx` (toasts, 60 s max, BCP-47), `components/message-actions.tsx` (pass the language, stop/replay, disabled with a tooltip when the language isn't TTS-capable), `convex/voice.ts` (`synthesize({ text, language? })` sends `language` and `target_language_code` as BCP-47, and deletes the uploaded clip after `transcribe`; audio rows go in table `tts_audio { storageId, createdAt }`), `convex/crons.ts` (hourly deletion of TTS audio older than 6 h).

- [ ] Smoke test: switching to தமிழ் changes the greeting, suggestions and placeholder without a reload, and Read aloud plays.
- [ ] Commit `feat(i18n): localise UI in 11 languages; language-aware TTS; audio cleanup`.

### Task 9: Raspberry Pi kiosk page

**Files:** Create `lib/kiosk/session.ts` + `lib/kiosk/session.test.ts` (reducer: states `language → idle → listening → thinking → speaking`; events `SELECT_LANG`, `PTT_DOWN`, `PTT_UP`, `TRANSCRIBED`, `ANSWER_DONE`, `SPEECH_DONE`, `TICK(now)`, `RESET`; after 120 s without activity outside `language` the next `TICK` returns `language` with a new `sessionId`), `app/kiosk/layout.tsx` (full-screen, no sidebar), `app/kiosk/page.tsx` (language tiles for the 11 TTS languages, a big hold-to-talk button driven by touch/mouse plus F8/Space keydown/keyup, streaming transcript, auto TTS of each finished answer, topic tiles, a "New person" button, and a grievance receipt card with a QR code for `/track?ref=` and a print button), `components/kiosk/receipt.tsx` (a `@media print` 58 mm layout). Add the dependency `qrcode.react`.

**Interfaces:** It uses `useChat({ api: "/api/chat", id: sessionId, body: { selectedChatModel: "chat-model-small" } })` with the same `experimental_prepareRequestBody` shape as `components/chat.tsx`. It detects `fileGrievance` tool results with `filed: true` to show the receipt. If `role !== "kiosk"` it shows a hint asking the operator to sign in with the kiosk account.

- [ ] Write the tests for the reducer (idle reset at 120 s, no reset while `speaking`, PTT_UP without PTT_DOWN ignored). Run them (FAIL), implement, run them (PASS).
- [ ] Smoke test in a desktop browser at `/kiosk`: hold Space, speak, release, and get a spoken reply.
- [ ] Commit `feat(kiosk): voice-first Raspberry Pi kiosk UI with receipts`.

### Task 10: Pi hardware glue and docs

**Files:** Create `hardware/pi/README.md` (BOM with approximate ₹, wiring diagram, OS setup, demo checklist), `hardware/pi/setup.sh` (apt deps, Node 20, clone/build, `.env.local`, systemd units, autostart, screen-blank off), `hardware/pi/kiosk-launch.sh` (Chromium flags `--kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required --kiosk-printing --use-fake-ui-for-media-stream --check-for-update-interval=31536000 "$KIOSK_URL"`), `hardware/pi/talk_button.py` (gpiozero Button on GPIO17 with `bounce_time=0.03`, evdev UInput emitting KEY_F8 down/up, LED on GPIO27 lit while held), `hardware/pi/systemd/{sahayak-web.service,sahayak-button.service}`, `hardware/pi/labwc-autostart`.

- [ ] Verify: `bash -n hardware/pi/*.sh` and `python3 -m py_compile hardware/pi/talk_button.py`.
- [ ] Commit `feat(hardware): Raspberry Pi 4 kiosk setup, GPIO talk button, printing`.

### Task 11: PWA, branding, route protection

**Files:** Create `app/manifest.ts` (name, short_name "Sahayak", `start_url: "/"`, `display: "standalone"`, theme/background colours, icons), `public/icons/icon.svg`, `public/icons/icon-192.png`, `public/icons/icon-512.png` (rendered with `sharp`), `public/icons/maskable-512.png`. Modify `app/layout.tsx` (`viewport` with themeColor, `appleWebApp`), `app/(auth)/login/page.tsx` + `register/page.tsx` (Sahayak copy), `app/(chat)/api/og/route.tsx`, `package.json` (`name: "sahayak"`), and `middleware.ts` (redirect unauthenticated users on `/`, `/chat/*`, `/grievances`, `/knowledge`, `/admin/*`, `/kiosk` to `/login`; redirect authenticated users away from `/login` and `/register`; `/track` and `/api/og` stay public).

- [ ] Verify: `npm run build` passes. Chrome DevTools → Application → Manifest shows installable. Signed out, `/` redirects to `/login` and `/track` loads.
- [ ] Commit `feat: PWA manifest, Sahayak branding, route protection`.

### Task 12: Docs and verification

- [ ] Update `README.md` (features vs PS 26088, kiosk section, seeding, roles) and the Status section of `AGENTS.md`. Add `docs/sih-demo-script.md` (the 7-step demo from the spec with the exact phrases to say).
- [ ] Run `npx vitest run`, `npx tsc --noEmit`, `npm run lint` and `npm run build`, all passing.
- [ ] Commit `docs: SIH demo script, README and status`.

**Deferred (needs the user's go-ahead, since it costs money or is outward-facing):** a Convex prod deploy plus Vercel hosting, and CallMissed missed-call/IVR and WhatsApp channels.
