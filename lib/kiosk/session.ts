/**
 * Pure state machine for the Raspberry Pi kiosk (`/kiosk`).
 *
 *   language ──SELECT_LANG──► idle ──PTT_DOWN──► listening ──PTT_UP──► thinking
 *      ▲                       ▲ ▲                    ▲                    │
 *      │                       │ └──SPEECH_DONE── speaking ◄──ANSWER_DONE──┘
 *      │                       │                     │
 *      │                       └─────── PTT_DOWN (barge-in) → listening
 *      └── RESET (always) / TICK after KIOSK_IDLE_MS idle (only from idle)
 *
 * Every accepted event refreshes `lastActivity`. Ignored events return the
 * same state object, so React skips the re-render and callers can detect
 * acceptance with `next !== prev`.
 */

import type { UIMessage } from "ai";

/** After this long without activity the kiosk resets for the next citizen. */
export const KIOSK_IDLE_MS = 120_000;

/** A held TALK button stops recording after this long (the page's cap timer). */
export const KIOSK_MAX_RECORDING_MS = 30_000;
/**
 * Safety nets so a lost key-up, a mic that never opens or a hung network call
 * can never pin the kiosk mid-turn. Listening outlasts the 30 s recording cap,
 * so it only fires when getUserMedia never settles and the key-up is lost.
 */
export const KIOSK_LISTENING_TIMEOUT_MS = 35_000;
export const KIOSK_THINKING_TIMEOUT_MS = 90_000;
export const KIOSK_SPEAKING_TIMEOUT_MS = 180_000;

export type KioskPhase = "language" | "idle" | "listening" | "thinking" | "speaking";

export interface KioskState {
  phase: KioskPhase;
  lang: string | null;
  sessionId: string;
  lastActivity: number;
}

export type KioskEvent =
  | { type: "SELECT_LANG"; lang: string; now: number }
  | { type: "PTT_DOWN"; now: number }
  | { type: "PTT_UP"; now: number }
  | { type: "TRANSCRIBED"; now: number }
  | { type: "ANSWER_DONE"; now: number }
  | { type: "SPEECH_DONE"; now: number }
  | { type: "TICK"; now: number; newSessionId: string }
  | { type: "RESET"; now: number; newSessionId: string }
  /** A topic tile sent a preset question (no recording). */
  | { type: "ASK"; now: number }
  /** Abort the current turn: clip too short, empty transcript, network error. */
  | { type: "CANCEL"; now: number }
  /** Replay the last answer. */
  | { type: "REPLAY"; now: number }
  /** Any tap on the screen: "Still there? Tap anywhere". */
  | { type: "TOUCH"; now: number };

export function initialKioskState(now: number, sessionId: string): KioskState {
  return { phase: "language", lang: null, sessionId, lastActivity: now };
}

function go(state: KioskState, phase: KioskPhase, now: number): KioskState {
  return { ...state, phase, lastActivity: now };
}

export function kioskReducer(state: KioskState, event: KioskEvent): KioskState {
  const { phase } = state;
  switch (event.type) {
    case "SELECT_LANG":
      // From the language screen, or the change-language picker while idle.
      if (phase !== "language" && phase !== "idle") return state;
      return { ...state, phase: "idle", lang: event.lang, lastActivity: event.now };

    case "PTT_DOWN":
      // From speaking this is a barge-in: the caller stops playback.
      return phase === "idle" || phase === "speaking"
        ? go(state, "listening", event.now)
        : state;

    case "PTT_UP":
      return phase === "listening" ? go(state, "thinking", event.now) : state;

    case "TRANSCRIBED":
      return phase === "thinking" ? go(state, "thinking", event.now) : state;

    case "ANSWER_DONE":
      return phase === "thinking" ? go(state, "speaking", event.now) : state;

    case "SPEECH_DONE":
      return phase === "speaking" ? go(state, "idle", event.now) : state;

    case "ASK":
      return phase === "idle" || phase === "speaking"
        ? go(state, "thinking", event.now)
        : state;

    case "CANCEL":
      return phase === "listening" || phase === "thinking" || phase === "speaking"
        ? go(state, "idle", event.now)
        : state;

    case "REPLAY":
      return phase === "idle" ? go(state, "speaking", event.now) : state;

    case "TOUCH":
      return phase === "language" ? state : { ...state, lastActivity: event.now };

    case "TICK":
      // Never interrupt someone mid-turn; the language screen has nothing to clear.
      if (phase !== "idle") return state;
      if (event.now - state.lastActivity < KIOSK_IDLE_MS) return state;
      return initialKioskState(event.now, event.newSessionId);

    case "RESET":
      return initialKioskState(event.now, event.newSessionId);

    default:
      return state;
  }
}

