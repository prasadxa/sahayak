# Sahayak Kiosk: Raspberry Pi 4 hardware prototype

A touchscreen voice kiosk for a PACS office or gram panchayat. A citizen taps
their language, **holds the big TALK button**, asks a question aloud and hears
the answer spoken back. They can file a grievance by voice and leave with a
QR code or printed receipt (`GRV-…`) that they can track on any phone at `/track`.

```
 ┌──────────────── Raspberry Pi 4 (8 GB) ────────────────┐
 │ Chromium --kiosk → http://localhost:3000/kiosk        │   Convex cloud
 │ next start (sahayak-web.service)  ────────────────────┼──► (DB, auth, STT/TTS actions)
 │ talk_button.py: GPIO17 → uinput F8, LED GPIO27        │   CallMissed API
 │ CUPS → USB 58 mm thermal printer (optional)           │   (LLM, saaras STT, bulbul TTS)
 └───────────────────────────────────────────────────────┘
   7" touchscreen · USB mic · powered speaker · arcade button
```

The kiosk reuses the normal app. `/kiosk` is a large-touch, voice-first page on
top of the same `/api/chat`, signed in once with a **kiosk-role account**.

---

## 1. Bill of materials

Prices are approximate Indian retail prices (Robu.in / Amazon.in, 2026).

| # | Part | Notes | Approx. ₹ |
| --- | --- | --- | ---: |
| 1 | Raspberry Pi 4 Model B, 8 GB | 4 GB also works | 7,500 |
| 2 | Official Raspberry Pi 27 W USB-C power supply | 5.1 V / 5 A; also runs the Pi 4 fine | 1,100 |
| 3 | 32 GB microSD, A2 class (e.g. SanDisk Extreme) | A2 = faster app start | 600 |
| 4 | 7" HDMI capacitive touchscreen, 1024×600 | or the official 7" DSI display, 800×480 (≈ ₹6,000) | 4,500 |
| 5 | USB conference microphone (omni) | a basic USB mic (≈ ₹600) also works | 1,500 |
| 6 | 3 W powered speaker, USB power + 3.5 mm | or HDMI audio through the screen | 600 |
| 7 | 60 mm arcade push button with LED | pick the **5 V LED** version (see wiring) | 250 |
| 8 | Jumper wires (F-F) + 220 Ω resistor | + heat-shrink | 100 |
| | **Core kiosk total** | | **≈ 16,150** |
| 9 | *Optional:* 58 mm USB thermal receipt printer | ESC/POS, CUPS driver available | 2,800 |
| 10 | *Optional:* case / kiosk stand | acrylic or plywood podium | 1,500 |
| 11 | *Optional:* 4G USB dongle | for offices without broadband | 1,800 |
| | **Total with all options** | | **≈ 22,250** |

For comparison, a commercial information kiosk costs ₹60,000 to ₹1,50,000.

---

## 2. Wiring

The Pi uses 3.3 V logic. The button reads on **GPIO17** with the internal
pull-up (pressed = LOW) and the LED is driven from **GPIO27**.

```
   Raspberry Pi 4 GPIO header (partial; pin 1 is nearest the SD-card end)

        odd pins            even pins
     3V3   (1) ●  ● (2)   5V
   GPIO2   (3) ●  ● (4)   5V
   GPIO3   (5) ●  ● (6)   GND
   GPIO4   (7) ●  ● (8)   GPIO14
     GND   (9) ●  ● (10)  GPIO15
  GPIO17  (11) ●  ● (12)  GPIO18
  GPIO27  (13) ●  ● (14)  GND

   TALK BUTTON (momentary, normally open)

     pin 11 (GPIO17) ────────── COM ─┐
                                      ╧ press
     pin 9  (GND)    ────────── NO  ─┘

   BUTTON LED

     pin 13 (GPIO27) ──[ 220 Ω ]──► LED + (anode)
     pin 14 (GND)    ──────────────  LED − (cathode)

   GPIO17 idles HIGH (internal pull-up); pressing shorts it to GND → F8 down.
```

