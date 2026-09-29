"use client";

import { memo, useEffect, useRef, useState } from "react";

import { Mic, Square, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";

/** Recording stops by itself after this long. */
const MAX_RECORDING_MS = 60_000;
const TOAST_ID = "voice-input";

/**
 * Push-to-talk voice input: records via MediaRecorder, uploads the clip to
 * Convex storage, transcribes with CallMissed STT (saaras:v3, which
 * auto-detects 22 Indian languages) and types the result into the composer.
 * The UI language is passed as a short code; the server converts it to BCP-47.
 */
const PureVoiceInputButton = ({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled: boolean;
}) => {
  const { lang, t } = useI18n();
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateAttachmentUrl = useMutation(api.files.generateAttachmentUrl);
  const transcribe = useAction(api.voice.transcribe);

  const clearLimitTimer = () => {
    if (limitTimerRef.current) {
      clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  };

  // Release the microphone if the component unmounts mid-recording.
  useEffect(
    () => () => {
      clearLimitTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  const stopAndTranscribe = () => {
    clearLimitTimer();
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setState("transcribing");
    toast.loading(t("transcribing"), { id: TOAST_ID });
    recorder.stop();
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(t("micDenied"), { id: TOAST_ID });
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      try {
        if (blob.size === 0) {
          toast.error(t("noSpeech"), { id: TOAST_ID });
          return;
        }
        const postUrl = await generateAttachmentUrl({ contentType: mimeType });
        const uploadRes = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        const { storageId } = await uploadRes.json();
        const { text } = await transcribe({ storageId, language: lang });
        if (text.trim()) {
          toast.dismiss(TOAST_ID);
          onTranscript(text);
        } else {
          toast.error(t("noSpeech"), { id: TOAST_ID });
        }
      } catch {
        toast.error(t("transcribeFailed"), { id: TOAST_ID });
      } finally {
        setState("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
    toast(t("recording"), { id: TOAST_ID, duration: MAX_RECORDING_MS });

    limitTimerRef.current = setTimeout(() => {
      if (recorder.state === "recording") {
        toast.info(t("recordingLimit"));
        stopAndTranscribe();
      }
    }, MAX_RECORDING_MS);
  };

  return (
    <Button
      data-testid="voice-input-button"
      aria-label={state === "recording" ? t("stop") : t("voiceTooltip")}
      className="rounded-md p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      variant="ghost"
      disabled={disabled || state === "transcribing"}
      onClick={(e) => {
        e.preventDefault();
        if (state === "recording") {
          stopAndTranscribe();
        } else {
          void startRecording();
        }
      }}
    >
      {state === "recording" ? (
        <Square className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
      ) : state === "transcribing" ? (
        <LoaderCircle className="w-4 h-4 animate-spin" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
};

export const VoiceInputButton = memo(PureVoiceInputButton);
