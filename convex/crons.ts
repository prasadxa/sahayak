import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Read-aloud clips are only useful for a few minutes; drop them after 6 h.
crons.interval("delete old TTS audio", { hours: 1 }, internal.voice.cleanupOldAudio, {});

// Kiosk chats hold walk-in citizens' details: purge those older than 1 h.
crons.interval("purge old kiosk chats", { minutes: 15 }, internal.chats.purgeKioskChats, {});

export default crons;
