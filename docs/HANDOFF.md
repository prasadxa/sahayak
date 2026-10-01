# Sahayak: engineering handoff

*Handed over from Claude Code to Devin, 2026-09-30. Last commit: `d56b719`. 292 tests passing.*

Read this first, then `AGENTS.md` (conventions) and `docs/architecture.md`
(file tree, data schema, contracts). Everything below is the current state,
not a plan.

---

## 1. What this is

**Sahayak** is the SIH 2026 prototype for **PS 26088, Multilingual Cooperative
Governance & Legal Assistance Chatbot** (Ministry of Cooperation / NCCT). It is
in the **Hardware** category, so judges expect a working physical prototype
(a Raspberry Pi 4 kiosk) on top of the software.

It is a multilingual AI help desk for cooperative members and farmers covering:
- cooperative laws and by-laws
- Ministry of Cooperation schemes
- PMFBY crop insurance
- financial literacy
- grievance filing and tracking

It works by text or voice, on phones, laptops and a PACS-office kiosk.

- Design doc: `docs/superpowers/specs/2026-09-30-sahayak-sih-prototype-design.md`, which maps requirements to features.
- Judge demo: `docs/sih-demo-script.md`.

## 2. Where everything lives

| Thing | Where |
| --- | --- |
| Live site (production) | https://sahayak.rough-cell-383c.workers.dev |
| Health check | https://sahayak.rough-cell-383c.workers.dev/api/health (`{ok, convex, version}`) |
| GitHub repo (public) | https://github.com/prasadxa/sahayak, default branch `main`. The upstream fork is `murabcd/openchat` (remote `upstream`) |
| Convex **prod** | `valuable-platypus-774`, team `karan-rajput`, project `sahayak` |
| Convex **dev** | `whimsical-possum-664` (local `npx convex dev`; holds demo data and a dev test account) |
| Cloudflare | Account "Support@freetochat.app's Account" (`337c662fed500c2dff530141baaf75c9`). Worker `sahayak` = production (CI only). Worker `sahayak-dev` = local `npm run cf:deploy` (not created yet) |
| Google OAuth | Client "Sahayak" in GCP project `gargifarms-a56b0`. Redirect URIs for both Convex sites; JS origins localhost:3000 and the workers.dev URL |
| AI provider | CallMissed (`api.callmissed.com/v1`, OpenAI-compatible): chat, embeddings, `saaras:v3` STT, `bulbul:v3` TTS, web search |
| Admin | `prasaddhanade33@gmail.com`, via prod `ADMIN_EMAILS` (Google-verified) |

**Secrets are never in the repo.**
- Local: `.env.local` and `.dev.vars`, both git-ignored.
- Convex: `npx convex env list [--prod]`.
- GitHub: the `production` environment holds `CALLMISSED_API_KEY`, `CONVEX_DEPLOY_KEY`, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Cloudflare: the worker secret `CALLMISSED_API_KEY`, synced by CI.

## 3. Stack

- Next.js 15.3.8 (App Router) with React 19, Tailwind and shadcn/Radix.
- Convex 1.46 (DB, vector and full-text search, storage, crons) with `@convex-dev/auth` 0.0.80 (Password plus Google).
- Vercel AI SDK 4.3 (`streamText` plus tools) on CallMissed models.
- Hosting: Cloudflare Workers via `@opennextjs/cloudflare` ~1.15.1. It is pinned because Next is 15.3.8; the newer adapter needs Next ≥ 15.5.
- Tests: Vitest with `convex-test` (21 files, 292 tests).
- CI/CD: GitHub Actions on Node 22 (wrangler 4.144 requires Node ≥ 22).

## 4. Features (all built and tested)

- **Chat:**
  - Answers in the selected language (23 selectable; UI localised in 11) in native script.
  - Grounded in the KB via `searchKnowledgeBase`.
  - `calculatePmfbyPremium` is deterministic: kharif 2%, rabi 1.5%, commercial/horticulture 5%.
  - `fileGrievance` and optional web search.
  - Tool cards are rendered in `components/tool-ui.tsx`.
- **Voice:** mic input (60 s cap; the clip is deleted after STT) and read-aloud in 11 TTS languages. Audio is cleaned up by an hourly cron.
- **Knowledge base:** 8 curated docs in `data/kb/*.md` (`npm run seed:kb [-- --prod]`).
  - Staff-only writes and an SSRF URL guard.
  - When embeddings fail, chunks are stored unembedded and search falls back to Convex full-text.
  - A summary table (`kb_sources`) serves listings, and every search is logged to `kb_queries`.
- **Grievances:**
  - `GRV-XXXXXXXX` refs and a status timeline (`submitted`, `in_review`, `resolved`, `rejected`).
  - Public `/track?ref=` (no PII).
  - Officer console with SLA flags (15-day target), a district filter and CSV export (formula-injection-safe).
- **Officer dashboard (`/admin`):** grievance stats (overdue, average resolution, by district, status and category), questions by language and topic, and **unanswered questions** (the knowledge gaps, grouped with counts).
- **Roles:** `member | officer | admin | kiosk`.
  - `ADMIN_EMAILS` only applies to **verified** (Google) emails.
  - `setRole` gives staff roles only to verified accounts.
  - `npx convex run roles:grantRole '{"email":…,"role":…}'` is an operator bootstrap and is internal only.
