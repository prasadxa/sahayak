import { describe, expect, it, vi } from "vitest";

import {
  KIOSK_IDLE_MS,
  extractAssistantText,
  findFiledGrievance,
  idleRemainingMs,
  initialKioskState,
  kioskReducer,
  stripMarkdown,
  type KioskState,
} from "./session";

const T0 = 1_000_000;

function idleAt(now = T0, lang = "hi"): KioskState {
  return kioskReducer(initialKioskState(now - 10, "s1"), {
    type: "SELECT_LANG",
    lang,
    now,
  });
}

describe("initialKioskState", () => {
  it("starts on the language screen", () => {
    expect(initialKioskState(T0, "s1")).toEqual({
      phase: "language",
      lang: null,
      sessionId: "s1",
      lastActivity: T0,
    });
  });
});

describe("kioskReducer: conversation flow", () => {
  it("SELECT_LANG moves language → idle and records the language", () => {
    const s = idleAt(T0, "mr");
    expect(s.phase).toBe("idle");
    expect(s.lang).toBe("mr");
    expect(s.lastActivity).toBe(T0);
  });

  it("runs idle → listening → thinking → speaking → idle", () => {
    let s = idleAt();
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 1 });
    expect(s.phase).toBe("listening");
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 2 });
    expect(s.phase).toBe("thinking");
    s = kioskReducer(s, { type: "TRANSCRIBED", now: T0 + 3 });
    expect(s.phase).toBe("thinking");
    expect(s.lastActivity).toBe(T0 + 3);
    s = kioskReducer(s, { type: "ANSWER_DONE", now: T0 + 4 });
    expect(s.phase).toBe("speaking");
    s = kioskReducer(s, { type: "SPEECH_DONE", now: T0 + 5 });
    expect(s.phase).toBe("idle");
    expect(s.lastActivity).toBe(T0 + 5);
  });

  it("ignores PTT_UP without a preceding PTT_DOWN", () => {
    const s = idleAt();
    const next = kioskReducer(s, { type: "PTT_UP", now: T0 + 50 });
    expect(next).toBe(s);
    expect(next.phase).toBe("idle");
    expect(next.lastActivity).toBe(T0);
  });

  it("ignores PTT on the language screen", () => {
    const s = initialKioskState(T0, "s1");
    expect(kioskReducer(s, { type: "PTT_DOWN", now: T0 + 1 })).toBe(s);
  });

  it("barges in: PTT_DOWN while speaking goes to listening", () => {
    let s = idleAt();
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 1 });
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 2 });
    s = kioskReducer(s, { type: "ANSWER_DONE", now: T0 + 3 });
    expect(s.phase).toBe("speaking");
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 4 });
    expect(s.phase).toBe("listening");
    expect(s.lastActivity).toBe(T0 + 4);
  });

  it("ignores PTT_DOWN while thinking", () => {
    let s = idleAt();
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 1 });
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 2 });
    expect(kioskReducer(s, { type: "PTT_DOWN", now: T0 + 3 })).toBe(s);
  });

  it("ignores ANSWER_DONE / SPEECH_DONE in the wrong phase", () => {
    const s = idleAt();
    expect(kioskReducer(s, { type: "ANSWER_DONE", now: T0 + 1 })).toBe(s);
    expect(kioskReducer(s, { type: "SPEECH_DONE", now: T0 + 1 })).toBe(s);
    expect(kioskReducer(s, { type: "TRANSCRIBED", now: T0 + 1 })).toBe(s);
  });

  it("ASK (topic tile) goes idle → thinking", () => {
    const s = kioskReducer(idleAt(), { type: "ASK", now: T0 + 1 });
    expect(s.phase).toBe("thinking");
  });

  it("CANCEL returns listening/thinking/speaking to idle", () => {
    let s = kioskReducer(idleAt(), { type: "PTT_DOWN", now: T0 + 1 });
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 2 });
    s = kioskReducer(s, { type: "CANCEL", now: T0 + 3 });
    expect(s.phase).toBe("idle");
    const idle = idleAt();
    expect(kioskReducer(idle, { type: "CANCEL", now: T0 + 1 })).toBe(idle);
  });

  it("REPLAY goes idle → speaking", () => {
    const s = kioskReducer(idleAt(), { type: "REPLAY", now: T0 + 1 });
    expect(s.phase).toBe("speaking");
  });

  it("TOUCH refreshes lastActivity outside the language screen", () => {
    const s = kioskReducer(idleAt(), { type: "TOUCH", now: T0 + 90_000 });
    expect(s.phase).toBe("idle");
    expect(s.lastActivity).toBe(T0 + 90_000);
    const lang = initialKioskState(T0, "s1");
    expect(kioskReducer(lang, { type: "TOUCH", now: T0 + 5 })).toBe(lang);
  });
});

