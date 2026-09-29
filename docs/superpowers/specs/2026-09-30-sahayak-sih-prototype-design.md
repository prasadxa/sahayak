# Sahayak: SIH 2026 prototype design (PS 26088)

**Problem statement:** 26088, *Multilingual Cooperative Governance & Legal
Assistance Chatbot*. It comes from the Ministry of Cooperation / NCCT, in the
**Hardware** category ("Software + Hardware" mode), under the theme
Agriculture, FoodTech & Rural Development.

## 1. What "Hardware category" means for us

SIH has Software and Hardware editions. A Hardware problem statement is judged
on a **working physical prototype**, meaning an integrated hardware and software
system. A web app alone does not qualify. Judges score novelty, technical
complexity, a working prototype, scalability, cost-effectiveness and impact.

Our hardware answer is the **Sahayak Kiosk**, a Raspberry Pi 4 (8 GB)
touchscreen voice kiosk for a PACS office or gram panchayat. A farmer with no
smartphone and no literacy can walk up, choose a language, hold a big physical
**TALK** button, ask a question aloud and hear the answer spoken back. They can
also file a grievance by voice and leave with a printed or QR receipt. Phones and
laptops use the same system through the installable web app (PWA).

## 2. Requirement to feature mapping

| PS 26088 expected feature | Sahayak feature | Status before this plan |
| --- | --- | --- |
| Multilingual conversational interface | 23-language selector; answers in the chosen language; localised UI | Selector done. **UI strings never translated** (the i18n dictionary is unused) |
| Guidance on cooperative laws and by-laws | KB-grounded answers (RAG) with a curated corpus (MSCS Act, Model Bye-laws for PACS) | RAG built. **KB empty**. Embeddings API returning 502 |
| Ministry of Cooperation schemes and services | KB corpus: PACS computerisation, grain storage, M-PACS, CSC/Jan Aushadhi via PACS | Same as above |
| PMFBY and agricultural support | KB corpus plus a **PMFBY premium calculator tool** | Not built |
| Financial literacy assistance | KB corpus: KCC, interest, savings, fraud safety | Not built |
| Grievance redressal support | Voice/chat filing, reference ID, **officer workflow**, **public tracking**, receipt | Filing only. Status stuck at `submitted` |
| Voice-enabled assistance for rural users | STT/TTS in chat plus a hands-free kiosk voice loop | STT works. **TTS ignores language** |
| Integration with mobile and web platforms | Responsive web, **installable PWA**, Pi kiosk | No PWA |
| NLP / AI chatbot framework | AI SDK tool-calling agent on CallMissed Indic LLMs | Done |
| STT and TTS | CallMissed `saaras:v3` / `bulbul:v3` | Partly done |
| Cloud computing | Convex cloud (DB, vector search, storage) plus hosted Next.js | Convex dev deployment done |
| Hardware | **Pi 4 kiosk**: touchscreen, USB mic, speaker, GPIO TALK button, optional thermal printer | Not built |

## 3. What we add beyond the brief (the differentiators)

1. **Officer dashboard for NCCT and registrar staff.** A grievance console with a
   status workflow and remarks, plus usage analytics: questions by category and
   language, and **unanswered questions**, meaning KB gaps to fill with new
   content. This turns the chatbot into a governance tool.
2. **Public grievance tracking** at `/track`. People without accounts (kiosk
   users) track a grievance by its reference ID, and the kiosk receipt carries a
   QR code to it.
3. **Resilient search.** When the embeddings API is down, search falls back to
   Convex full-text search, and a backfill action embeds chunks later. A demo
   can't be killed by one upstream outage.
4. **PMFBY premium calculator** (farmer share: 2% kharif, 1.5% rabi, 5% annual
   commercial/horticultural crops). It gives a deterministic answer, not an LLM
   guess.
5. **Roles**: `member`, `officer`, `admin`, `kiosk`. Only staff can edit the KB.
   A kiosk account can serve many walk-in citizens without showing earlier
   chats.

## 4. Architecture

```
 Phone / laptop browser (PWA)          Raspberry Pi 4 kiosk
   Next.js UI  /, /chat/:id,             Chromium --kiosk → http://localhost:3000/kiosk
   /grievances, /track, /admin           (Next.js runs ON the Pi: localhost = secure
          │                               context for the mic; autoplay allowed)
          │                               GPIO TALK button → uinput F8 key (python daemon)
          │                               USB thermal printer via CUPS + --kiosk-printing
          ▼                                          │
   Next.js route /api/chat (AI SDK streamText + tools) ◄──────┘
          │ tools: searchKnowledgeBase, fileGrievance, calculatePmfbyPremium,
          │        webSearch, memory, documents
          ▼
   Convex cloud: users(role) · chats · messages · kb_entries(vector + full-text)
                 kb_queries(analytics) · grievances(timeline) · voice(STT/TTS) · storage
          │
          ▼
   CallMissed API: chat LLMs · embeddings · saaras STT · bulbul TTS · web search
```

The kiosk reuses the normal app. It signs in once with a **kiosk-role
account**, and `/kiosk` is a large-touch, voice-first page on top of the same
`/api/chat`. No separate backend is needed.

## 5. Decisions

- **The kiosk runs Next.js locally on the Pi** (`next start`). `getUserMedia`
  needs a secure context, and `http://localhost` counts as one while a LAN IP
  does not. The Convex backend stays in the cloud. `KIOSK_URL` can point to a
  hosted HTTPS URL instead.
- **The TALK button is a keypress.** A GPIO daemon emits F8 through uinput, and
  the kiosk page treats F8 or Space held down as push-to-talk. A USB arcade
  encoder also works with zero code.
- **Receipts** use browser print, with a 58 mm print stylesheet and Chromium
  `--kiosk-printing` (silent print to the CUPS default printer). The printer is
  optional, since the QR code shows on screen either way.
- **Kiosk languages** are limited to the 11 TTS languages (en, hi, bn, ta, te,
  kn, ml, mr, gu, pa, or), so every answer can be spoken.
- **Admins** come from the Convex env var `ADMIN_EMAILS` (comma-separated).
  Admins assign `officer` and `kiosk` roles from `/admin`.
- **Out of scope** for this build (future phase): CallMissed missed-call/IVR and
  WhatsApp channels, and an offline LLM on the Pi.

## 6. Success criteria (demo script)

1. On a phone, open the PWA, install it, switch to हिन्दी, and see the UI
   (greeting, suggestions, placeholder) in Hindi.
2. Ask by voice "PMFBY में रबी फसल का प्रीमियम कितना है?". The answer
   cites the KB and uses the calculator, and "Read aloud" speaks it in Hindi.
3. At the Pi kiosk, tap मराठी, hold the physical TALK button and ask about PACS
   membership. The kiosk speaks the answer back automatically.
4. At the kiosk, say "I want to file a complaint about my loan not being
   sanctioned". The assistant collects the details and files it, and the
   screen shows the `GRV-…` reference, a QR code and a printed receipt.
5. Scan the QR code on a phone: `/track?ref=GRV-…` shows the status.
6. The officer opens `/admin`, moves the grievance to `in_review` with a remark,
   and the citizen's tracking page updates in real time.
7. `/admin` shows questions by language and category, plus unanswered questions.