- **Model & voice settings (`/admin/models`, admin only):** per-function provider/model overrides live in the `app_settings` table (`model:<function>` keys) and are resolved at call time — chat route via `api.settings.effectiveModel`, `voice.ts` via `internal.settings.modelFor`. The option lists are in `lib/model-catalog.ts`; the `CALLMISSED_MODEL_*` env vars remain the defaults, and a missing row means default. Embeddings stay fixed (1536-dim indexes).
- **Kiosk (`/kiosk`, Raspberry Pi 4):**
  - Language tiles, hold-to-talk (touch or F8/Space; a GPIO button sends F8) and auto-spoken answers.
  - A receipt with a QR code linking to `/track`, and a 58 mm print stylesheet.
  - A 120 s idle reset that deletes the previous citizen's chat. A cron also purges kiosk chats older than 1 hour.
  - Kiosk accounts get no chat history, no grievance list and no personal memory.
  - Hardware scripts are in `hardware/pi/` (setup.sh, Chromium kiosk launcher, `talk_button.py`, systemd units, BOM and wiring in the README).
- **PWA:** manifest and icons; installable on phones.
- **Demo data:** `npm run seed:demo [-- --prod] [-- --clear]` (internal `demo.seed`/`demo.clear`).
  - It adds 24 grievances (refs `GRV-DE00xxxx`) and 120 questions (createdAt ms = 123 marker).
  - `clear` removes only demo rows.
- **Security:**
  - Every chat, message, stream, document, suggestion and file function checks ownership (`convex/access.ts`).
  - Server code calling Convex passes `{ token }`.
  - KB search requires sign-in; transcribe accepts audio only; AI images are capped at 5 MB.

## 5. Commands

```bash
npm install
npm run dev                  # next dev --turbo + convex dev (dev deployment)
npm test                     # vitest (297 tests); convex-test for convex/*.test.ts
npx tsc --noEmit             # also: npx tsc --noEmit -p convex
npm run lint
npm run build                # plain Next build (shares .next with the dev server: stop dev first)
SKIP_ENV_VALIDATION=1 npm run cf:build   # Cloudflare Workers build (.open-next/)
npm run seed:kb [-- --prod]
npm run seed:demo [-- --prod] [-- --clear]
npx convex dev --once        # push functions/schema to dev
```

**Live-site rehearsal scripts** (NOT committed — they contain demo passwords): `~/sahayak-e2e/*.mjs` — `officer-update.mjs` (officer sets in_review → citizen /track live-updates), `ratelimit-429.mjs` (429 proof, no LLM cost), `kiosk-voice.mjs` (kiosk PTT→STT→answer with a fake-mic WAV; regenerate it with a CallMissed TTS call), plus login/register/grievance variants.

**Deploying production.** Push to `main`, or GitHub → Actions → Deploy → Run workflow. `deploy.yml` then does, in order:
1. lint, tsc and tests
2. a preflight check that the secrets exist (it skips with a warning if not)
3. the Workers build
4. a 3 MiB gzip size gate (currently about 2.93 MiB, very close to the limit)
5. `convex deploy` to prod
6. syncing the worker secret
7. `opennextjs-cloudflare deploy --env production`
8. a smoke test (`/login`, `/track`, `/manifest.webmanifest`, `/api/health`, and POST `/api/chat` → 401)
9. an automatic worker rollback if the smoke test fails

A Convex push is **not** rolled back. `ci.yml` runs on PRs and on pushes to `main`.

## 6. Gotchas learned the hard way

- **Never add `bun.lock`.** OpenNext picks its package manager from lockfiles, and a stale one made CI run `bun`.
- **`initOpenNextCloudflareForDev()` must stay dev-only** (`next.config.ts`). In `next build`, every build worker started workerd and the build failed with `SQLITE_BUSY`.
- **The Workers build uses webpack, not turbopack.** Turbopack chunks fail on Workers. There is also a `convex/browser` alias, because the node build bundles `ws`.
- **`cf:build` blanks `.open-next/cloudflare/next-env.mjs`.** Otherwise OpenNext ships `.env.local` values, including secrets, inside the worker.
- **The GitHub push trigger didn't fire** for the first pushes. Manual `workflow_dispatch` works. If a push doesn't deploy, run Deploy manually.
- **GitHub secrets must be in the `production` environment.** A stray environment named `CLOUDFLARE_ACCOUNT_ID` exists and can be deleted.
- **Convex query results are cached.** SLA queries take an optional `now` arg, and the admin pages pass an hourly clock (`components/admin/use-hourly-now.ts`).
- **Convex Auth doesn't link a Password sign-up to a Google account with the same email.** That's why admin requires `emailVerificationTime`.
- **`SITE_URL` in Convex env** is where Google OAuth returns: prod points at workers.dev, dev at localhost:3000.
- **Workers Free plan limit is 3 MiB gzipped.** Adding heavy client dependencies will push the worker over and fail the size gate.

