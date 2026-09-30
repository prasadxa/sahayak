# Deploying the Next.js app to Cloudflare Workers

Only the Next.js frontend runs on Cloudflare, through the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Convex stays
on Convex cloud (`whimsical-possum-664`). Convex Auth, KB ingestion, voice and
grievances keep running as Convex functions.

This page covers building, previewing and deploying from your machine. **A
local deploy goes to the dev worker `sahayak-dev`, never to production.** The
production worker `sahayak` is deployed only by GitHub Actions on pushes to
`main`: see [ci-cd.md](ci-cd.md) for the workflows, the secrets they need, and
the one-time Convex prod setup.

| Item | Value |
| --- | --- |
| Dev worker (local `npm run cf:deploy`, default wrangler env) | `sahayak-dev`, `https://sahayak-dev.rough-cell-383c.workers.dev` |
| Production worker (CI only, `--env production`) | `sahayak`, `https://sahayak.rough-cell-383c.workers.dev` |
| workers.dev subdomain | `rough-cell-383c`, of account `337c662fed500c2dff530141baaf75c9` |
| Config | `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts` |
| Adapter | `@opennextjs/cloudflare` `~1.15.1`. This is the newest line that supports Next `15.3.8` (1.16+ needs `~15.3.9`, and 1.19+ needs `>=15.5.15`) |

## Prerequisites

- Run `npm install`. It installs `@opennextjs/cloudflare` and `wrangler` as devDependencies.
- Run `npx wrangler login` and check with `npx wrangler whoami` that the right account is active. If you have more than one account, set `CLOUDFLARE_ACCOUNT_ID`. `wrangler.jsonc` has no `account_id`.
- Fill in `.env.local`. `next build` reads it at build time, and `env.mjs` validates `CONVEX_DEPLOYMENT`, `CALLMISSED_API_KEY`, `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_SITE_URL`. CI skips that check with `SKIP_ENV_VALIDATION=1`, but the deployed worker still validates its runtime env.
- Bundle size: the worker is about **3.0 MiB gzipped**, measured with `wrangler deploy --dry-run`. That is right at the Workers Free limit of 3 MiB. The Paid plan allows 10 MiB. If a deploy fails with a size error, switch the account to Workers Paid or cut server dependencies.

## How the build works

- `npm run cf:build` runs `opennextjs-cloudflare build`, which runs
  `CF_WORKERS_BUILD=1 npx next build` (set in `open-next.config.ts`).
  - It uses **webpack, not Turbopack**. `next build --turbo` server chunks load through dynamic `require()`, which Workers can't do ("Failed to load chunk server/chunks/ssr/..."). `next dev --turbo` is unaffected.
  - `CF_WORKERS_BUILD=1` switches on a webpack alias in `next.config.ts`. It maps `convex/browser` to its non-Node build, because the Node build inlines `ws` and crashes on Workers.
  - `NEXT_PUBLIC_SITE_URL` is overridden, because `NEXT_PUBLIC_*` values are inlined at build time and `.env.local` holds `http://localhost:3000`. `cf:build` takes it from the shell environment and falls back to the **dev** worker URL, `https://sahayak-dev.rough-cell-383c.workers.dev` (`NEXT_PUBLIC_SITE_URL=https://… npm run cf:build`). The GitHub deploy sets it to the production URL explicitly. If the dev URL changes, update the fallback in `cf:build` and the top-level `vars` in `wrangler.jsonc`.
  - `NEXT_PUBLIC_APP_VERSION` (reported by `/api/health`) is taken from the environment and defaults to `dev`. CI sets it to the short commit SHA.
