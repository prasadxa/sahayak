# Sahayak architecture: file structure, data schema and contracts

This is the source of truth for **where code lives**, **what the database
holds** and **the function signatures that modules share**. Change it when you
change a contract.

## 1. File structure

```
chat/
├── AGENTS.md / CLAUDE.md          agent guidance + project status
├── README.md
├── docs/
│   ├── architecture.md            ← this file
│   ├── sih-demo-script.md         7-step judge demo
│   └── superpowers/{specs,plans}/ design + implementation plan
│
├── app/
│   ├── layout.tsx                 root: reads `sahayak-lang` cookie → <html lang>, viewport/PWA meta
│   ├── convex-client-provider.tsx Convex + Auth + I18nProvider(initialLang)
│   ├── manifest.ts                PWA manifest
│   ├── api/health/route.ts        GET health: { ok, time, convex, version } (200/503, no-store)
│   ├── (auth)/login, register     sign-in (Password + Google)
│   ├── (chat)/
│   │   ├── page.tsx, chat/[id]/   chat UI
│   │   ├── api/chat/route.ts      AI SDK streamText agent (tools below)
│   │   ├── api/og/route.tsx       social preview image
│   │   ├── knowledge/page.tsx     KB manager (staff write, everyone read)
│   │   ├── grievances/page.tsx    "My grievances" with timeline
│   │   └── admin/                 staff only
│   │       ├── page.tsx           dashboard: stats, languages, unanswered questions
│   │       ├── grievances/page.tsx grievance console (filter, update status)
│   │       ├── users/page.tsx     role management (admin)
│   │       └── models/page.tsx    "Models & voice" provider/model picker (admin)
│   ├── track/page.tsx             PUBLIC grievance tracking by ref ID
│   └── kiosk/                     Raspberry Pi kiosk (kiosk-role account)
│       ├── layout.tsx             full-screen shell
│       └── page.tsx               language tiles → hold-to-talk → spoken answers → receipt
│
├── components/
│   ├── kiosk/receipt.tsx          58 mm printable receipt + QR
│   ├── tool-ui.tsx                tool chips/cards (KB, grievance, PMFBY)
│   ├── language-selector.tsx, voice-input-button.tsx, message-actions.tsx (TTS) …
│   └── ui/                        shadcn primitives
│
├── convex/                        backend (deployed to Convex cloud)
│   ├── schema.ts                  all tables (section 2)
│   ├── access.ts                  requireUserId, readableChat, requireOwnedChat (chat ownership)
│   ├── roles.ts                   getRole / requireStaff / requireAdmin, me, setRole, listStaff, grantRole (internal)
│   ├── kb.ts                      ingest (staff), search (signed-in; vector → full-text), seed, backfill, migrateSources, query log
│   ├── grievances.ts              file, listMine, listAll, updateStatus, track, stats
│   ├── analytics.ts               overview for /admin
│   ├── voice.ts                   transcribe (STT), synthesize (TTS)
│   ├── crons.ts                   hourly TTS audio cleanup · every 15 min purge kiosk chats older than 1 h
│   ├── demo.ts                    INTERNAL demo.seed / demo.clear (judge demo data; refs GRV-DE00xxxx)
│   ├── convex.config.ts           installs the @convex-dev/rate-limiter component
│   ├── ratelimits.ts              per-user token buckets (chat/voice/kbSearch + wider *Kiosk variants); consumeChatMessage for the route
│   ├── settings.ts                app_settings: admin-set provider/model per function (modelFor/effectiveModel/listModels/setModel/resetModel)
│   ├── auth.ts, auth.config.ts, http.ts, users.ts, chats.ts, messages.ts, memories.ts, …
│   ├── test.setup.ts, test.helpers.ts, *.test.ts   convex-test (never deployed: multi-dot names)
│
├── lib/
│   ├── constants.ts               KB/grievance categories, statuses, roles (single source)
│   ├── languages.ts               23 languages, TTS_LANGUAGES, toBcp47, cookie name
│   ├── i18n.tsx                   UI dictionary (11 languages) + useI18n()
│   ├── callmissed.ts              CallMissed provider, model ids (env defaults), callmissedFetch
│   ├── model-catalog.ts           MODEL_CATALOG: pickable provider/model per MODEL_FUNCTIONS entry
│   ├── pmfby.ts                   calculatePmfbyPremium (pure)
│   ├── kb/chunk.ts, kb/url-guard.ts  pure KB helpers
│   ├── kiosk/session.ts           pure kiosk state machine (idle reset)
│   └── ai/
│       ├── models.ts, prompts.ts
│       └── tools/                 search-kb, file-grievance, pmfby-premium, web-search, memory, documents
│
├── data/kb/*.md                   curated corpus (front matter: title, category, source)
├── scripts/seed-kb.mjs            `npm run seed:kb [-- --prod]` → internal kb.seedIngest per file
├── scripts/seed-demo.mjs          `npm run seed:demo [-- --prod] [-- --clear]` → internal demo.seed/clear
├── .github/workflows/             ci.yml (lint, tsc, test, CF build) · deploy.yml (Convex + Cloudflare on main)
│
├── hardware/pi/                   Raspberry Pi 4 kiosk
│   ├── README.md                  BOM, wiring, setup, demo checklist
│   ├── setup.sh                   one-shot provisioning
│   ├── kiosk-launch.sh            Chromium kiosk flags
│   ├── talk_button.py             GPIO17 button → F8 key (uinput), GPIO27 LED
│   ├── labwc-autostart
│   └── systemd/sahayak-web.service, sahayak-button.service
│
├── public/icons/                  PWA icons (svg, 192, 512, maskable)
└── vitest.config.mts              `npm test`
```

