# Sahayak: SIH demo script (PS 26088, Hardware)

The whole demo runs in **about 6 minutes**. It uses two presenters: **P1** at
the Raspberry Pi kiosk and **P2** on a laptop and phone.

## Before judging (checklist)

- [ ] The Pi is booted and the kiosk shows the language screen. The TALK button LED lights when you press it.
- [ ] The kiosk account is signed in (role `kiosk`).
- [ ] The laptop is signed in as an **officer/admin** at `/admin`.
- [ ] The phone has the Sahayak PWA installed (Chrome → "Install app").
- [ ] The KB is seeded (`/knowledge` shows 8+ entries).
- [ ] Demo data is seeded: `npm run seed:demo -- --prod`. `/admin` then shows about 24 grievances (some overdue) and 30 days of questions in 6 languages, including unanswered ones. Safe to re-run; `npm run seed:demo -- --prod --clear` removes only the demo rows afterwards.
- [ ] `GET /api/health` on the deployed URL returns `{"ok":true,"convex":"ok",…}` with status 200. A 503 means the app can't reach Convex.
- [ ] The receipt printer has paper (optional).
- [ ] You've done one warm-up question at the kiosk, so the first real answer isn't a cold start.

## 0. The problem (30 s, P2)

> "India has 8 lakh+ cooperatives and crores of members. Many farmers never
> learn their rights, the schemes they qualify for, or how to complain,
> because the information is in English legal text and scattered across
> portals. Sahayak is a help desk that speaks their language, on their phone
> or at a kiosk in the PACS office."

## 1. Multilingual on a phone (60 s, P2)

1. Open the PWA and switch the language to **हिन्दी**. The greeting, suggestions and input placeholder change.
2. Tap the mic and say:
   **"PMFBY में रबी फसल के लिए 50,000 रुपये की बीमा राशि पर कितना प्रीमियम लगेगा?"**
   ("How much premium for a rabi crop with ₹50,000 sum insured under PMFBY?")
3. Point out:
   - the **PMFBY calculator card**: 1.5%, so **₹750**. That's deterministic, not a guess.
   - the **knowledge-base source** it cites.
   - the answer in Devanagari.
4. Tap **Read aloud**. The answer is spoken in Hindi.

## 2. The hardware: PACS kiosk (2 min, P1)

1. At the kiosk, tap **मराठी**. It speaks a welcome.
2. **Hold the physical TALK button** and say:
   **"मला PACS चा सदस्य व्हायचं आहे, काय करावं लागेल?"**
   ("I want to become a PACS member. What do I need to do?")
   Release the button. It shows listening, then thinking, then speaks the answer aloud.
3. Tap **हिन्दी** (change language), hold TALK and say:
   **"मेरा फसल ऋण तीन महीने से मंजूर नहीं हुआ, मुझे शिकायत दर्ज करनी है।"**
   ("My crop loan hasn't been sanctioned for 3 months. I want to file a complaint.")
   Answer its follow-up questions: name, phone number, district and society name.
4. The **receipt** appears with a `GRV-XXXXXXXX` reference and a QR code, and prints on the thermal printer.
5. Walk away. After 2 minutes the kiosk resets to the language screen, so the next farmer doesn't see your conversation.

## 3. Tracking (45 s, P2 + a judge)

1. The judge scans the receipt QR code with their own phone. `/track?ref=GRV-…` opens with **no login** and shows the status *Submitted*.

## 4. Governance dashboard (90 s, P2)

1. On the laptop, open **/admin/grievances**, open the new grievance, set it to **In review** and add the note
   "Forwarded to the District Registrar, Pune".
2. The judge's phone **updates live** with the new timeline entry.
3. Open **/admin**:
   - questions by **language** and by **category**
   - **Unanswered questions**: "these are the gaps in cooperative awareness. NCCT can add content here, and every PACS kiosk gets smarter."
4. Open **/knowledge** and show how an officer adds a PDF or URL, such as a new scheme circular, in one click.

## 5. Close (30 s)

- **Cost:** the kiosk is about ₹12–15k in parts (see `hardware/pi/README.md`), and the cloud runs on free-tier Indic models.
- **Scale:** one backend serves every PACS kiosk, phone and laptop.
- **Next:** missed-call/IVR and WhatsApp access for feature phones (CallMissed), offline FAQs on the kiosk, and state-registrar integration.

## Fallbacks if something fails live

| Symptom | Say / do |
| --- | --- |
| Embeddings API down | Nothing visible. Search falls back to full-text automatically |
| Kiosk mic not picking up | Use a topic tile (preset question) instead of speaking |
| No Wi-Fi at the venue | Tether the Pi and laptop to a phone hotspot (the backend is in the cloud) |
| Printer jam | The QR code on screen is the receipt, so scan it directly |