| Signal | BCM | Physical pin | Goes to |
| --- | --- | --- | --- |
| Button | GPIO17 | 11 | switch COM |
| Button ground | GND | 9 | switch NO |
| LED drive | GPIO27 | 13 | 220 Ω → LED + |
| LED ground | GND | 14 | LED − |

- Many 60 mm "12 V LED" buttons have a built-in resistor and stay dark at
  3.3 V. Buy the 5 V version, or bypass the internal resistor and use the 220 Ω.
  At about 6 mA it stays well within the GPIO limit.
- **No-solder alternative:** any USB device that types F8 or Space (a
  programmable one-key USB macro pad, or a keyboard-mode arcade encoder) works
  with no daemon at all. Joystick-mode "zero-delay" encoders do **not** work.

---

## 3. Setup

### 3.1 Flash and first boot
1. Use Raspberry Pi Imager to flash **Raspberry Pi OS (64-bit) Bookworm, with desktop**.
   In the Imager settings, set the hostname (`sahayak-kiosk`), the user (`pi`), Wi-Fi, locale `Asia/Kolkata` and **enable SSH**.
2. Connect the screen, mic, speaker and button, then boot. Make sure the desktop uses **Wayland (labwc)**: `raspi-config` → Advanced → Wayland → labwc.
3. Make sure the clock is right (`timedatectl`). Auth tokens fail with a wrong clock.

### 3.2 App secrets
Create `~/sahayak.env` on the Pi. The first `setup.sh` run creates a template
if the file is missing.

```ini
CONVEX_DEPLOYMENT=dev:whimsical-possum-664      # your deployment
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
CALLMISSED_API_KEY=cm_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TRACK_BASE_URL=https://<your-hosted-app>   # QR target; phones can't open localhost
KIOSK_URL=http://localhost:3000/kiosk
```

`setup.sh` copies this file to `~/sahayak/.env.local` and the web service reads
it as its `EnvironmentFile`. `NEXT_PUBLIC_*` values are baked in at build time,
so re-run `setup.sh` after you change them. Keep the file `chmod 600` and never commit it.

### 3.3 Provision
```bash
curl -fsSLO https://raw.githubusercontent.com/<you>/sahayak/main/hardware/pi/setup.sh
REPO_URL=https://github.com/<you>/sahayak.git bash setup.sh
# optional: REPO_BRANCH=feat/sih-prototype
sudo reboot
```

`setup.sh` is idempotent, so it is safe to re-run after `git pull`. It:
- installs Chromium (`chromium` or `chromium-browser`, detected), git, gpiozero + lgpio, evdev, CUPS, PipeWire tools and Noto fonts for all Indic scripts
- installs Node 20 from NodeSource if `node` is older than 20
- clones or updates `~/sahayak`, copies the env file, and runs `npm ci && npm run build` (about 10 min on a Pi 4)
- installs and enables `sahayak-web.service` (`next start -p 3000`) and `sahayak-button.service` (`talk_button.py`)
- loads `uinput` at boot (`/etc/modules-load.d/uinput.conf`), adds a udev rule giving the `input` group access to `/dev/uinput`, and adds the user to `input` and `gpio`
- turns off screen blanking (`raspi-config nonint do_blanking 1`)
- adds `kiosk-launch.sh` to `~/.config/labwc/autostart`

After a reboot, Chromium opens full-screen on the kiosk page.

### 3.4 Accounts: admin, officers and the kiosk

There are two kinds of sign-in, and the role decides which one an account needs:

| Role | How it signs in | Who sets the role |
| --- | --- | --- |
| `admin`, `officer` | **Google** (the email must be verified) | an admin at `/admin/users` |
| `kiosk` | **Password** (email + password at `/register`) | an admin at `/admin/users` |
| `member` (default) | either | nobody: every new account is a member |

`/admin/users` only promotes an account to officer or admin if it has signed in
with Google at least once. A Password sign-up has an unverified email that anyone
could have registered, so it can't become staff.

**First admin (bootstrap).** Either list the email in the Convex env
`ADMIN_EMAILS` (always admin), or have the person sign up once and then run,
from a machine with the Convex deploy credentials:

