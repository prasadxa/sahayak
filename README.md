<h1 align="center">Sahayak — Cooperative Governance & Legal Assistance Chatbot</h1>

<p align="center">
  A multilingual AI assistant for cooperative members, farmers and rural
  stakeholders — cooperative laws, Ministry of Cooperation schemes, PMFBY crop
  insurance, financial literacy and grievance redressal, in 22 Indian languages.
</p>

<p align="center">
  Built on <a href="https://github.com/murabcd/openchat">openchat</a> (open-source Next.js + Convex + AI SDK chatbot)
  · Powered by <a href="https://callmissed.com">CallMissed</a> APIs
</p>

## Features

- **Multilingual chat** — UI language selector for 22 Indian languages; the
  assistant answers in the user's language (saaras / bulbul Indic models).
- **Voice input** — microphone in the composer records speech, uploads to
  Convex storage, transcribed by CallMissed STT (`saaras:v3`, auto-detects
  code-mixed speech).
- **Voice output** — speaker button on any reply speaks it back via CallMissed
  TTS (`bulbul:v3`).
- **Knowledge base (shared RAG)** — curated corpus of cooperative laws,
  schemes and procedures stored in Convex with vector search
  (`text-embedding-3-small`, 1536 dims). Manage it at `/knowledge` — paste
  text, fetch a URL, or upload PDF/text files. The `searchKnowledgeBase` tool
  grounds answers in this corpus.
- **Personal memory** — per-user vector memory (`memories` table) remembers
  user context like district, society name, crops.
- **Grievance redressal** — the `fileGrievance` tool files complaints into
  Convex with a reference ID; users track them at `/grievances`.
- **Web search** — optional live web search via CallMissed `POST /v1/search`.
- **Documents/blocks** — draft grievance letters, applications and documents
  in the side-by-side editor.
- **Auth** — email/password (Convex Auth Password provider) + optional Google
  OAuth.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15, React 19, Tailwind, Radix/shadcn |
| Backend | Convex — database, file storage, vector search, actions |
| AI | CallMissed OpenAI-compatible API (`api.callmissed.com/v1`) for chat completions, embeddings, STT, TTS and web search |
| Streaming | AI SDK `useChat` + `streamText` via `app/(chat)/api/chat` |

## Environment

Copy `.env.example` → `.env.local`. Required:

- `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL` — from `npx convex dev`
- `ADMIN_EMAILS` (Convex env) — comma-separated emails that get the admin role
- `CALLMISSED_API_KEY` — a `cm_` key with `llm`, `stt`, `tts`, `search` permissions.
  **Set it twice**: in `.env.local` (Next.js route handlers) AND via
  `npx convex env set CALLMISSED_API_KEY cm_...` (Convex actions — knowledge
  ingestion, voice STT/TTS read it from Convex env).
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for dev
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — optional (email/password works without)
- `REDIS_URL` — optional (enables resumable streams)

Model ids are env-overridable (`CALLMISSED_MODEL_*`, `CALLMISSED_TTS_VOICE`) —
defaults are free-tier CallMissed models: `sarvam-105b-conversations`,
`sarvam-105b`, `kimi-k2.6`, `glm-4.7-flash`, `text-embedding-3-small`,
`saaras:v3`, `bulbul:v3`.

## SIH 2026: PS 26088 (Hardware)

| Expected feature | Where |
| --- | --- |
| Multilingual conversational interface | Language selector (23 languages); UI localised in 11; replies in native script |
| Cooperative laws and by-laws | KB-grounded answers (`data/kb/`, `/knowledge`) |
| Ministry of Cooperation schemes | KB corpus plus live web search |
| PMFBY and agricultural support | KB plus the `calculatePmfbyPremium` tool |
| Financial literacy | KB corpus (KCC, interest, fraud safety) |
| Grievance redressal | `fileGrievance` tool, `/grievances`, public `/track`, officer console `/admin/grievances` |
| Voice for rural users | Mic input (saaras STT), read-aloud (bulbul TTS), hands-free kiosk |
| Mobile and web | Responsive, installable PWA |
| **Hardware** | Raspberry Pi 4 kiosk with a physical TALK button and receipt printer (`/kiosk`, `hardware/pi/`) |

See `docs/sih-demo-script.md` for the judge demo and `docs/architecture.md`
for the file structure and data schema.

## Running locally

```bash
npm install
npx convex dev --once                 # push schema/functions (first run creates the project)
npx convex env set ADMIN_EMAILS you@example.com
npm run seed:kb                       # load the curated knowledge base
npm run dev                           # Next.js + Convex watcher
npm test                              # Vitest + convex-test
```

The app runs on [localhost:3000](http://localhost:3000/). Sign up with the
email in `ADMIN_EMAILS` to get the officer dashboard at `/admin`, and assign
`officer` or `kiosk` roles at `/admin/users`.

## Raspberry Pi kiosk

See `hardware/pi/README.md` for the parts list (about ₹12–15k), wiring (TALK
button on GPIO17, LED on GPIO27), and one-shot setup (`hardware/pi/setup.sh`).
The Pi runs `next start` locally and opens Chromium in kiosk mode on `/kiosk`,
signed in with a `kiosk`-role account.

## Project layout

See `docs/architecture.md`.
