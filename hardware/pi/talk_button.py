#!/usr/bin/env python3
"""Sahayak kiosk TALK button daemon (Raspberry Pi 4).

A momentary push button on GPIO17 (to GND, internal pull-up) becomes a
virtual keyboard key F8 via /dev/uinput, so Chromium's /kiosk page sees a
normal keydown/keyup and treats it as push-to-talk. The button LED on
GPIO27 is lit while the button is held.

    press   -> F8 down, SYN, LED on
    release -> F8 up,   SYN, LED off

Usage:
    talk_button.py            # run as a daemon (systemd: sahayak-button.service)
    talk_button.py --test     # print every event too; runs without uinput if needed

Needs: python3-gpiozero (lgpio backend on Bookworm), python3-evdev, and
write access to /dev/uinput (setup.sh loads the module and adds a udev rule).
"""

from __future__ import annotations

import argparse
import signal
import sys
import threading
import time

BUTTON_PIN = 17  # physical pin 11
LED_PIN = 27  # physical pin 13
DEVICE_NAME = "sahayak-talk-button"


def log(msg: str) -> None:
    print(f"[talk_button] {msg}", flush=True)


def open_uinput(test: bool):
    """Create the virtual keyboard, or explain clearly why we can't."""
    try:
        from evdev import UInput, ecodes
    except ImportError:
        log("ERROR: python evdev is not installed. Run: sudo apt install python3-evdev")
        if test:
            log("--test: continuing without key output")
            return None, None
        sys.exit(1)

    try:
        ui = UInput({ecodes.EV_KEY: [ecodes.KEY_F8]}, name=DEVICE_NAME)
    except (PermissionError, OSError) as exc:
        log(f"ERROR: cannot open /dev/uinput ({exc}).")
        log("  Fix: sudo modprobe uinput")
        log("       and make sure /etc/udev/rules.d/99-sahayak-uinput.rules grants your user access")
        log("       (re-run hardware/pi/setup.sh, then log out and back in or reboot).")
        if test:
            log("--test: continuing without key output")
            return None, None
        sys.exit(1)

    # Give the compositor (labwc/libinput) a moment to pick up the new device.
    time.sleep(0.5)
    return ui, ecodes


def main() -> int:
    parser = argparse.ArgumentParser(description="GPIO TALK button -> F8 key (uinput)")
    parser.add_argument("--test", action="store_true", help="print button/key events")
    parser.add_argument("--pin", type=int, default=BUTTON_PIN, help="button BCM pin (default 17)")
    parser.add_argument("--led-pin", type=int, default=LED_PIN, help="LED BCM pin (default 27)")
    args = parser.parse_args()

    try:
        from gpiozero import LED, Button
    except ImportError:
        log("ERROR: gpiozero is not installed. Run: sudo apt install python3-gpiozero python3-lgpio")
        return 1

    ui, ecodes = open_uinput(args.test)

    try:
        button = Button(args.pin, pull_up=True, bounce_time=0.03)
        led = LED(args.led_pin)
    except Exception as exc:  # noqa: BLE001 - surface any GPIO backend error
        log(f"ERROR: cannot open GPIO{args.pin}/GPIO{args.led_pin}: {exc}")
        if ui:
            ui.close()
        return 1

    lock = threading.Lock()
    held = {"down": False}
    stop = threading.Event()

    def emit(value: int) -> None:
        if ui is None:
            return
        ui.write(ecodes.EV_KEY, ecodes.KEY_F8, value)
        ui.syn()

    def on_press() -> None:
        with lock:
            if held["down"]:
                return
            held["down"] = True
            emit(1)
            led.on()
        if args.test:
            log("pressed  -> KEY_F8 down, LED on")

    def on_release() -> None:
        with lock:
            if not held["down"]:
                return
            held["down"] = False
            emit(0)
            led.off()
        if args.test:
            log("released -> KEY_F8 up, LED off")

    def on_signal(signum, _frame) -> None:
        log(f"signal {signum}, shutting down")
        stop.set()

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    button.when_pressed = on_press
    button.when_released = on_release

    # Short blink so the operator can see the daemon is alive.
    led.blink(on_time=0.15, off_time=0.15, n=3, background=True)
    log(
        f"ready: GPIO{args.pin} -> F8 via {'uinput ' + DEVICE_NAME if ui else '(no uinput)'}, "
        f"LED on GPIO{args.led_pin}"
    )

    try:
        stop.wait()
    finally:
        # Never leave F8 stuck down (Chromium would keep recording).
        on_release()
        button.close()
        led.off()
        led.close()
        if ui:
            ui.close()
        log("stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