```bash
npx convex run roles:grantRole '{"email":"you@example.com","role":"admin"}'
```

`grantRole` is an internal function. It can't be called from the browser, and it
accepts a Password account too, which is handy for a local dev setup.

**The kiosk account.** Do this *before* signing in on the Pi:

1. On any machine, open `/register` and create a **Password** account, for example
   `kiosk-<pacs-name>@<domain>` with a strong password.
2. An admin opens **`/admin/users`** and sets that email's role to **`kiosk`**.
   From the CLI, `npx convex run roles:grantRole '{"email":"kiosk-…","role":"kiosk"}'` does the same.
3. On the Pi, Chromium opens `KIOSK_URL` and, because nobody is signed in, is
   redirected to `/login`. Attach a USB keyboard once and sign in with the kiosk
   account. Sign-in lands on `/`, and the app redirects every kiosk-role account
   from the chat pages to **`/kiosk`**, so the kiosk screen appears on its own and
   the normal chat UI (history, "My grievances") is never shown at the kiosk.
   If you land on the chat page instead, the role isn't `kiosk` yet: set it, then reload.

A kiosk-role account gets short 2–4 sentence spoken answers. Each citizen gets a
fresh conversation. When someone taps "New person", or after 120 s idle, the kiosk
returns to the language screen and **deletes the previous citizen's conversation**
from the server. Grievances are stored separately, so they stay and remain
trackable by their `GRV-…` reference.
A non-kiosk account still works on `/kiosk` but shows a "Demo mode" banner.

**Receipt QR code.** Set `NEXT_PUBLIC_TRACK_BASE_URL` in `~/sahayak.env` to the
public HTTPS address of the app (for example `https://sahayak.example.in`), then
re-run `setup.sh` so the value is built in. The receipt QR code then points at
`<that URL>/track?ref=GRV-…`. Without it (or a public `NEXT_PUBLIC_SITE_URL`), the QR
code falls back to the page origin, `http://localhost:3000`, which a citizen's phone
can't open.

### 3.5 Local server or hosted URL?

| | **Run Next.js on the Pi** (default) | **Point `KIOSK_URL` at a hosted HTTPS deployment** |
| --- | --- | --- |
| `KIOSK_URL` | `http://localhost:3000/kiosk` | `https://<your-app>/kiosk` |
| Microphone | Works: `localhost` counts as a **secure context** | Works: HTTPS is a secure context |
| Pi load | `next start` uses about 300 MB RAM | Chromium only |
| Updates | `git pull` + re-run `setup.sh` | Deploy once and every kiosk updates |
| Needs internet | Yes (Convex + CallMissed are cloud) | Yes |

**Never** use `http://<LAN-IP>:3000`. `getUserMedia` is blocked on insecure
origins, so the TALK button can't record. With a hosted URL, `setup.sh` leaves
the local web service disabled.

---

## 4. Printer (optional)

1. Plug in the 58 mm USB printer. Open `http://localhost:631` (CUPS) → *Administration* → *Add Printer*.
   Your user is in `lpadmin`, so sign in with your Pi password.
2. Driver: most 58 mm ESC/POS printers (ZJ-58, POS-58, Xprinter) need the vendor's CUPS filter
   (for example the open-source `zj-58` / `rastertozj` filter built for ARM). Choose media **58 mm × roll**.
   Epson inkjets are covered by `printer-driver-escpr`, which `setup.sh` installs.
3. Set it as the default printer: `lpoptions -d <printer-name>`. Test with `echo "Sahayak test" | lp`.
4. Chromium runs with `--kiosk-printing`, so **Print receipt** (`window.print()`) goes straight
   to the default printer with no dialog. The receipt's `@media print` stylesheet prints only the
   receipt, 58 mm wide, black on white, with the QR code.

With no printer, the QR code on screen works on its own.

