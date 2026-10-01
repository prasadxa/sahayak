# Sahayak kiosk: hardware setup

The `/kiosk` page is the same app served on any device — what changes between
a phone, a laptop and the Raspberry Pi build is only **which microphone,
speaker and "talk button" the citizen uses**. This file covers both tracks:

- **Track A — demo devices (today, no extra hardware):** a laptop or phone
  uses its built-in mic, speaker and screen/touch.
- **Track B — the Pi kiosk (final form factor):** `hardware/pi/README.md`
  has the full bill of materials, GPIO wiring and provisioning steps.

## 1. Push-to-talk inputs (all devices)

`/kiosk` accepts three ways to hold-to-talk; at least one exists on every device:

| Device | Input |
| --- | --- |
| Raspberry Pi | Physical arcade button → GPIO17 → `talk_button.py` injects **F8** via uinput |
| Laptop (keyboard) | Hold **Space** or **F8** (`keydown`/`keyup`, repeat-guarded) |
| Laptop (pointer) | Press-and-hold the big on-screen TALK button with the mouse/trackpad |
| Phone / touchscreen | Press-and-hold the on-screen TALK button (`onPointerDown`/`Up`/`Cancel`) |

`pi/talk_button.py` only exists to turn a GPIO press into the same F8 event —
there is no Pi-specific logic in the web page.

## 2. Track A — run the kiosk on a laptop

No hardware to buy. Steps:

1. Open **Chrome** (or Edge) and go to
   `https://sahayak.rough-cell-383c.workers.dev/kiosk`.
2. Sign in with the kiosk account (`kiosk@sahayak.in`). The `kiosk` role
   auto-redirects back to `/kiosk` after login — if you land on the chat
   page instead, the role isn't set (fix at `/admin/users`).
3. Allow the **microphone permission** when prompted (once).
4. Use it: tap a language → the welcome line is spoken → **hold Space**
   (or press-and-hold the on-screen button) → speak → release → the answer
   streams and is read aloud through the laptop speakers.
5. For a kiosk-like feel: full-screen the window (`F11` / `^⌘F`), or launch
   Chrome with `--kiosk https://sahayak.rough-cell-383c.workers.dev/kiosk`.
6. Receipts: **Print receipt** uses the normal print dialog — any printer
   works, or print-to-PDF. The QR on screen/printout points at
   `/track?ref=GRV-…` on the hosted URL.

Notes:
- Must be the **HTTPS URL** (or `localhost` if running dev) — mic capture
  needs a secure context. Never `http://<LAN-IP>`.
- First audio may need one tap first (browser autoplay policy); tapping a
  language tile already counts as that gesture.
- If STT is degraded at CallMissed the kiosk shows a localized
  "didn't catch that" state — check `voice.transcribe` health before a demo.

## 3. Track A — run the kiosk on a phone

Same flow, touch input:

1. Open `https://sahayak.rough-cell-383c.workers.dev/kiosk` in Chrome
   (Android) or Safari (iOS). "Add to Home Screen" gives a full-screen
   PWA feel.
2. Sign in as the kiosk account; allow microphone permission.
3. Tap a language, then **press-and-hold the on-screen TALK button** and
   speak. Release to send. The answer is spoken through the phone speaker.
4. Grievance receipt shows the `GRV-…` ref and QR code. On a phone the QR
   can't be scanned by itself — note the ref or open
   `/track?ref=GRV-…` directly (the demo story for QR is the Pi receipt:
   the citizen scans the printed/projected code with their own phone).
5. Printing a receipt from a phone is impractical — the on-screen QR +
   ref text is the receipt.

## 4. Track B — the production kiosk (when hardware arrives)

Bill of materials, wiring diagram, flashing and provisioning:

→ **`hardware/pi/README.md`**

Quick version (full detail there):

- **Buy:** Pi 4 (8 GB) + official 27 W PSU + 32 GB A2 microSD +
  7" HDMI touchscreen + USB mic + 3 W powered speaker + 60 mm arcade
  button (**5 V LED version**) + jumpers/220 Ω resistor — ≈ ₹16k;
  +₹2.8k optional 58 mm thermal printer.
- **Wire (4 wires):** pin 11 (GPIO17)→button COM, pin 9 (GND)→button NO,
  pin 13 (GPIO27)→[220 Ω]→LED+, pin 14 (GND)→LED−.
- **Provision:** flash Pi OS 64-bit Bookworm (desktop, labwc) →
  `~/sahayak.env` with `KIOSK_URL=https://sahayak.rough-cell-383c.workers.dev/kiosk`
  and `NEXT_PUBLIC_TRACK_BASE_URL=<same host>` → run `setup.sh` → reboot.
  Pointing `KIOSK_URL` at the hosted deployment means the Pi only runs
  Chromium + the button daemon (no local `next start`).
- **Verify on the bench:** `journalctl -u sahayak-button -f` shows
  `pressed -> KEY_F8 down`, `arecord -l` lists the mic,
  `speaker-test -t wav -c 2` confirms the sink — then the live flow:
  hold button → LED on → speak → release → spoken answer.
- **No-solder alternative:** a USB macro pad or keyboard-mode arcade
  encoder that sends F8/Space works with no daemon at all.

The judge-facing 2-minute demo checklist lives in
`hardware/pi/README.md` §6.
