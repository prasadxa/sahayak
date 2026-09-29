#!/usr/bin/env bash
# One-shot, idempotent provisioning for the Sahayak kiosk on a Raspberry Pi 4
# (Raspberry Pi OS Bookworm 64-bit, Wayland/labwc desktop).
#
# Run as the normal desktop user (NOT root); sudo is used where needed:
#
#   REPO_URL=https://github.com/<you>/sahayak.git bash setup.sh
#
# Environment:
#   REPO_URL      git URL of this repo (required unless ~/sahayak already exists)
#   REPO_BRANCH   branch to check out (default: the remote's default branch)
#   REPO_DIR      checkout location (default ~/sahayak)
#   ENV_FILE      env file with the app's secrets (default ~/sahayak.env)
#   SKIP_BUILD=1  skip `npm ci && npm run build`
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/CHANGE-ME/sahayak.git}"
REPO_BRANCH="${REPO_BRANCH:-}"
REPO_DIR="${REPO_DIR:-$HOME/sahayak}"
ENV_FILE="${ENV_FILE:-$HOME/sahayak.env}"
KIOSK_USER="$(id -un)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m[error] %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -ne 0 ]] || die "Run as your normal user (e.g. pi), not root. sudo is used where needed."
command -v sudo >/dev/null || die "sudo is required"

# ---------------------------------------------------------------- packages
say "Installing system packages"
sudo apt-get update -y

CHROMIUM_PKG=chromium
if ! apt-cache policy chromium 2>/dev/null | grep -q 'Candidate: [0-9]'; then
  CHROMIUM_PKG=chromium-browser
fi
echo "Chromium package: $CHROMIUM_PKG"

sudo apt-get install -y \
  "$CHROMIUM_PKG" git curl ca-certificates \
  python3-gpiozero python3-lgpio python3-evdev \
  cups cups-client \
  pipewire pipewire-pulse wireplumber alsa-utils \
  fonts-noto-core fonts-noto-ui-core

# Optional printer driver package (Epson ESC/P-R). Thermal 58 mm printers
# usually need their vendor CUPS filter instead; see README "Printer".
sudo apt-get install -y printer-driver-escpr || warn "printer-driver-escpr not installed (optional)"

# ------------------------------------------------------------------ Node 20
NODE_MAJOR=0
if command -v node >/dev/null; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
fi
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  say "Installing Node.js 20 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "node $(node -v), npm $(npm -v)"
NODE_BIN="$(command -v node)"

# ------------------------------------------------------------------ the app
if [[ -d "$REPO_DIR/.git" ]]; then
  say "Updating $REPO_DIR"
  git -C "$REPO_DIR" fetch --prune origin
  if [[ -n "$REPO_BRANCH" ]]; then
    git -C "$REPO_DIR" checkout "$REPO_BRANCH"
  fi
  git -C "$REPO_DIR" pull --ff-only || warn "git pull failed (local changes?); building what is checked out"
else
  [[ "$REPO_URL" != *CHANGE-ME* ]] || die "Set REPO_URL to your fork, e.g. REPO_URL=https://github.com/<you>/sahayak.git bash setup.sh"
  say "Cloning $REPO_URL into $REPO_DIR"
  if [[ -n "$REPO_BRANCH" ]]; then
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$REPO_DIR"
  else
    git clone "$REPO_URL" "$REPO_DIR"
  fi
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<'ENVEOF'
# Sahayak kiosk environment. Fill in, then re-run hardware/pi/setup.sh.
# Same values as the developer's .env.local (never commit this file).
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
CALLMISSED_API_KEY=
# Where this Next.js server is reached from the kiosk browser.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Public HTTPS deployment that serves /track, used for the receipt QR code
# (a phone can't open http://localhost). Leave empty to use the page origin.
NEXT_PUBLIC_TRACK_BASE_URL=
# Page Chromium opens. Use a hosted https://…/kiosk to skip running Next.js here.
KIOSK_URL=http://localhost:3000/kiosk
ENVEOF
  chmod 600 "$ENV_FILE"
  die "Created $ENV_FILE. Fill it in and run this script again."
fi
chmod 600 "$ENV_FILE"
install -m 600 "$ENV_FILE" "$REPO_DIR/.env.local"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  say "Installing dependencies and building (takes ~10 min on a Pi 4)"
  (
    cd "$REPO_DIR"
    export NODE_OPTIONS="--max-old-space-size=4096" NEXT_TELEMETRY_DISABLED=1
    npm ci
    npm run build
  )
fi