describe("kioskReducer: idle reset (Review Focus #4)", () => {
  it("exports a 120 s idle timeout", () => {
    expect(KIOSK_IDLE_MS).toBe(120_000);
  });

  it("resets to the language screen with a new session at exactly 120 s idle", () => {
    const s = kioskReducer(idleAt(), {
      type: "TICK",
      now: T0 + 120_000,
      newSessionId: "s2",
    });
    expect(s).toEqual({
      phase: "language",
      lang: null,
      sessionId: "s2",
      lastActivity: T0 + 120_000,
    });
  });

  it("does not reset at 119 s idle", () => {
    const s = idleAt();
    const next = kioskReducer(s, {
      type: "TICK",
      now: T0 + 119_000,
      newSessionId: "s2",
    });
    expect(next).toBe(s);
  });

  it("does not reset while speaking, thinking or listening", () => {
    let s = kioskReducer(idleAt(), { type: "PTT_DOWN", now: T0 });
    const listening = s;
    expect(
      kioskReducer(listening, { type: "TICK", now: T0 + 600_000, newSessionId: "x" })
    ).toBe(listening);
    s = kioskReducer(s, { type: "PTT_UP", now: T0 });
    const thinking = s;
    expect(
      kioskReducer(thinking, { type: "TICK", now: T0 + 600_000, newSessionId: "x" })
    ).toBe(thinking);
    s = kioskReducer(s, { type: "ANSWER_DONE", now: T0 });
    const speaking = s;
    expect(speaking.phase).toBe("speaking");
    expect(
      kioskReducer(speaking, { type: "TICK", now: T0 + 600_000, newSessionId: "x" })
    ).toBe(speaking);
  });

  it("does not reset (or churn the session) on the language screen", () => {
    const s = initialKioskState(T0, "s1");
    expect(
      kioskReducer(s, { type: "TICK", now: T0 + 600_000, newSessionId: "s2" })
    ).toBe(s);
  });

  it("counts idle time from the last accepted event", () => {
    let s = idleAt();
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 100_000 });
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 101_000 });
    s = kioskReducer(s, { type: "ANSWER_DONE", now: T0 + 105_000 });
    s = kioskReducer(s, { type: "SPEECH_DONE", now: T0 + 110_000 });
    const early = kioskReducer(s, {
      type: "TICK",
      now: T0 + 110_000 + 119_999,
      newSessionId: "s2",
    });
    expect(early.phase).toBe("idle");
    const late = kioskReducer(s, {
      type: "TICK",
      now: T0 + 110_000 + 120_000,
      newSessionId: "s2",
    });
    expect(late.phase).toBe("language");
    expect(late.sessionId).toBe("s2");
  });

  it("RESET always returns to the language screen with the new session", () => {
    const states: KioskState[] = [initialKioskState(T0, "s1"), idleAt()];
    let s = kioskReducer(idleAt(), { type: "PTT_DOWN", now: T0 + 1 });
    states.push(s);
    s = kioskReducer(s, { type: "PTT_UP", now: T0 + 2 });
    states.push(s);
    s = kioskReducer(s, { type: "ANSWER_DONE", now: T0 + 3 });
    states.push(s);
    for (const st of states) {
      expect(
        kioskReducer(st, { type: "RESET", now: T0 + 9, newSessionId: "fresh" })
      ).toEqual({
        phase: "language",
        lang: null,
        sessionId: "fresh",
        lastActivity: T0 + 9,
      });
    }
  });
});

