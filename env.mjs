import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    CONVEX_DEPLOYMENT: z.string().min(1),
    CALLMISSED_API_KEY: z.string().min(1),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CONVEX_URL: z.string().min(1).url(),
    NEXT_PUBLIC_SITE_URL: z.string().min(1).url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,

    CALLMISSED_API_KEY: process.env.CALLMISSED_API_KEY,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  },

  /**
   * Set SKIP_ENV_VALIDATION=1 to build without secrets (GitHub Actions; see
   * docs/ci-cd.md). The deployed worker does not set it, so its runtime env
   * (wrangler vars + secrets) is still validated.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