# ---------------------------------------------------------- uinput + GPIO
say "Enabling /dev/uinput for the TALK button"
echo uinput | sudo tee /etc/modules-load.d/uinput.conf >/dev/null
sudo modprobe uinput || warn "modprobe uinput failed; it will load on next boot"
sudo tee /etc/udev/rules.d/99-sahayak-uinput.rules >/dev/null <<'RULE'
# Sahayak kiosk: let the "input" group create virtual keyboards (TALK button -> F8).
KERNEL=="uinput", SUBSYSTEM=="misc", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"
RULE
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=misc --action=change || true
for g in input gpio; do
  if getent group "$g" >/dev/null && ! id -nG "$KIOSK_USER" | tr ' ' '\n' | grep -qx "$g"; then
    sudo usermod -aG "$g" "$KIOSK_USER"
    echo "Added $KIOSK_USER to group $g (takes effect after re-login/reboot)"
  fi
done
sudo usermod -aG lpadmin "$KIOSK_USER" || true

# ------------------------------------------------------------ systemd units
say "Installing systemd units"
render() {
  sed -e "s#@USER@#$KIOSK_USER#g" \
      -e "s#@HOME@#$HOME#g" \
      -e "s#@REPO_DIR@#$REPO_DIR#g" \
      -e "s#@NODE@#$NODE_BIN#g" "$1"
}
UNIT_SRC="$REPO_DIR/hardware/pi/systemd"
[[ -d "$UNIT_SRC" ]] || UNIT_SRC="$SCRIPT_DIR/systemd"
for unit in sahayak-web.service sahayak-button.service; do
  render "$UNIT_SRC/$unit" | sudo tee "/etc/systemd/system/$unit" >/dev/null
done
sudo systemctl daemon-reload
if grep -Eq '^KIOSK_URL=https?://(localhost|127\.0\.0\.1)' "$ENV_FILE" || ! grep -q '^KIOSK_URL=' "$ENV_FILE"; then
  sudo systemctl enable --now sahayak-web.service
  sudo systemctl restart sahayak-web.service
else
  echo "KIOSK_URL points at a hosted deployment; not starting the local web server."
  sudo systemctl disable --now sahayak-web.service 2>/dev/null || true
fi
sudo systemctl enable sahayak-button.service
sudo systemctl restart sahayak-button.service || warn "button service failed to start (check: journalctl -u sahayak-button)"

# ------------------------------------------------------- screen + autostart
say "Disabling screen blanking"
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || warn "raspi-config do_blanking failed"
else
  warn "raspi-config not found; disable screen blanking manually"
fi

say "Installing the labwc autostart entry"
chmod +x "$REPO_DIR/hardware/pi/kiosk-launch.sh" "$REPO_DIR/hardware/pi/talk_button.py"
AUTOSTART="$HOME/.config/labwc/autostart"
mkdir -p "$(dirname "$AUTOSTART")"
if [[ ! -f "$AUTOSTART" && -f /etc/xdg/labwc/autostart ]]; then
  # A user autostart replaces the system one; keep the stock entries (panel etc.).
  cp /etc/xdg/labwc/autostart "$AUTOSTART"
fi
touch "$AUTOSTART"
ENTRY="$(sed -e "s#@REPO_DIR@#$REPO_DIR#g" "$REPO_DIR/hardware/pi/labwc-autostart" | grep -v '^#')"
if ! grep -qF "kiosk-launch.sh" "$AUTOSTART"; then
  printf '\n# Sahayak kiosk\n%s\n' "$ENTRY" >>"$AUTOSTART"
fi

# ------------------------------------------------------------------- done
cat <<EOF

$(printf '\033[1;32m')Sahayak kiosk installed.$(printf '\033[0m')

Next steps:
  1. Reboot:                     sudo reboot
  2. On first boot the kiosk opens $(grep -E '^KIOSK_URL=' "$ENV_FILE" | cut -d= -f2- || echo http://localhost:3000/kiosk)
     and redirects to /login. Sign in with the KIOSK account (see README 3.4
     "Accounts"); the session cookie persists in ~/.config/sahayak-chromium.
  3. Test the button:            sudo systemctl stop sahayak-button && python3 $REPO_DIR/hardware/pi/talk_button.py --test
                                 (then: sudo systemctl start sahayak-button)
  4. Pick the speaker/mic:       wpctl status ; wpctl set-default <id>
  5. Optional printer:           http://localhost:631 -> add the USB printer, set it as default
  Logs: journalctl -u sahayak-web -u sahayak-button -f ; /tmp/sahayak-kiosk.log
  Maintenance: touch ~/sahayak-no-kiosk && pkill -f kiosk-launch.sh ; pkill chromium
EOF
