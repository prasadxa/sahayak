"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Gavel,
  Landmark,
  Languages,
  LoaderCircle,
  MessageSquareWarning,
  Mic,
  UserPlus,
  Wheat,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { KioskReceipt } from "@/components/kiosk/receipt";
import { LanguageGrid } from "@/components/kiosk/language-grid";
import { PhaseIndicator, Waveform } from "@/components/kiosk/phase-indicator";
import { useI18n } from "@/lib/i18n";
import {
  KIOSK_MAX_RECORDING_MS,
  chatToPurge,
  extractAssistantText,
  findFiledGrievance,
  idleRemainingMs,
  initialKioskState,
  kioskReducer,
  purgeSessionChat,
  safetyTimeoutMs,
  stripMarkdown,
  trackUrlFor,
  type KioskEvent,
  type KioskState,
} from "@/lib/kiosk/session";
import { kioskT } from "@/lib/kiosk/strings";
import { languageByCode } from "@/lib/languages";
import { cn, generateUUID } from "@/lib/utils";

const KIOSK_MODEL = "chat-model-small";
const MIN_CLIP_MS = 400;
const COUNTDOWN_MS = 15_000;
const SYNTH_TIMEOUT_MS = 20_000;

const TOPIC_ICONS = [Gavel, Landmark, Wheat, MessageSquareWarning] as const;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function messageText(m: UIMessage | undefined): string {
  return m ? stripMarkdown(extractAssistantText(m)) : "";
}

export default function KioskPage() {
  const me = useQuery(api.roles.me);

  if (me === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="size-12 animate-spin text-white/60" aria-label="Loading" />
      </div>
    );
  }

  if (me === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-4xl font-extrabold">
          Sahayak <span className="text-amber-300">· सहायक</span>
        </div>
        <p className="max-w-xl text-2xl">{kioskT("en", "notSignedIn")}</p>
        <p className="max-w-xl text-xl text-white/70">{kioskT("hi", "notSignedIn")}</p>
        <Link
          href="/login"
          className="rounded-2xl bg-amber-300 px-10 py-5 text-2xl font-bold text-black"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return <KioskApp isKioskAccount={me.role === "kiosk"} />;
}