## 2. Data schema (Convex)

`authTables` (Convex Auth) are omitted. Every table also has `_id` and `_creationTime`.

| Table | Fields | Indexes | Notes |
| --- | --- | --- | --- |
| **users** | name, email, image, emailVerificationTime? (set only when Google reports email_verified), avatarUrl?, avatarStorageId?, isMemoryEnabled?, **role?** (`member\|officer\|admin\|kiosk`) | email, **by_role** | A missing role means member. `ADMIN_EMAILS` grants admin **only for a verified email** (Google sign-in sets emailVerificationTime; Password sign-ups never do) |
| **chats** | title, visibility (`private\|public`), chatId, userId, isPinned?, **language?** | by_userId, by_chatId | Language is recorded when the chat is created |
| messages | messageId, chatId, role, parts[], attachments? | by_messageId, by_chatId | |
| documents | title, content, kind (`text\|code\|image\|sheet`), documentId, userId, chatId? | by_userId, by_documentId, by_chatId | Grievance letters and drafts |
| suggestions, votes, streams | (upstream) | | |
| memories | userId, resourceId, content, embedding[1536] | by_user, vector by_embedding(userId) | Personal memory |
| **kb_entries** | entryId, title, category, source?, content, chunkIndex, **embedding?**[1536], **needsEmbedding?**, createdBy?, createdAt | by_entry, by_category, by_title, **by_needsEmbedding**, vector by_embedding(category), **search search_content(content; category)** | One source becomes N chunks sharing entryId. `needsEmbedding` marks the backfill queue |
| **kb_sources** | entryId, title, category, source?, chunks, pendingEmbeddings, createdBy?, createdAt | by_entry, by_title | One small row per source. Listings and counts read this, never kb_entries (each chunk is about 12 KB) |
| **kb_queries** | query, category?, language?, hits, topScore?, mode (`vector\|text\|none`), createdAt | by_createdAt | Every KB search. `mode:"none"` / `hits:0` counts as unanswered |
| **grievances** | userId, refId (`GRV-XXXXXXXX`), category, subject, description, contact?, status (`submitted\|in_review\|resolved\|rejected`), **channel?** (`web\|kiosk`), **district?**, **societyName?**, **language?**, **updates?**[{status, note, at, byName}], createdAt | by_userId, by_refId, **by_status** | `updates` is the public timeline |
| **tts_audio** | storageId, createdAt | by_createdAt | Deleted after 6 h by cron |
| **app_settings** | key (`model:<function>`), provider, model, updatedBy?, updatedAt | by_key | Admin-set model overrides (`convex/settings.ts`); missing row = catalog/env default. No secrets |

Bold marks fields and tables added for the SIH prototype.

## 3. Cross-module contracts