- The adapter copies every `.env*` value, including `.env.local` secrets, into `.open-next/cloudflare/next-env.mjs` as a runtime fallback. `cf:build` blanks that file after the build, so no secret goes into the bundle. At runtime the values come only from `wrangler.jsonc` `vars` and Wrangler secrets.
- `wrangler.jsonc` has two workers. The top level is `sahayak-dev`. `env.production` is `sahayak`. Wrangler environments don't inherit `vars` or bindings, so each one has its own `vars` and its own `WORKER_SELF_REFERENCE` service binding that points at itself. The production `vars` leave the Convex entries empty on purpose, because CI fills all four in with `--var` from `CONVEX_DEPLOY_KEY`.
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
value in so that it never shows up in the shell history. This sets the dev worker
`sahayak-dev`:

```bash
grep '^CALLMISSED_API_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put CALLMISSED_API_KEY
```

The production worker gets its copy from the `CALLMISSED_API_KEY` GitHub secret
on every deploy. To set it by hand, add `--env production` to the same command.
That's the one production command that's fine to run locally.

`CONVEX_DEPLOYMENT` (`dev:whimsical-possum-664`) is not secret, so it is
defined in the top-level `wrangler.jsonc` `vars`, along with `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL` and `NEXT_PUBLIC_SITE_URL`.
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are read only by Convex, so leave
them off the worker.

If you run `wrangler secret put` before the first deploy, Wrangler creates the
`sahayak-dev` worker with only that secret. The deploy then uploads the code.

## Deploy

```bash
npm run cf:deploy     # cf:build, then opennextjs-cloudflare deploy -> worker sahayak-dev
```

This always deploys the dev worker. Don't run
`opennextjs-cloudflare deploy --env production` or `wrangler deploy --env production`
by hand. Production goes through CI only, which builds against the production
Convex deployment and passes the runtime vars. A hand deploy would ship empty
Convex vars and fail the runtime env check.

Smoke test it. Expected results: `/api/health` 200 (with `"version":"dev"`), `/login` 200, `/` 307 to `/login`, `/track`
200, `/manifest.webmanifest` 200, `/api/og` 200 `image/png`,
`POST /api/chat` 401 when signed out, and `POST /api/auth` 400 with an empty
body (anything but 404).

```bash
B=https://sahayak-dev.rough-cell-383c.workers.dev
for p in /api/health /login / /track /manifest.webmanifest /api/og; do curl -s -o /dev/null -w "$p %{http_code} %{content_type}\n" $B$p; done
curl -s -o /dev/null -w "chat %{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' $B/api/chat
curl -s -o /dev/null -w "auth %{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' $B/api/auth
```

Logs: `npx wrangler tail` (dev worker) or `npx wrangler tail --env production`,
or Workers → sahayak-dev / sahayak → Observability in the dashboard
(`observability.enabled` is on).

## After the first deploy

1. **Convex `SITE_URL`** (Google OAuth redirects):

   ```bash
   npx convex env set SITE_URL https://sahayak-dev.rough-cell-383c.workers.dev
   ```

   Convex Auth sends OAuth sign-ins back to `SITE_URL` when they finish. The
   dev deployment `whimsical-possum-664` has **one** `SITE_URL`, so this is an
   either/or choice. Once it points at the dev worker, Google sign-in started
   from `http://localhost:3000` also lands on the dev worker, and the other
   way round when it points at localhost. Password sign-in is unaffected
   because it doesn't redirect. The production worker should use its own
   Convex prod deployment with its own `SITE_URL`, JWT keys and env; see
   [ci-cd.md](ci-cd.md#2-convex-deploy-key-choose-prod-or-dev).

2. **Google OAuth client** (optional; Google Cloud project `gargifarms-a56b0`,
   OAuth client "Sahayak"): add `https://sahayak-dev.rough-cell-383c.workers.dev`
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
npx wrangler deployments list        # dev worker; find the previous version id
npx wrangler rollback [version-id]   # without an id, rolls back to the previous version
```

A rollback restores the code and `vars`, but secrets stay as they are. Add
`--env production` to both commands for the production worker. A failed CI
deploy rolls the production worker back by itself; for that, and for Convex,
see [ci-cd.md](ci-cd.md#rollback). To take the dev site down completely, run
`npx wrangler delete` (worker `sahayak-dev`). That deletes the worker, its
secrets and its workers.dev route.
