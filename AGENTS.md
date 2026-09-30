# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repo.

## What this project is

**Sahayak** — a multilingual AI assistant for cooperative society members,
farmers and rural stakeholders in India (Ministry of Cooperation / NCCT
context). It answers questions on cooperative laws and by-laws, Ministry of
Cooperation schemes, PMFBY crop insurance and financial literacy, and files
grievances — in 22 Indian languages, by text or voice.

It is a fork of [openchat](https://github.com/murabcd/openchat)
(Next.js + Convex + AI SDK). The OpenAI provider was replaced with
**CallMissed** (`api.callmissed.com/v1`, OpenAI-compatible), which serves
chat, embeddings, STT, TTS and web search from one `cm_` API key.

## Stack

- **Frontend:** Next.js 15 (App Router, `--turbo`), React 19, Tailwind 3, shadcn/Radix
- **Backend:** Convex (DB, file storage, vector search, actions), Convex Auth (Password + optional Google)
- **AI:** Vercel AI SDK v4 (`ai`, `@ai-sdk/react`) with `@ai-sdk/openai` pointed at CallMissed
- **Package manager:** npm (`package-lock.json`). (Do not add a `bun.lock`: OpenNext picks its package manager from lockfiles.)

## Commands

```bash
npm install
npm run dev              # next dev + convex dev in parallel
npx convex dev --once    # push schema/functions + regenerate convex/_generated once
npx tsc --noEmit         # typecheck (no test suite exists yet)
npm run lint
npm run build
```

## Layout

| Path | What lives there |
| --- | --- |
| `app/(chat)/api/chat/route.ts` | Chat endpoint: `streamText` + tools, reads `sahayak-lang` cookie for response language |
| `app/(chat)/knowledge/` | KB admin page — paste text, fetch URL, upload PDF/text |
| `app/(chat)/grievances/` | User's filed grievances |
| `convex/schema.ts` | Tables: users/chats/messages/documents/suggestions/memories/streams (upstream) + `kb_entries`, `grievances` (Sahayak) |
| `convex/kb.ts` | KB ingestion (chunk → embed → insert) and `searchKnowledgeBase` vector search |
| `convex/voice.ts` | `transcribe` (STT, `saaras:v3`) and `synthesize` (TTS, `bulbul:v3`) actions |
| `convex/grievances.ts` | `file` mutation (returns `GRV-XXXXXXXX` ref) + `listMine` |
| `lib/callmissed.ts` | CallMissed provider, model ids (env-overridable), `callmissedFetch` helper. Isomorphic: used by Next.js **and** Convex actions |
| `lib/ai/models.ts` | `myProvider` — maps app model ids to CallMissed models |
| `lib/ai/prompts.ts` | System prompt (Sahayak persona, KB-first rule, language instruction) |
| `lib/ai/tools/` | `search-kb`, `file-grievance`, `web-search`, memory, document, weather tools |
| `lib/i18n.tsx`, `lib/languages.ts` | UI strings (en/hi/mr) + 23-language list |
| `.cursor/rules/convex.mdc` | Detailed Convex coding guidelines. Read it before writing Convex functions |

## Conventions

- **Convex functions:** use the object syntax (`query({ args, handler })`) with `v` validators on every arg. Check `getAuthUserId(ctx)` in any function that touches user data. Use `internal*` functions for anything called only from other Convex functions.
- **Vector dimensions are fixed at 1536** (`memories` and `kb_entries`). If you change the embedding model, change the index dimensions in `convex/schema.ts` too and re-ingest.
- **Model ids** belong in `CALLMISSED_MODELS` (`lib/callmissed.ts`). Don't hard-code them elsewhere.
- **Categories, statuses and roles** are defined once in `lib/constants.ts`. Import them; never copy the lists.
- **Where things live** (file tree, data schema, cross-module contracts): `docs/architecture.md`. Update it when you change a contract.
- **Tests:** `npm test` (Vitest). Convex functions are tested with `convex-test` (`convex/test.setup.ts`, `convex/test.helpers.ts`). Write the failing test first.
- **Roles:** `member | officer | admin | kiosk`. Staff-only Convex functions call `requireStaff(ctx)` / `requireAdmin(ctx)` from `convex/roles.ts`, or `internal.roles.roleOf` inside actions. `ADMIN_EMAILS` (Convex env) grants admin only for a verified (Google) email; bootstrap a Password account with `npx convex run roles:grantRole '{"email":"…","role":"admin"}'`.
- **Access control:** every chat/message/document/file function checks ownership (`convex/access.ts`). Server code calling Convex must pass `{ token }`. A kiosk-role account never sees chat history, grievances or personal memory.
- Don't hand-edit `convex/_generated/`. Regenerate it with `npx convex dev`.
- Client components need `"use client"`. Server components are the default.
- Components use `const X = () => …`. Pages, layouts and helpers use `function`.

## Environment

The CallMissed key must be set in **two** places:

1. `.env.local`, read by Next.js route handlers: `CALLMISSED_API_KEY`, `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SITE_URL`
2. The Convex deployment env, read by Convex actions:
   `npx convex env set CALLMISSED_API_KEY cm_...`

Convex Auth also needs `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` in the
**Convex** env. Set them with `npx @convex-dev/auth` or by hand. Google OAuth
additionally needs `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` there.

Never commit `.env.local` or print secret values.

## Status (as of 2026-09-30)

This is the SIH 2026 PS 26088 prototype (Hardware category). Design:
`docs/superpowers/specs/2026-09-30-sahayak-sih-prototype-design.md`. Plan:
`docs/superpowers/plans/2026-09-30-sahayak-sih-prototype.md`. Demo:
`docs/sih-demo-script.md`.

**Convex:** project `sahayak` (team `karan-rajput`).
- **dev** `whimsical-possum-664`: local `npx convex dev`, the dev test account and demo data.
- **prod** `valuable-platypus-774`: serves the live site. Its env has `CALLMISSED_API_KEY`, `AUTH_GOOGLE_*`, `SITE_URL=https://sahayak.rough-cell-383c.workers.dev` and its own JWT keys. KB seeded (8 sources / 49 chunks, embeddings pending) + demo data seeded (24 grievances, ~120 query rows). Accounts: admin via Google sign-in + `ADMIN_EMAILS`, and Password accounts `kiosk/member/officer@sahayak.in` (roles granted via `grantRole`; rotate passwords before the event).

**Hosting:** Cloudflare Workers via OpenNext (account support@freetochat.app).
- `env.production` is worker `sahayak`, deployed ONLY by `.github/workflows/deploy.yml` on push to `main`.
- The default env is worker `sahayak-dev`, used by local `npm run cf:deploy`.
- See `docs/ci-cd.md` and `docs/deploy-cloudflare.md`.

**GitHub:** https://github.com/prasadxa/sahayak (public). CI (`ci.yml`) runs lint, tsc, test and the CF build on PRs and main. Production secrets are set; `deploy.yml` deploys Convex + the worker on every push to `main` with a smoke test and worker rollback.

**Google OAuth:** OAuth client "Sahayak" (Web application) in Google Cloud
project `gargifarms-a56b0`. Origins: `http://localhost:3000` and
`https://sahayak.rough-cell-383c.workers.dev`. Redirect URIs: the dev and prod
`*.convex.site/api/auth/callback/google` endpoints. Prod Google sign-in is
verified working (the admin account uses it).

**Built (all on `main`, deployed):**
- **Chat:** CallMissed LLMs with KB-first answers and a PMFBY premium tool, replying in the selected language and native script.
- **Voice:** STT/TTS with the selected language.
- **UI:** in 11 languages.
- **Knowledge base:** staff-only writes, SSRF guard, full-text fallback when embeddings fail, query log, and 8 curated entries in `data/kb` (`npm run seed:kb`).
- **Grievances:** filing with a timeline, officer console, and public `/track`.
- **Officer dashboard:** `/admin`, `/admin/grievances`, `/admin/users`.
- **Raspberry Pi kiosk:** `/kiosk` and `hardware/pi/`.
- **PWA and access:** PWA manifest and icons, and route protection in `middleware.ts`.

**Known gaps / next up:**
- The CallMissed `/v1/embeddings` endpoint was returning 502 on 2026-09-30, so all 49 seeded chunks are awaiting embedding. Search uses full-text until then. Run `npx convex run kb:backfillEmbeddingsInternal '{}'` when it recovers. `/v1/audio/transcriptions` (STT) also 502'd that evening — check STT health before the voice demo; the kiosk degrades gracefully ("didn't catch that" → retry).
- The kiosk has not yet been tested on real Pi hardware (GPIO button, printer, audio).
- Rate limiting is in place (`@convex-dev/rate-limiter`, `convex/ratelimits.ts`): per-user token buckets on chat (20/min), voice (20/min) and KB search (40/min); kiosk-role accounts get wider buckets. Convex tests must `register(t)` from `@convex-dev/rate-limiter/test` when a function under test consumes a bucket.
- ~~**Go-live steps**~~ Done (2026-09-30): deploy secrets set, prod OAuth configured, prod seeded, admin active.
- The kiosk QR needs `NEXT_PUBLIC_TRACK_BASE_URL` pointing at the public URL.
- Deferred: CallMissed missed-call/IVR and WhatsApp channels, and offline FAQs on the kiosk.

> Current state and handoff notes: `docs/HANDOFF.md`.