```ts
// lib/constants.ts
KB_CATEGORIES, KB_CATEGORY_LABELS, GRIEVANCE_CATEGORIES, GRIEVANCE_STATUSES, ROLES
type Role = "member" | "officer" | "admin" | "kiosk";  isStaffRole(role)
MODEL_FUNCTIONS = ["chatSmall","chatLarge","reasoning","stt","tts","ttsVoice"];  type ModelFunction

// lib/languages.ts
LANGUAGES, languageByCode(code), LANGUAGE_COOKIE = "sahayak-lang"
TTS_LANGUAGES (en hi bn ta te kn ml mr gu pa or), isTtsLanguage(code), toBcp47(code) → "hi-IN"

// lib/pmfby.ts
calculatePmfbyPremium({ season: "kharif"|"rabi"|"commercial_horticulture", sumInsured })
  → { season, sumInsured, farmerRatePct, farmerPremium }        // throws RangeError

// convex/access.ts
requireUserId(ctx) · findChat(ctx, chatId) · readableChat(ctx, chatId) (owner or public) · requireOwnedChat(ctx, chatId)
// All chat/message/stream/document/suggestion/file functions are owner-checked; server callers pass { token }.

// convex/roles.ts
api.roles.me → { userId, role, email, name } | null
api.roles.setRole({ email, role })        // admin; officer/admin need a single verified account
internal.roles.grantRole({ email, role }) // operator bootstrap: npx convex run roles:grantRole '{"email":"…","role":"admin"}'
api.roles.listStaff → [{ userId, email, name, role }]   // admin
internal.roles.roleOf({ userId }) → Role  // for actions
requireStaff(ctx) / requireAdmin(ctx) / getRole(ctx, userId)   // helpers for queries/mutations

// convex/kb.ts
api.kb.searchKnowledgeBase({ query, category?, k?, language? }) → string   // signed-in; query capped at 500 chars
api.kb.ingestText / ingestUrl / ingestFile                     // staff
api.kb.deleteEntry({ entryId })                                // staff
api.kb.listEntries → [{ entryId, title, category, source?, chunks, pendingEmbeddings }]   // signed-in ([] otherwise)
api.kb.backfillEmbeddings → { embedded, remaining }            // staff
internal.kb.seedIngest({ title, category, source?, content })  // CLI seeder
internal.kb.migrateSources → { sources, chunks, pendingEmbeddings }  // rebuild kb_sources (idempotent)

// convex/grievances.ts
api.grievances.file({ category, subject, description, contact?, district?, societyName?, language? }) → { refId }
api.grievances.listMine → Doc<"grievances">[]
api.grievances.listAll({ status?, category?, district? })      // staff; ≤200, newest first
  → (Doc<"grievances"> & { ageDays: number, overdue: boolean })[]  // district matched after normalizeDistrict; "Unspecified" = none
api.grievances.exportRows({ status?, category?, district? })   // staff; ≤2000, newest first, same filters as listAll
  → [{ refId, createdAt /*ISO*/, status, category, subject, description, contact, district, societyName,
       channel, language, ageDays, overdue, lastUpdate /*latest timeline note*/ }]  // missing optionals = ""
api.grievances.updateStatus({ refId, status, note })           // staff
api.grievances.track({ refId }) → { refId, category, subject, status, createdAt, updates } | null  // public, no PII
api.grievances.stats → { byStatus: Record<string, number>, byCategory: Record<string, number>, total,
  byDistrict: { district: string, count: number }[],  // list (count desc): Convex keys must be ASCII, districts arrive in native script; normalised, missing → "Unspecified"
  overdue: number,                     // submitted/in_review older than GRIEVANCE_SLA_DAYS
  avgResolutionDays: number | null }   // createdAt → latest timeline move into "resolved", 1 dp; staff

// lib/grievance-sla.ts (pure; 15 days is a citizen-charter target, not a legal deadline)
GRIEVANCE_SLA_DAYS = 15 · ageInDays(createdAt, now) (floored, ≥0) · dueDate(createdAt) → ms
isOverdue({ status, createdAt }, now)   // open status and now − createdAt > 15 days (exactly 15 = on time)
normalizeDistrict(d?) → trimmed Title Case | "Unspecified"

// lib/csv.ts (pure)
toCsv(rows, columns: { key, header }[]) → string   // UTF-8 BOM, RFC 4180 quoting, CRLF, formula-injection guard

// convex/analytics.ts
api.analytics.overview → { grievances: stats, kb: { entries, chunks, pendingEmbeddings },
  queries: { total, truncated, byLanguage, byCategory, byMode }, unanswered: [{ query, language?, createdAt, count }] }  // repeats grouped  // staff
// byLanguage/byCategory keys that aren't valid Convex field names (non-ASCII, "$"-leading,
// >1024 chars — language/category arrive from the sahayak-lang cookie / free-form action args)
// fold into "other" instead of crashing serialisation.

// convex/settings.ts — "Models & voice" selections, app_settings rows keyed "model:<fn>"
api.settings.listModels → [{ function, provider, model, defaultModel, overridden }]  // admin;
  // last row is function:"embedding" (read-only; indexes are fixed at 1536 dims)
api.settings.effectiveModel({ function }) → { provider, model }   // signed-in; used by api/chat route
api.settings.setModel({ function, provider, model }) → { provider, model }  // admin; catalog-validated
api.settings.resetModel({ function }) → { provider, model }                 // admin; back to env default
internal.settings.modelFor({ function }) → { provider, model }   // used by voice.ts actions
// lib/model-catalog.ts: MODEL_CATALOG[fn].options, defaultModelId(fn) (CALLMISSED_MODEL_* env wins),
//   isCatalogChoice(fn, provider, model). lib/ai/models.ts: CHAT_MODEL_FUNCTIONS (tier → function),
//   chatLanguageModel(tier, selection?) — falls back to the env default for unknown/absent selections.

// convex/voice.ts — STT/TTS model (+voice) read from app_settings at call time
api.voice.transcribe({ storageId, language? }) → { text }      // language = short code; sent as BCP-47
api.voice.synthesize({ text, language? }) → { url }

// convex/ratelimits.ts — buckets keyed by userId; *Kiosk names for shared kiosk accounts.
// Empty bucket → action throws "Rate limit exceeded"; the chat route returns 429 + Retry-After.
api.ratelimits.consumeChatMessage() → { ok, retryAfter }       // signed-in; consumed per POST /api/chat

// lib/ai/tools factories (server): all take the caller's Convex token
searchKnowledgeBase(language, token) · fileGrievance(token, language)
createDocument({ user, dataStream, chatId, token }) · updateDocument({…same}) · requestSuggestions({ user, dataStream, token })

// AI tool results rendered by the UI
fileGrievance → { filed: true, refId, message } | string(error)
calculatePmfbyPremium → { season, sumInsured, farmerRatePct, farmerPremium, note }
```
