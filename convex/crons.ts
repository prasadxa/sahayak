import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Read-aloud clips are only useful for a few minutes; drop them after 6 h.
crons.interval("delete old TTS audio", { hours: 1 }, internal.voice.cleanupOldAudio, {});

export default crons;
