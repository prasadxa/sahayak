"use client";

import { memo, useEffect, useRef, useState } from "react";

import type { Message } from "ai";

import { toast } from "sonner";

import { useCopyToClipboard } from "usehooks-ts";

import {
  Copy,
  LoaderCircle,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import equal from "fast-deep-equal";

import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { canReadAloud } from "@/lib/tts-languages";

function messageText(message: Message): string {
  if (message.parts?.length) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");
  }
  return (message.content as string) ?? "";
}

type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

type TtsState = "idle" | "loading" | "playing";

const PureMessageActions = ({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) => {
  const { lang, t } = useI18n();
  const [, copyToClipboard] = useCopyToClipboard();
  const voteMessage = useMutation(api.chats.voteMessage);
  const synthesize = useAction(api.voice.synthesize);
  const [ttsState, setTtsState] = useState<TtsState>("idle");
  // Audio URL per `${messageId}:${lang}`, so switching language re-synthesises.
  const audioCache = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audio.currentTime = 0;
    }
    audioRef.current = null;
    setTtsState("idle");
  };

  // Stop playback when the message unmounts or the language changes.
  useEffect(() => stopAudio, [lang]);

  if (isLoading) return null;
  if (message.role === "user") return null;

  const canSpeak = canReadAloud(lang);

  const playAudio = async () => {
    const text = messageText(message).slice(0, 4000);
    if (!text) return;

    const cacheKey = `${message.id}:${lang}`;
    setTtsState("loading");
    try {
      let url = audioCache.current.get(cacheKey);
      if (!url) {
        url = (await synthesize({ text, language: lang })).url ?? undefined;
        if (!url) throw new Error("No audio URL returned");
        audioCache.current.set(cacheKey, url);
      }

      const audio = new Audio(url);
      audio.onended = () => {
        audioRef.current = null;
        setTtsState("idle");
      };
      audioRef.current = audio;
      await audio.play();
      setTtsState("playing");
    } catch {
      audioRef.current = null;
      setTtsState("idle");
      toast.error(t("ttsFailed"));
    }
  };

  const ttsLabel = !canSpeak
    ? t("ttsUnavailable")
    : ttsState === "playing"
      ? t("stop")
      : t("readAloud");

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              aria-label={t("copy")}
              onClick={async () => {
                await copyToClipboard(messageText(message));
                toast.success(t("copied"));
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("copy")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              disabled={vote?.isUpvoted}
              variant="outline"
              aria-label={t("upvote")}
              onClick={async () => {
                toast.promise(
                  voteMessage({ chatId, messageId: message.id, type: "up" }),
                  { success: t("voteSaved"), error: t("voteFailed") }
                );
              }}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("upvote")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
              variant="outline"
              disabled={vote && !vote.isUpvoted}
              aria-label={t("downvote")}
              onClick={async () => {
                toast.promise(
                  voteMessage({ chatId, messageId: message.id, type: "down" }),
                  { success: t("voteSaved"), error: t("voteFailed") }
                );
              }}
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("downvote")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          {/* A span trigger, so the tooltip still shows when the button is disabled. */}
          <TooltipTrigger asChild>
            <span tabIndex={canSpeak ? undefined : 0} className="inline-flex">
              <Button
                data-testid="message-read-aloud"
                className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
                variant="outline"
                aria-label={ttsLabel}
                aria-pressed={ttsState === "playing"}
                disabled={!canSpeak || ttsState === "loading"}
                onClick={() => {
                  if (ttsState === "playing") {
                    stopAudio();
                  } else {
                    void playAudio();
                  }
                }}
              >
                {!canSpeak ? (
                  <VolumeX className="w-4 h-4" />
                ) : ttsState === "loading" ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : ttsState === "playing" ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{ttsLabel}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export const MessageActions = memo(PureMessageActions, (prevProps, nextProps) => {
  if (!equal(prevProps.vote, nextProps.vote)) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;

  return true;
});