## 7. Known issues and limitations

- **Embeddings:** the CallMissed `/v1/embeddings` endpoint returned **502** all of 2026-09-30, so every chunk (dev and prod, 49 each) is unembedded and search is keyword-only. When it recovers, run `npx convex run kb:backfillEmbeddingsInternal '{}'` for dev and add `--prod` for prod.
- **CallMissed STT also 502'd** briefly on 2026-09-30 evening: `voice.transcribe` reached CallMissed and got a 502. The kiosk handled it gracefully (Marathi "didn't catch that" prompt, ready to retry). Chat and TTS (`/audio/speech`) stayed up. If the demo needs STT, check `curl -X POST https://api.callmissed.com/v1/audio/transcriptions` first.
- **Hardware:** the kiosk has **not been tested on real Pi hardware** (GPIO button, thermal printer, mic and speaker). Push-to-talk with a real microphone is untested in automation.
- ~~**Production is empty**~~ Prod is seeded (24 demo grievances, 120 query rows) and has accounts: `kiosk@sahayak.in` (kiosk), `member@sahayak.in` (member), `officer@sahayak.in` (officer, granted via `grantRole` — a Password account; for a real officer prefer a Google sign-in + `/admin/users`). Passwords were communicated to the owner; rotate before the event if needed.
- **URL guard:** it is lexical only. DNS rebinding isn't covered; the risk is accepted because ingest is staff-only.
- ~~**Rate limits:** there are none on chat, TTS or search.~~ Done (2026-10-01): `@convex-dev/rate-limiter` token buckets per user — chat 20/min, voice (STT+TTS) 20/min, KB search 40/min; kiosk accounts get wider `*Kiosk` buckets (60/60/120) since one login serves a whole queue. Chat route → 429 + `Retry-After`; voice/kb actions throw a retry-after error. Config in `convex/ratelimits.ts`; tests register the component via `@convex-dev/rate-limiter/test`.
- **Scale:** some admin queries scan whole tables (fine at prototype scale), and `exportRows` could hit Convex read limits with many long descriptions.
- **Git history:** commit author emails are prasadxa's personal Gmail.
- **Licence:** there is no LICENSE file; upstream has none either.
- **Branding:** `package.json` version is still 0.5.0 from upstream.

## 8. Suggested next work (in priority order)

**Stopped here (2026-09-30).** Live = `main` `ea5a8de` + docs commits; all software arcs of the demo verified on prod (§7, §8.1). PRs merged: auth/theme fixes, district-stats ASCII fix, rate limiting, docs. Next session starts at **Pi bring-up** (item 2), then re-check CallMissed STT/embeddings and pre-event ops (rotate demo passwords; optional `seed:demo -- --prod --clear` + reseed for a clean slate).

1. ~~**Demo readiness**~~ Done (2026-09-30): prod seeded, accounts created, full demo rehearsed on the live site with Playwright — login → Hindi → PMFBY card ₹750 → grievance `GRV-…` → `/track` → officer console → officer sets *in review* → citizen `/track` updates live; kiosk account → `/kiosk` redirect + मराठी grid + welcome TTS + PTT→STT pipeline (STT itself was down at CallMissed — see §7). Prod bugs found and fixed: password sign-in never navigated (redirectTo is OAuth-only), `__name is not defined` crashed the inline theme script on every page, and a native-script district name crashed `grievanceStats` (`byDistrict` is now a list, not a Record). Remaining unrehearsed: physical mic/audio/printer on the Pi (task 3).
2. **Pi bring-up:**
   - Flash Raspberry Pi OS Bookworm and run `hardware/pi/setup.sh`.
   - Set `KIOSK_URL`/`NEXT_PUBLIC_TRACK_BASE_URL=https://sahayak.rough-cell-383c.workers.dev`.
   - Test the GPIO button, audio and printer, and fix whatever the hardware reveals.
3. **Embeddings:** backfill when CallMissed recovers. Consider a fallback embedding provider.
4. ~~**Rate limiting**~~ Done (2026-10-01) — see §7.
5. **Channels (optional):** CallMissed missed-call/IVR and a WhatsApp bot on the same KB and grievance tools, which strengthens "mobile integration" for feature phones. It costs credits; get the owner's approval.
6. **Offline kiosk fallback:** cached FAQ answers per language when the network is down.
7. **Upgrade** Next.js to 15.5+ and `@opennextjs/cloudflare` to latest, then recheck the bundle size.

## 9. Working rules for this repo

- Test-first. For Convex use `convex-test` (`convex/test.setup.ts`, `asUser()` in `convex/test.helpers.ts`).
- Categories, statuses and roles are defined once in `lib/constants.ts`.
- Any new public Convex function must check auth or ownership. Staff-only functions use `requireStaff` or `requireAdmin` from `convex/roles.ts`.
- Never log message content or PII in `app/(chat)/api/chat/route.ts`.
- Keep `docs/architecture.md` and the Status section of `AGENTS.md` up to date when contracts change.
- Before every push: `npm test && npx tsc --noEmit && npm run lint`.