/** Milliseconds until the idle reset, or null when no countdown applies. */
export function idleRemainingMs(state: KioskState, now: number): number | null {
  if (state.phase !== "idle") return null;
  return Math.max(0, KIOSK_IDLE_MS - (now - state.lastActivity));
}

/** How long a phase may last before the page forces it on, or null for none. */
export function safetyTimeoutMs(phase: KioskPhase): number | null {
  switch (phase) {
    case "listening":
      return KIOSK_LISTENING_TIMEOUT_MS;
    case "thinking":
      return KIOSK_THINKING_TIMEOUT_MS;
    case "speaking":
      return KIOSK_SPEAKING_TIMEOUT_MS;
    default:
      return null;
  }
}

/**
 * The chat to delete when a transition ends a session: the old session id,
 * but only if a message was sent in it (`lastSentSessionId`). The server
 * creates the chat under the session id on the first message.
 */
export function chatToPurge(
  prev: KioskState,
  next: KioskState,
  lastSentSessionId: string | null
): string | null {
  if (next.sessionId === prev.sessionId) return null;
  return lastSentSessionId === prev.sessionId ? prev.sessionId : null;
}

export function isChatNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Chat not found");
}

/** Wait before retrying a delete that raced the server creating the chat. */
export const KIOSK_PURGE_RETRY_MS = 15_000;

/**
 * Delete the previous citizen's chat. Never throws, so callers can fire and
 * forget. "Chat not found" usually means nothing was saved, but a reset
 * straight after the first question can beat the chat route's `saveChat`,
 * so it retries once after `retryMs`.
 */
export async function purgeSessionChat(
  chatId: string,
  deleteChat: (chatId: string) => Promise<unknown>,
  { retryMs = KIOSK_PURGE_RETRY_MS }: { retryMs?: number } = {}
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, retryMs));
    try {
      await deleteChat(chatId);
      return;
    } catch (error) {
      if (isChatNotFound(error)) continue;
      console.error("Kiosk: could not delete the previous chat", error);
      return;
    }
  }
}

/** Markdown → plain text for TTS and large-type display. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\|/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Concatenated text parts of a message (falls back to `content`). */
export function extractAssistantText(message: UIMessage): string {
  const parts = message.parts ?? [];
  const texts = parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text.trim())
    .filter(Boolean);
  if (texts.length) return texts.join("\n\n");
  return typeof message.content === "string" ? message.content : "";
}

/** The most recent successful `fileGrievance` tool result, if any. */
export function findFiledGrievance(
  messages: UIMessage[]
): { refId: string; toolCallId: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const parts = m.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j];
      if (p.type !== "tool-invocation") continue;
      const inv = p.toolInvocation;
      if (inv.toolName !== "fileGrievance" || inv.state !== "result") continue;
      const result = inv.result as { filed?: unknown; refId?: unknown } | null;
      if (
        result &&
        typeof result === "object" &&
        result.filed === true &&
        typeof result.refId === "string"
      ) {
        return { refId: result.refId, toolCallId: inv.toolCallId };
      }
    }
  }
  return null;
}

function isLoopback(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
  } catch {
    return true;
  }
}

/**
 * Public tracking URL for a receipt QR code. On the Pi the page is served
 * from http://localhost:3000, which a citizen's phone can't open, so prefer
 * a configured public base (NEXT_PUBLIC_TRACK_BASE_URL, then a non-loopback
 * NEXT_PUBLIC_SITE_URL) and only fall back to the page origin.
 */
export function trackUrlFor(
  refId: string,
  origin: string,
  bases: { trackBase?: string; siteUrl?: string } = {}
): string {
  const candidates = [bases.trackBase, bases.siteUrl].filter(
    (b): b is string => !!b && !isLoopback(b)
  );
  const base = isLoopback(origin) && candidates.length ? candidates[0] : bases.trackBase || origin;
  return `${base.replace(/\/+$/, "")}/track?ref=${encodeURIComponent(refId)}`;
}
