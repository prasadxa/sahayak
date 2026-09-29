# Deploying the Next.js app to Cloudflare Workers

Only the Next.js frontend runs on Cloudflare, through the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Convex stays
on Convex cloud (`whimsical-possum-664`). Convex Auth, KB ingestion, voice and
grievances keep running as Convex functions.

| Item | Value |
| --- | --- |
| Worker name | `sahayak` |
| Expected URL | `https://sahayak.rough-cell-383c.workers.dev` (`rough-cell-383c` is the workers.dev subdomain of account `337c662fed500c2dff530141baaf75c9`) |
| Config | `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts` |
| Adapter | `@opennextjs/cloudflare` `~1.15.1`. This is the newest line that supports Next `15.3.8` (1.16+ needs `~15.3.9`, and 1.19+ needs `>=15.5.15`) |

## Prerequisites

- Run `npm install`. It installs `@opennextjs/cloudflare` and `wrangler` as devDependencies.
- Run `npx wrangler login` and check with `npx wrangler whoami` that the right account is active. If you have more than one account, set `CLOUDFLARE_ACCOUNT_ID`. `wrangler.jsonc` has no `account_id`.
- Fill in `.env.local`. `next build` reads it at build time, and `env.mjs` validates `CONVEX_DEPLOYMENT`, `CALLMISSED_API_KEY`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_SITE_URL`.
- Bundle size: the worker is about **3.0 MiB gzipped**, measured with `wrangler deploy --dry-run`. That is right at the Workers Free limit of 3 MiB. The Paid plan allows 10 MiB. If a deploy fails with a size error, switch the account to Workers Paid or cut server dependencies.

## How the build works

- `npm run cf:build` runs `opennextjs-cloudflare build`, which runs
  `CF_WORKERS_BUILD=1 npx next build` (set in `open-next.config.ts`).
  - It uses **webpack, not Turbopack**. `next build --turbo` server chunks load through dynamic `require()`, which Workers can't do ("Failed to load chunk server/chunks/ssr/..."). `next dev --turbo` is unaffected.
  - `CF_WORKERS_BUILD=1` switches on a webpack alias in `next.config.ts`. It maps `convex/browser` to its non-Node build, because the Node build inlines `ws` and crashes on Workers.
  - `NEXT_PUBLIC_SITE_URL` is overridden to the workers.dev URL, because `NEXT_PUBLIC_*` values are inlined at build time and `.env.local` holds `http://localhost:3000`. If the URL changes, update it both in the `cf:build` script and in `wrangler.jsonc` `vars`.
- The adapter copies every `.env*` value, including `.env.local` secrets, into `.open-next/cloudflare/next-env.mjs` as a runtime fallback. `cf:build` blanks that file after the build, so no secret goes into the bundle. At runtime the values come only from `wrangler.jsonc` `vars` and Wrangler secrets.
- There is no incremental cache (R2/KV) and no `IMAGES` binding. Every page is dynamic, and `next/image` serves the original images.
- Resumable streams stay disabled because `REDIS_URL` is not set.

## Local preview (Workers runtime, port 8787)

```bash
cp .dev.vars.example .dev.vars   # then fill in CALLMISSED_API_KEY (or copy it from .env.local)
npm run cf:build
npx opennextjs-cloudflare preview --port 8787
# or run both steps at once: npm run cf:preview
```

`next build` and `next dev` share `.next`, so stop `next dev` before building.
Restart it afterwards.

## One-time secrets

Secrets are **not** in `wrangler.jsonc`. Set them once per worker, piping the
value in so that it never shows up in the shell history:

```bash
grep '^CALLMISSED_API_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put CALLMISSED_API_KEY
```

`CONVEX_DEPLOYMENT` (`dev:whimsical-possum-664`) is not secret, so it is
defined in `wrangler.jsonc` `vars`, along with `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL` and `NEXT_PUBLIC_SITE_URL`.
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are read only by Convex, so leave
them off the worker.

If you run `wrangler secret put` before the first deploy, Wrangler creates the
`sahayak` worker with only that secret. The deploy then uploads the code.

## Deploy

```bash
npm run cf:deploy     # cf:build, then opennextjs-cloudflare deploy
```

Smoke test it. Expected results: `/login` 200, `/` 307 to `/login`, `/track`
200, `/manifest.webmanifest` 200, `/api/og` 200 `image/png`,
`POST /api/chat` 401 when signed out, and `POST /api/auth` 400 with an empty
body (anything but 404).

```bash
B=https://sahayak.rough-cell-383c.workers.dev
for p in /login / /track /manifest.webmanifest /api/og; do curl -s -o /dev/null -w "$p %{http_code} %{content_type}\n" $B$p; done
curl -s -o /dev/null -w "chat %{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' $B/api/chat
curl -s -o /dev/null -w "auth %{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' $B/api/auth
```

Logs: `npx wrangler tail sahayak`, or Workers → sahayak → Observability in the
dashboard (`observability.enabled` is on).

## After the first deploy

1. **Convex `SITE_URL`** (Google OAuth redirects):

   ```bash
   npx convex env set SITE_URL https://sahayak.rough-cell-383c.workers.dev
   ```

   Convex Auth sends OAuth sign-ins back to `SITE_URL` when they finish. The
   dev deployment `whimsical-possum-664` has **one** `SITE_URL`, so this is an
   either/or choice. Once it points at workers.dev, Google sign-in started
   from `http://localhost:3000` also lands on the hosted site, and the other
   way round when it points at localhost. Password sign-in is unaffected
   because it doesn't redirect. To run both, create a Convex prod deployment
   for the hosted site (`npx convex deploy`) with its own `SITE_URL`, JWT keys
   and env. Then point `wrangler.jsonc` `vars` and the `cf:build` env at it.

2. **Google OAuth client** (optional; Google Cloud project `gargifarms-a56b0`,
   OAuth client "Sahayak"): add `https://sahayak.rough-cell-383c.workers.dev`
   to **Authorized JavaScript origins**. You don't need a new redirect URI,
   because the callback is still
   `https://whimsical-possum-664.convex.site/api/auth/callback/google`. A prod
   Convex deployment would need its own `…convex.site` callback.

3. **Kiosk QR codes:** a kiosk served from the hosted URL already prints QR
   links on its own origin. A kiosk served from `localhost`, such as the
   Raspberry Pi, uses `NEXT_PUBLIC_TRACK_BASE_URL`, falling back to
   `NEXT_PUBLIC_SITE_URL`. Set `NEXT_PUBLIC_TRACK_BASE_URL=https://sahayak.rough-cell-383c.workers.dev`
   in that machine's `.env.local` so that phones can open the link. The value
   is inlined at build time, so rebuild or restart after you change it.

## Rollback

```bash
npx wrangler deployments list        # find the previous version id
npx wrangler rollback [version-id]   # without an id, rolls back to the previous version
```

A rollback restores the code and `vars`, but secrets stay as they are. To take
the site down completely, run `npx wrangler delete sahayak`. That deletes the
worker, its secrets and its workers.dev route.
