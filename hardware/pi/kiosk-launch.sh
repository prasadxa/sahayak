#!/usr/bin/env bash
# Launch Chromium in kiosk mode on the Sahayak kiosk page and keep it running.
# Started by the labwc autostart entry (~/.config/labwc/autostart).
#
#   KIOSK_URL   page to open (default http://localhost:3000/kiosk; localhost is a
#               secure context, so the microphone works without HTTPS)
#   KIOSK_WAIT  seconds to wait for the URL before launching anyway (default 180)
set -euo pipefail

KIOSK_WAIT="${KIOSK_WAIT:-180}"
PROFILE_DIR="${KIOSK_PROFILE_DIR:-$HOME/.config/sahayak-chromium}"

# Precedence: KIOSK_URL env var > KIOSK_URL= line in ~/sahayak.env > localhost.
if [[ -z "${KIOSK_URL:-}" && -f "$HOME/sahayak.env" ]]; then
  KIOSK_URL="$(grep -E '^KIOSK_URL=' "$HOME/sahayak.env" | tail -n1 | cut -d= -f2- | tr -d "\"'" || true)"
fi
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/kiosk}"

# Maintenance switch: `touch ~/sahayak-no-kiosk` (e.g. over SSH) to get the desktop back.
if [[ -e "$HOME/sahayak-no-kiosk" ]]; then
  echo "[kiosk-launch] ~/sahayak-no-kiosk exists; not starting the kiosk"
  exit 0
fi

CHROMIUM=""
for c in chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then CHROMIUM="$c"; break; fi
done
if [[ -z "$CHROMIUM" ]]; then
  echo "[kiosk-launch] chromium not found; run hardware/pi/setup.sh" >&2
  exit 1
fi

echo "[kiosk-launch] waiting for $KIOSK_URL (up to ${KIOSK_WAIT}s)"
for ((i = 0; i < KIOSK_WAIT; i += 2)); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$KIOSK_URL" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    echo "[kiosk-launch] $KIOSK_URL answered $code"
    break
  fi
  sleep 2
done

mkdir -p "$PROFILE_DIR"

# If Chromium crashed last time, clear the "restore pages?" state.
PREFS="$PROFILE_DIR/Default/Preferences"
if [[ -f "$PREFS" ]]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREFS" || true
fi

while true; do
  echo "[kiosk-launch] starting $CHROMIUM"
  "$CHROMIUM" \
    --user-data-dir="$PROFILE_DIR" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required \
    --kiosk-printing \
    --use-fake-ui-for-media-stream \
    --check-for-update-interval=31536000 \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --no-first-run \
    --password-store=basic \
    --ozone-platform=wayland \
    "$KIOSK_URL" || true
  [[ -e "$HOME/sahayak-no-kiosk" ]] && exit 0
  echo "[kiosk-launch] chromium exited; relaunching in 3s"
  sleep 3
done