---

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| TALK does nothing, "Microphone not available" | `arecord -l` should list the USB mic. `wpctl status` → `wpctl set-default <source-id>`. Check the page is on `localhost` or `https`, not a LAN IP. `--use-fake-ui-for-media-stream` auto-accepts the permission prompt. |
| No sound / wrong output | `wpctl status`, then `wpctl set-default <sink-id>` for the USB/3.5 mm speaker. Or `raspi-config` → System Options → Audio. HDMI screens often grab audio by default. `speaker-test -t wav -c 2` to test. |
| Answers show but aren't spoken | Autoplay: launch through `kiosk-launch.sh` (it passes `--autoplay-policy=no-user-gesture-required`). If you started Chromium by hand, tap the screen once. Also check the CallMissed key in the **Convex** env (TTS runs there). |
| Screen goes black after 10 min | `sudo raspi-config nonint do_blanking 1` and reboot. |
| Physical button ignored | `journalctl -u sahayak-button -f`. Run `sudo systemctl stop sahayak-button; python3 ~/sahayak/hardware/pi/talk_button.py --test` and press: you should see `pressed -> KEY_F8 down`. "cannot open /dev/uinput" means re-run `setup.sh` and reboot (group change). Check `grep -A4 sahayak-talk /proc/bus/input/devices`. |
| LED never lights | Probably a 12 V LED with a built-in resistor. See Wiring. |
| Kiosk shows "not signed in" | Plug in a keyboard and sign in with the kiosk account (3.4). |
| Kiosk shows the normal chat page after sign-in | The account's role isn't `kiosk`. An admin sets it at `/admin/users` (3.4), then reload. |
| "Officers must sign in with Google first" at `/admin/users` | Staff roles need a Google sign-in (verified email). Have the person sign in with Google once, then retry. |
| Phone can't open the receipt QR link | `NEXT_PUBLIC_TRACK_BASE_URL` is unset or points at localhost. Set it to the public URL and re-run `setup.sh` (3.4). |
| Build killed / out of memory | Add swap: `sudo dphys-swapfile swapoff; sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile; sudo dphys-swapfile setup; sudo dphys-swapfile swapon`. |
| Need the desktop back | Over SSH: `touch ~/sahayak-no-kiosk; pkill -f kiosk-launch.sh; pkill chromium`. Delete the file to restore the kiosk. |
| Logs | `journalctl -u sahayak-web -u sahayak-button -f`, `/tmp/sahayak-kiosk.log` |

---

## 6. Two-minute demo checklist (for judges)

**Before judges arrive (T–10 min)**
- [ ] Pi on, kiosk on the language screen, "Demo mode" banner **absent** (kiosk account signed in)
- [ ] Speaker volume audible across the table, mic within 50 cm
- [ ] Printer has paper (optional). A phone ready to scan the QR code
- [ ] Officer laptop open on `/admin/grievances`

**The run (≈ 2 min)**
1. **0:00** Tap **मराठी**. The kiosk speaks a welcome in Marathi.
2. **0:15** **Hold the physical TALK button** (the LED lights) and ask: *"PACS चा सदस्य कसा होऊ शकतो?"*
   Release. The screen shows listening (pulsing red), then thinking (spinner), then the Marathi answer
   streams in and is **spoken aloud** (waveform).
3. **0:45** Press TALK mid-answer to show **barge-in**, or tap **Replay answer**.
4. **1:00** Tap **File a complaint** (or say *"माझे कर्ज मंजूर होत नाही, तक्रार नोंदवायची आहे"*) and answer
   the follow-up questions. The **receipt** appears: `GRV-XXXXXXXX`, date/time and a QR code. Tap **Print receipt**.
5. **1:30** Scan the QR code with a phone. `/track?ref=GRV-…` shows status *submitted*.
   The officer moves it to *in review* with a remark, and the phone updates live.
6. **1:50** Tap **New person**. The kiosk clears everything and returns to the language screen.
   The same reset happens after 120 s idle, with a 15 s "Still there?" countdown.

**Talking points:** ₹16k bill of materials. Voice-first for non-literate users in 11 spoken languages.
Physical push-to-talk (no wake word, privacy-friendly). No chat history leaks between citizens: each conversation is deleted on reset.
The same backend serves phones through the PWA.
