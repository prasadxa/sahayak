import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";

// Always run on request; a cached health check is useless.
export const dynamic = "force-dynamic";

const CONVEX_TIMEOUT_MS = 3000;

/**
 * Cheap, unauthenticated Convex round trip: `track` rejects a malformed ref
 * before touching the database and returns null.
 */
async function checkConvex(): Promise<"ok" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Convex timeout")), CONVEX_TIMEOUT_MS);
  });
  try {
    await Promise.race([fetchQuery(api.grievances.track, { refId: "health-check" }), timeout]);
    return "ok";
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/health: 200 when Convex answers, 503 when it doesn't. */
export async function GET() {
  const convex = await checkConvex();
  const ok = convex === "ok";
  return Response.json(
    {
      ok,
      time: new Date().toISOString(),
      convex,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