const KioskApp = ({ isKioskAccount }: { isKioskAccount: boolean }) => {
  const { setLang } = useI18n();

  const [state, setState] = useState<KioskState>(() =>
    initialKioskState(Date.now(), generateUUID())
  );
  const stateRef = useRef(state);
  const [now, setNow] = useState(() => Date.now());
  const [pickingLang, setPickingLang] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ refId: string; filedAt: number } | null>(
    null
  );
  const [demoBannerOpen, setDemoBannerOpen] = useState(!isKioskAccount);

  const audioRef = useRef<HTMLAudioElement>(null);
  const speechRef = useRef<{ id: number; kind: "answer" | "welcome" }>({
    id: 0,
    kind: "welcome",
  });
  const lastAnswerRef = useRef<{ text: string; url?: string } | null>(null);
  const seenGrievancesRef = useRef(new Set<string>());

  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recTokenRef = useRef(0);
  const recStartRef = useRef(0);
  const recDurationRef = useRef(0);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pttHeldRef = useRef(false);
  /** Session id of the last question sent: that session has a server chat. */
  const lastSentSessionRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const generateUploadUrl = useMutation(api.files.generateAttachmentUrl);
  const transcribe = useAction(api.voice.transcribe);
  const synthesize = useAction(api.voice.synthesize);
  const deleteChat = useMutation(api.chats.deleteChatById);

  const { messages, setMessages, append, status, stop } = useChat({
    id: state.sessionId,
    body: { selectedChatModel: KIOSK_MODEL },
    sendExtraMessageFields: true,
    generateId: generateUUID,
    experimental_prepareRequestBody: (body) => ({
      id: body.id,
      message: body.messages.at(-1),
      selectedChatModel: KIOSK_MODEL,
      data: body.requestData,
    }),
    onError: () => {
      toast.error("Network problem, please try again");
    },
  });

  // Latest values for callbacks registered once (keyboard, timers, audio).
  const live = useRef({ messages, stop, setMessages, append });
  live.current = { messages, stop, setMessages, append };

  /** Send a question and remember that this session now has a chat to purge. */
  const appendQuestion = useCallback((content: string) => {
    lastSentSessionRef.current = stateRef.current.sessionId;
    void live.current.append({ role: "user", content });
  }, []);

  const lang = state.lang;

  // ---------------------------------------------------------------- audio

  const stopAudio = useCallback(() => {
    speechRef.current = { id: speechRef.current.id + 1, kind: "welcome" };
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
  }, []);

  // ------------------------------------------------------ state + effects

  /** Drop any recording in flight; a late recorder/mic result is ignored. */
  const abortRecording = useCallback(() => {
    recTokenRef.current++;
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    capTimerRef.current = null;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
    pttHeldRef.current = false;
  }, []);

  const endSession = useCallback(() => {
    stopAudio();
    abortRecording();
    live.current.stop();
    live.current.setMessages([]);
    lastAnswerRef.current = null;
    setReceipt(null);
    setPickingLang(false);
    setNotice(null);
  }, [abortRecording, stopAudio]);

  /** Run an event through the pure reducer; returns whether it was accepted. */
  const send = useCallback(
    (event: KioskEvent): boolean => {
      const prev = stateRef.current;
      const next = kioskReducer(prev, event);
      if (next === prev) return false;
      stateRef.current = next;
      setState(next);
      if (next.sessionId !== prev.sessionId) {
        // Fire and forget so the reset stays instant. Grievances are stored
        // separately and survive; only the conversation is removed.
        const purge = chatToPurge(prev, next, lastSentSessionRef.current);
        if (purge) {
          lastSentSessionRef.current = null;
          void purgeSessionChat(purge, (id) => deleteChat({ id }));
        }
        endSession();
      }
      return true;
    },
    [deleteChat, endSession]
  );

  const onSpeechEnd = useCallback(
    (id: number) => {
      if (speechRef.current.id !== id) return;
      if (speechRef.current.kind === "answer") send({ type: "SPEECH_DONE", now: Date.now() });
    },
    [send]
  );

  const playUrl = useCallback(
    (url: string, id: number) => {
      const audio = audioRef.current;
      if (!audio) return onSpeechEnd(id);
      audio.onended = () => onSpeechEnd(id);
      audio.onerror = () => onSpeechEnd(id);
      audio.src = url;
      audio.play().catch(() => {
        // Autoplay blocked or bad source: don't leave the kiosk "speaking".
        onSpeechEnd(id);
      });
    },
    [onSpeechEnd]
  );

  const speak = useCallback(
    async (text: string, kind: "answer" | "welcome") => {
      stopAudio();
      const id = speechRef.current.id + 1;
      speechRef.current = { id, kind };
      const language = stateRef.current.lang ?? "en";
      try {
        const { url } = await withTimeout(
          synthesize({ text: text.slice(0, 2500), language }),
          SYNTH_TIMEOUT_MS
        );
        if (speechRef.current.id !== id) return;
        if (!url) throw new Error("no audio");
        if (kind === "answer") lastAnswerRef.current = { text, url };
        playUrl(url, id);
      } catch {
        onSpeechEnd(id);
      }
    },
    [onSpeechEnd, playUrl, stopAudio, synthesize]
  );

  // ------------------------------------------------------------ recording

  const handleClip = useCallback(
    async (token: number, blob: Blob, mimeType: string, durationMs: number) => {
      if (token !== recTokenRef.current) return; // reset or superseded
      if (durationMs < MIN_CLIP_MS || blob.size === 0) {
        send({ type: "CANCEL", now: Date.now() });
        return;
      }
      const sessionId = stateRef.current.sessionId;
      const language = stateRef.current.lang ?? "en";
      try {
        const postUrl = await generateUploadUrl({ contentType: mimeType });
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        const { storageId } = await res.json();
        const { text } = await transcribe({
          storageId,
          language: language === "en" ? undefined : language,
        });
        if (token !== recTokenRef.current || stateRef.current.sessionId !== sessionId) return;
        const question = text?.trim();
        if (!question) {
          send({ type: "CANCEL", now: Date.now() });
          setNotice(kioskT(language, "didNotCatch"));
          return;
        }
        if (send({ type: "TRANSCRIBED", now: Date.now() })) appendQuestion(question);
      } catch {
        if (token !== recTokenRef.current) return;
        send({ type: "CANCEL", now: Date.now() });
        setNotice(kioskT(language, "didNotCatch"));
      }
    },
    [appendQuestion, generateUploadUrl, send, transcribe]
  );

  const stopRecording = useCallback(() => {
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    capTimerRef.current = null;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec || rec.state === "inactive") {
      // Released before the mic opened: treat as a too-short clip.
      recTokenRef.current++;
      send({ type: "CANCEL", now: Date.now() });
      return;
    }
    recDurationRef.current = performance.now() - recStartRef.current;
    rec.stop();
  }, [send]);

  const pttUp = useCallback(() => {
    if (!pttHeldRef.current) return;
    pttHeldRef.current = false;
    if (send({ type: "PTT_UP", now: Date.now() })) stopRecording();
  }, [send, stopRecording]);

  const startRecording = useCallback(async () => {
    const token = ++recTokenRef.current;
    try {
      let stream = micStreamRef.current;
      if (!stream || stream.getAudioTracks().every((t) => t.readyState === "ended")) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = stream;
      }
      // Button already released (or kiosk reset) while the mic was opening.
      if (token !== recTokenRef.current || stateRef.current.phase !== "listening") return;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const durationMs = recDurationRef.current;
        void handleClip(token, new Blob(chunks, { type: mimeType }), mimeType, durationMs);
      };
      recorderRef.current = recorder;
      recStartRef.current = performance.now();
      recorder.start();
      capTimerRef.current = setTimeout(() => pttUp(), KIOSK_MAX_RECORDING_MS);
    } catch {
      if (token !== recTokenRef.current) return;
      pttHeldRef.current = false;
      send({ type: "CANCEL", now: Date.now() });
      toast.error("Microphone not available");
    }
  }, [handleClip, pttUp, send]);

  const pttDown = useCallback(() => {
    if (pttHeldRef.current) return;
    if (!send({ type: "PTT_DOWN", now: Date.now() })) return;
    pttHeldRef.current = true;
    stopAudio(); // barge-in (also cuts the welcome message)
    setNotice(null);
    void startRecording();
  }, [send, startRecording, stopAudio]);

  // -------------------------------------------------------------- actions

  const ask = (prompt: string) => {
    if (!send({ type: "ASK", now: Date.now() })) return;
    stopAudio();
    setNotice(null);
    appendQuestion(prompt);
  };

  const chooseLanguage = (code: string) => {
    if (!send({ type: "SELECT_LANG", lang: code, now: Date.now() })) return;
    setLang(code);
    setPickingLang(false);
    void speak(kioskT(code, "welcome"), "welcome");
  };

  const replay = () => {
    const last = lastAnswerRef.current;
    if (!last || !send({ type: "REPLAY", now: Date.now() })) return;
    if (last.url) {
      stopAudio();
      const id = speechRef.current.id + 1;
      speechRef.current = { id, kind: "answer" };
      playUrl(last.url, id);
    } else {
      void speak(last.text, "answer");
    }
  };

  const newPerson = () => send({ type: "RESET", now: Date.now(), newSessionId: generateUUID() });

  // ------------------------------------------------------------- effects

  // Idle clock: 1 s TICK drives the 120 s reset and the countdown overlay.
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      send({ type: "TICK", now: n, newSessionId: generateUUID() });
    }, 1000);
    return () => clearInterval(t);
  }, [send]);

  // Hardware TALK button (GPIO → F8 via uinput) and Space: hold to talk.
  useEffect(() => {
    const isPtt = (e: KeyboardEvent) =>
      e.key === "F8" || e.code === "F8" || e.code === "Space" || e.key === " ";
    const onDown = (e: KeyboardEvent) => {
      if (!isPtt(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      send({ type: "TOUCH", now: Date.now() });
      pttDown();
    };
    const onUp = (e: KeyboardEvent) => {
      if (!isPtt(e)) return;
      e.preventDefault();
      pttUp();
    };
    const onBlur = () => pttUp();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [pttDown, pttUp, send]);

  // Answer finished streaming → speak it.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (stateRef.current.phase !== "thinking") return;
    if (status === "error") {
      send({ type: "CANCEL", now: Date.now() });
      return;
    }
    if (status !== "ready" || (prev !== "streaming" && prev !== "submitted")) return;
    const last = live.current.messages.at(-1);
    const text = last?.role === "assistant" ? messageText(last) : "";
    if (!text) {
      send({ type: "CANCEL", now: Date.now() });
      return;
    }
    if (send({ type: "ANSWER_DONE", now: Date.now() })) void speak(text, "answer");
  }, [status, send, speak]);

  // Safety nets for a mic that never opens with a lost key-up, a hung
  // request or a stalled audio element.
  useEffect(() => {
    const phase = state.phase;
    const ms = safetyTimeoutMs(phase);
    if (ms === null) return;
    const since = state.lastActivity;
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s.phase !== phase || s.lastActivity !== since) return;
      if (phase === "listening") {
        abortRecording();
        send({ type: "CANCEL", now: Date.now() });
      } else if (phase === "thinking") {
        live.current.stop();
        send({ type: "CANCEL", now: Date.now() });
        setNotice(kioskT(s.lang, "didNotCatch"));
      } else {
        stopAudio();
        send({ type: "SPEECH_DONE", now: Date.now() });
      }
    }, ms);
    return () => clearTimeout(t);
  }, [state.phase, state.lastActivity, abortRecording, send, stopAudio]);

  // A filed grievance → show the receipt (once per tool call).
  useEffect(() => {
    const found = findFiledGrievance(messages);
    if (!found || seenGrievancesRef.current.has(found.toolCallId)) return;
    seenGrievancesRef.current.add(found.toolCallId);
    setReceipt({ refId: found.refId, filedAt: Date.now() });
  }, [messages]);

  // Keep the newest words in view while streaming.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Release the microphone when leaving the page.
  useEffect(
    () => () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    },
    []
  );

  // --------------------------------------------------------------- render

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserIdx = lastUser ? messages.lastIndexOf(lastUser) : -1;
  const answer = messages
    .slice(lastUserIdx + 1)
    .reverse()
    .find((m) => m.role === "assistant");
  const questionText = lastUser
    ? stripMarkdown(extractAssistantText(lastUser) || lastUser.content)
    : "";
  const answerText = messageText(answer);

  const remaining = idleRemainingMs(state, now);
  const showCountdown = remaining !== null && remaining <= COUNTDOWN_MS;
  const trackUrl =
    receipt && typeof window !== "undefined"
      ? trackUrlFor(receipt.refId, window.location.origin, {
          trackBase: process.env.NEXT_PUBLIC_TRACK_BASE_URL,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        })
      : "";

  const busy = state.phase === "listening" || state.phase === "thinking";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerDown={() => send({ type: "TOUCH", now: Date.now() })}
      onContextMenu={(e) => e.preventDefault()}
    >
      <audio ref={audioRef} preload="auto" className="hidden" />

      {demoBannerOpen && (
        <div className="flex items-center justify-between gap-3 bg-amber-300 px-4 py-1.5 text-base font-semibold text-black">
          <span>Demo mode (not a kiosk account)</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-md p-1"
            onClick={() => setDemoBannerOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      {state.phase === "language" ? (
        <LanguageScreen onPick={chooseLanguage} />
      ) : (
        <>
          <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2">
            <div className="mr-auto min-w-0 truncate text-[clamp(20px,4vh,32px)] font-extrabold">
              Sahayak
              {kioskT(lang, "appName") !== "Sahayak" && (
                <span className="text-amber-300"> · {kioskT(lang, "appName")}</span>
              )}
            </div>
            <TopButton
              icon={<Volume2 className="size-6" />}
              label={kioskT(lang, "replay")}
              disabled={state.phase !== "idle" || !lastAnswerRef.current}
              onClick={replay}
            />
            <TopButton
              icon={<Languages className="size-6" />}
              label={lang ? languageByCode(lang).native : kioskT(lang, "changeLanguage")}
              ariaLabel={kioskT(lang, "changeLanguage")}
              disabled={state.phase !== "idle"}
              onClick={() => setPickingLang(true)}
            />
            <TopButton
              icon={<UserPlus className="size-6" />}
              label={kioskT(lang, "newPerson")}
              onClick={newPerson}
              strong
            />
          </header>

          <main className="flex min-h-0 flex-1 gap-4 px-4 py-3">
            <section
              ref={transcriptRef}
              className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white/[0.04] p-4"
              aria-live="polite"
            >
              {questionText ? (
                <>
                  <div className="text-[clamp(14px,2.4vh,18px)] font-semibold uppercase tracking-wide text-white/50">
                    {kioskT(lang, "you")}
                  </div>
                  <p className="mb-4 text-[clamp(20px,3.8vh,32px)] font-semibold text-amber-200">
                    {questionText}
                  </p>
                  <div className="flex items-center gap-2 text-[clamp(14px,2.4vh,18px)] font-semibold uppercase tracking-wide text-white/50">
                    {kioskT(lang, "assistant")}
                    {state.phase === "speaking" && <Waveform className="h-4 text-sky-300" />}
                  </div>
                  {answerText ? (
                    <p className="whitespace-pre-line text-[clamp(20px,3.8vh,32px)]">
                      {answerText}
                    </p>
                  ) : state.phase === "thinking" ? (
                    <LoaderCircle className="mt-2 size-10 animate-spin text-amber-300" />
                  ) : null}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/60">
                  <Mic className="size-14" aria-hidden />
                  <p className="text-[clamp(20px,4vh,34px)]">{kioskT(lang, "idleHint")}</p>
                </div>
              )}
              {notice && (
                <p className="mt-4 rounded-xl bg-amber-300/15 p-3 text-[clamp(18px,3.2vh,26px)] text-amber-200">
                  {notice}
                </p>
              )}
            </section>

            <section className="flex w-[min(46vh,34vw)] shrink-0 flex-col items-center justify-center gap-4">
              <TalkButton
                phase={state.phase}
                label={
                  state.phase === "listening"
                    ? kioskT(lang, "listening")
                    : state.phase === "thinking"
                      ? kioskT(lang, "thinking")
                      : kioskT(lang, "holdToTalk")
                }
                onDown={pttDown}
                onUp={pttUp}
              />
              <div className="text-center text-[clamp(16px,2.8vh,22px)]">
                <PhaseIndicator phase={state.phase} lang={lang} />
              </div>
            </section>
          </main>

          <nav className="grid shrink-0 grid-cols-4 gap-3 px-4 pb-3">
            {kioskT(lang, "topics").map((topic, i) => {
              const Icon = TOPIC_ICONS[i];
              return (
                <button
                  key={topic.label}
                  type="button"
                  disabled={busy}
                  onClick={() => ask(topic.prompt)}
                  className="flex min-h-[clamp(56px,13vh,96px)] items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/[0.06] px-2 text-center text-[clamp(15px,2.9vh,24px)] font-bold leading-tight active:scale-[0.97] disabled:opacity-40"
                >
                  <Icon className="size-[clamp(20px,4vh,32px)] shrink-0 text-amber-300" aria-hidden />
                  <span>{topic.label}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {pickingLang && state.phase !== "language" && (
        <div className="fixed inset-0 z-40 flex flex-col gap-4 bg-[#06120d]/95 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[clamp(22px,4.5vh,36px)] font-bold">
              {kioskT(lang, "changeLanguage")}
            </div>
            <button
              type="button"
              aria-label={kioskT(lang, "close")}
              onClick={() => setPickingLang(false)}
              className="flex size-16 items-center justify-center rounded-2xl border-2 border-white/30"
            >
              <X className="size-8" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <LanguageGrid current={lang} onPick={chooseLanguage} />
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <KioskReceipt
            refId={receipt.refId}
            filedAt={receipt.filedAt}
            lang={lang}
            trackUrl={trackUrl}
            onClose={() => setReceipt(null)}
          />
        </div>
      )}

      {showCountdown && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 text-center">
          <div className="text-[clamp(64px,22vh,180px)] font-extrabold tabular-nums text-amber-300">
            {Math.ceil((remaining ?? 0) / 1000)}
          </div>
          <div className="px-6 text-[clamp(24px,5vh,44px)] font-bold">
            {kioskT(lang, "stillThere")}
          </div>
        </div>
      )}
    </div>
  );
};

const LanguageScreen = ({ onPick }: { onPick: (code: string) => void }) => (
  <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 [@media(min-height:700px)]:gap-6 [@media(min-height:700px)]:p-8">
    <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <h1 className="text-[clamp(30px,7vh,64px)] font-extrabold leading-none">
          Sahayak <span className="text-amber-300">· सहायक</span>
        </h1>
        <p className="mt-1 text-[clamp(16px,3vh,26px)] text-white/80">
          Cooperative help desk · सहकारी सहायता केंद्र
        </p>
      </div>
      <p className="max-w-md text-[clamp(14px,2.5vh,20px)] text-white/60">
        Ask about cooperative laws, schemes, crop insurance or complaints, by voice, in your
        language.
      </p>
    </header>
    <p className="shrink-0 text-[clamp(18px,3.4vh,28px)] font-semibold text-amber-200">
      Choose your language · अपनी भाषा चुनें
    </p>
    <div className="min-h-0 flex-1">
      <LanguageGrid onPick={onPick} />
    </div>
  </div>
);

const TopButton = ({
  icon,
  label,
  ariaLabel,
  onClick,
  disabled,
  strong,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel ?? label}
    className={cn(
      "flex min-h-14 max-w-[30vw] shrink items-center gap-2 rounded-xl px-3 text-[clamp(14px,2.6vh,20px)] font-bold active:scale-[0.97] disabled:opacity-35",
      strong ? "bg-amber-300 text-black" : "border-2 border-white/25 text-white"
    )}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);

const TalkButton = ({
  phase,
  label,
  onDown,
  onUp,
}: {
  phase: KioskState["phase"];
  label: string;
  onDown: () => void;
  onUp: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={phase === "thinking"}
    onPointerDown={(e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onDown();
    }}
    onPointerUp={onUp}
    onPointerCancel={onUp}
    onLostPointerCapture={onUp}
    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
    className={cn(
      "relative flex aspect-square w-full max-w-[min(46vh,34vw)] touch-none flex-col items-center justify-center gap-1 rounded-full font-extrabold shadow-[0_0_0_10px_rgba(255,255,255,0.07)] transition-colors",
      phase === "listening"
        ? "bg-red-600 text-white"
        : phase === "thinking"
          ? "bg-amber-300 text-black"
          : phase === "speaking"
            ? "bg-sky-400 text-black"
            : "bg-emerald-500 text-black active:bg-emerald-400"
    )}
  >
    {phase === "listening" && (
      <span className="kiosk-ring pointer-events-none absolute inset-0 rounded-full bg-red-500" />
    )}
    {phase === "thinking" ? (
      <LoaderCircle className="relative size-[34%] animate-spin" aria-hidden />
    ) : phase === "speaking" ? (
      <Waveform className="relative h-[26%] [&>span]:w-[9%]" />
    ) : (
      <Mic className="relative size-[34%]" aria-hidden />
    )}
    <span className="relative px-4 text-center text-[clamp(16px,3.4vh,30px)] leading-tight">
      {label}
    </span>
  </button>
);