describe("idleRemainingMs", () => {
  it("counts down only while idle", () => {
    const s = idleAt();
    expect(idleRemainingMs(s, T0 + 110_000)).toBe(10_000);
    expect(idleRemainingMs(s, T0 + 130_000)).toBe(0);
    expect(idleRemainingMs(initialKioskState(T0, "s"), T0 + 1)).toBeNull();
    const listening = kioskReducer(s, { type: "PTT_DOWN", now: T0 });
    expect(idleRemainingMs(listening, T0 + 1)).toBeNull();
  });
});

describe("stripMarkdown", () => {
  it("removes formatting so TTS doesn't read symbols", () => {
    const md =
      "## Steps\n\n1. **Visit** the PACS office\n- Bring `Aadhaar`\n* See [PMFBY](https://pmfby.gov.in)\n> Note: _free_";
    expect(stripMarkdown(md)).toBe(
      "Steps\n\n1. Visit the PACS office\nBring Aadhaar\nSee PMFBY\nNote: free"
    );
  });

  it("drops code blocks, tables pipes and images", () => {
    expect(stripMarkdown("Hi\n```js\nx=1\n```\n![alt](a.png) | a | b |")).toBe(
      "Hi\n\na b"
    );
  });
});

describe("message helpers", () => {
  const messages = [
    { id: "u1", role: "user", content: "hello", parts: [{ type: "text", text: "hello" }] },
    {
      id: "a1",
      role: "assistant",
      content: "",
      parts: [
        { type: "step-start" },
        {
          type: "tool-invocation",
          toolInvocation: {
            toolName: "fileGrievance",
            toolCallId: "c1",
            state: "result",
            args: {},
            result: { filed: true, refId: "GRV-AB12CD34", message: "ok" },
          },
        },
        { type: "text", text: "Your complaint is **filed**." },
      ],
    },
  ];

  it("extracts the text parts of an assistant message", () => {
    expect(extractAssistantText(messages[1] as never)).toBe(
      "Your complaint is **filed**."
    );
  });

  it("finds the latest filed grievance", () => {
    expect(findFiledGrievance(messages as never)).toEqual({
      refId: "GRV-AB12CD34",
      toolCallId: "c1",
    });
  });

  it("ignores unfiled or pending grievance calls", () => {
    const pending = [
      {
        id: "a1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              toolName: "fileGrievance",
              toolCallId: "c1",
              state: "call",
              args: {},
            },
          },
          {
            type: "tool-invocation",
            toolInvocation: {
              toolName: "fileGrievance",
              toolCallId: "c2",
              state: "result",
              args: {},
              result: "Error: not signed in",
            },
          },
        ],
      },
    ];
    expect(findFiledGrievance(pending as never)).toBeNull();
  });
});

describe("kiosk strings", async () => {
  const { KIOSK_STRINGS, kioskT } = await import("./strings");
  const { TTS_LANGUAGES } = await import("@/lib/languages");

  it("covers every TTS language with every key filled", () => {
    const keys = Object.keys(KIOSK_STRINGS.en) as (keyof typeof KIOSK_STRINGS.en)[];
    for (const code of TTS_LANGUAGES) {
      const dict = KIOSK_STRINGS[code];
      expect(dict, code).toBeDefined();
      for (const key of keys) {
        const value = dict[key];
        if (key === "topics") {
          expect(dict.topics).toHaveLength(4);
          for (const t of dict.topics) {
            expect(t.label.length, `${code}.topics.label`).toBeGreaterThan(0);
            expect(t.prompt.length, `${code}.topics.prompt`).toBeGreaterThan(0);
          }
        } else {
          expect(String(value).length, `${code}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("falls back to English for unknown or missing languages", () => {
    expect(kioskT("hi", "newPerson")).toBe("नया व्यक्ति");
    expect(kioskT("xx", "newPerson")).toBe("New person");
    expect(kioskT(null, "printReceipt")).toBe("Print receipt");
  });
});

describe("trackUrlFor", async () => {
  const { trackUrlFor } = await import("./session");

  it("uses the page origin when it is already public", () => {
    expect(trackUrlFor("GRV-AB12CD34", "https://sahayak.example.in")).toBe(
      "https://sahayak.example.in/track?ref=GRV-AB12CD34"
    );
  });

  it("prefers a public base over localhost on the Pi", () => {
    expect(
      trackUrlFor("GRV-1", "http://localhost:3000", {
        siteUrl: "https://sahayak.example.in/",
      })
    ).toBe("https://sahayak.example.in/track?ref=GRV-1");
    expect(
      trackUrlFor("GRV-1", "http://localhost:3000", {
        trackBase: "https://t.example.in",
        siteUrl: "https://sahayak.example.in",
      })
    ).toBe("https://t.example.in/track?ref=GRV-1");
  });

  it("falls back to the origin when only loopback URLs are configured", () => {
    expect(
      trackUrlFor("GRV-1", "http://localhost:3000", { siteUrl: "http://localhost:3000" })
    ).toBe("http://localhost:3000/track?ref=GRV-1");
  });
});

describe("safety timeouts", async () => {
  const { KIOSK_LISTENING_TIMEOUT_MS, KIOSK_MAX_RECORDING_MS, safetyTimeoutMs } =
    await import("./session");

  it("exports a 35 s listening timeout", () => {
    expect(KIOSK_LISTENING_TIMEOUT_MS).toBe(35_000);
  });

  it("never cuts off a full-length recording (the 30 s cap fires first)", () => {
    expect(KIOSK_LISTENING_TIMEOUT_MS).toBeGreaterThan(KIOSK_MAX_RECORDING_MS);
  });

  it("arms a timeout for listening, thinking and speaking only", () => {
    expect(safetyTimeoutMs("listening")).toBe(KIOSK_LISTENING_TIMEOUT_MS);
    expect(safetyTimeoutMs("thinking")).toBe(90_000);
    expect(safetyTimeoutMs("speaking")).toBe(180_000);
    expect(safetyTimeoutMs("idle")).toBeNull();
    expect(safetyTimeoutMs("language")).toBeNull();
  });

  it("CANCEL from a stuck listening phase returns to idle", () => {
    let s = idleAt();
    s = kioskReducer(s, { type: "PTT_DOWN", now: T0 + 1 });
    s = kioskReducer(s, { type: "CANCEL", now: T0 + 1 + KIOSK_LISTENING_TIMEOUT_MS });
    expect(s.phase).toBe("idle");
  });
});

describe("purging the previous citizen's chat", async () => {
  const { chatToPurge, isChatNotFound, purgeSessionChat } = await import("./session");

  it("purges the ended session only if a message was sent in it", () => {
    const prev = idleAt();
    const next = kioskReducer(prev, { type: "RESET", now: T0 + 1, newSessionId: "s2" });
    expect(chatToPurge(prev, next, "s1")).toBe("s1");
    expect(chatToPurge(prev, next, null)).toBeNull();
    expect(chatToPurge(prev, next, "older-session")).toBeNull();
  });

  it("purges on the idle reset too, and never when the session is unchanged", () => {
    const prev = idleAt();
    const next = kioskReducer(prev, {
      type: "TICK",
      now: T0 + KIOSK_IDLE_MS,
      newSessionId: "s2",
    });
    expect(next.sessionId).toBe("s2");
    expect(chatToPurge(prev, next, "s1")).toBe("s1");
    const same = kioskReducer(prev, { type: "PTT_DOWN", now: T0 + 1 });
    expect(chatToPurge(prev, same, "s1")).toBeNull();
  });

  it("recognises Convex 'Chat not found' errors", () => {
    expect(isChatNotFound(new Error("[CONVEX M(chats:deleteChatById)] Chat not found"))).toBe(
      true
    );
    expect(isChatNotFound(new Error("Forbidden"))).toBe(false);
    expect(isChatNotFound("Chat not found")).toBe(true);
    expect(isChatNotFound(undefined)).toBe(false);
  });

  it("deletes the chat once when it exists", async () => {
    const del = vi.fn().mockResolvedValue(null);
    await purgeSessionChat("s1", del, { retryMs: 0 });
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("s1");
  });

  it("swallows 'Chat not found' and retries once (the chat may still be being created)", async () => {
    const del = vi
      .fn()
      .mockRejectedValueOnce(new Error("Chat not found"))
      .mockRejectedValueOnce(new Error("Chat not found"));
    await expect(purgeSessionChat("s1", del, { retryMs: 0 })).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(2);
  });

  it("reports other errors without throwing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const del = vi.fn().mockRejectedValue(new Error("Forbidden"));
    await expect(purgeSessionChat("s1", del, { retryMs: 0 })).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
