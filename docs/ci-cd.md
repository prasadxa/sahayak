# CI/CD (GitHub Actions)

Two workflows live in `.github/workflows/`:

- **`ci.yml`** checks pull requests and pushes to `main`. It needs no secrets.
- **`deploy.yml`** deploys `main` to Convex and to the production Cloudflare worker `sahayak`.

Production deploys only go through `deploy.yml`. A local `npm run cf:deploy`
deploys the separate dev worker `sahayak-dev` (see
[deploy-cloudflare.md](deploy-cloudflare.md)), so it can't overwrite what CI
shipped.

| Worker | wrangler env | Deployed by | URL |
| --- | --- | --- | --- |
| `sahayak` | `production` (`env.production` in `wrangler.jsonc`) | `deploy.yml` only | `https://sahayak.rough-cell-383c.workers.dev` |
| `sahayak-dev` | default (top level) | `npm run cf:deploy` on your machine | `https://sahayak-dev.rough-cell-383c.workers.dev` |

```
 pull_request (any branch) / push to main        push to main / "Run workflow" on main
            │                                                │
            ▼                                                ▼
 ┌─────────────── ci.yml ───────────────┐      ┌──────── deploy.yml ─────────────────────────┐
 │ npm ci                               │      │ job: checks                                 │
 │ npm run lint                         │      │   npm ci → lint → tsc --noEmit → npm test   │
 │ npx tsc --noEmit                     │      │ job: preflight (main only; secrets present?)│
 │ npm test   (vitest + convex-test)    │      │                     │                       │
 │ npm run cf:build  (SKIP_ENV_VALID…)  │      │                     ▼                       │
 │ wrangler deploy --dry-run            │      │ job: deploy   (main only, env: production)  │
 │   --env production → size           │      │   validate site URL, secrets, Convex target │
 │   ::warning:: if gzip > 3 MiB        │      │   worker has CALLMISSED_API_KEY?            │
 └──────────────────────────────────────┘      │   npm run cf:build (derived Convex URLs)    │
                                               │   size gate: dry run, fail if gzip > 3 MiB  │
                                               │   ── nothing pushed before this line ──     │
                                               │   npx convex deploy                         │
                                               │   wrangler secret put … --env production    │
                                               │   opennextjs-cloudflare deploy              │
                                               │     --env production -- --var …             │
                                               │   smoke test (≤ 60 s)                       │
                                               │   on failure: wrangler rollback (worker)    │
                                               │   job summary                               │
                                               └─────────────────────────────────────────────┘
```

Both workflows use Node 22, because wrangler 4.x declares `engines.node >= 22`.
Actions are pinned to major versions (`actions/checkout@v4`,
`actions/setup-node@v4`), and both workflows have `permissions: contents: read`.
The size check lives in `.github/scripts/worker-size.sh` and is shared by both
workflows (`warn` in CI, `fail` in the deploy).

## `ci.yml`

This workflow runs on every `pull_request` and on `push` to `main` only, so a
branch with an open PR is checked once per push, not twice. A branch without a
PR isn't checked until you open one. Its concurrency group is `ci-<ref>`, so a
new push cancels the older run on the same ref.

1. `npm ci`, `npm run lint`, `npx tsc --noEmit` and `npm test`. The Convex tests use `convex-test` and mock `fetch`, so they need no network access.
2. `npm run cf:build` runs the real OpenNext Workers build, which catches bundling regressions such as webpack aliases or `ws`/`convex/browser`. It builds without secrets:
   - `SKIP_ENV_VALIDATION=1` turns off the t3-env check in `env.mjs` (`skipValidation`). The deployed worker does not set it, so its runtime env is still validated.
   - The public vars are placeholders: `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud`. `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_VERSION` are left unset, so the build uses the `cf:build` fallbacks (the `sahayak-dev` URL and `dev`).
3. `worker-size.sh warn --env production` runs `wrangler deploy --dry-run --env production --outdir …` (with `OPEN_NEXT_DEPLOY=true`, so wrangler doesn't hand off to OpenNext), which also checks that the production wrangler config parses. It adds a size table to the job summary. If the gzipped worker is over **3 MiB** (the Workers Free limit), it emits a `::warning::` but the job still passes. On 2026-09-30 the size was 3001 KiB gzipped (2.93 MiB), which leaves about 70 KiB of headroom.

## `deploy.yml`

This workflow runs on `push` to `main` and on `workflow_dispatch`. Only `main`
deploys: the `preflight` and `deploy` jobs have
`if: github.ref == 'refs/heads/main'`, so "Run workflow" on another branch runs
the checks and skips the rest. The `production` environment's deployment branch
policy (set up by `scripts/setup-github-secrets.sh`, see below) enforces the
same rule on GitHub's side. Its concurrency group is `deploy-production` with
`cancel-in-progress: false`, so deploys queue up behind each other and are
never cut off halfway.

1. **checks**: lint, tsc and tests, the same commands as CI.
2. **preflight** (`environment: production`, main only): checks that the three required secrets exist. If any is missing, the deploy is skipped with a warning instead of failing, so an unconfigured fork stays green. The job only needs the environment to read its secrets; see [Protection rules](#protection-rules) for what that means for required reviewers.
3. **deploy** (`environment: production`, main only, and only when preflight says the secrets are there). The steps run in this order, and nothing is pushed until the build and the size gate have passed:
   1. **Check configuration.**
      - The `NEXT_PUBLIC_SITE_URL` variable (default `https://sahayak.rough-cell-383c.workers.dev`) must match `^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$`, which is an https origin with no path, query or spaces. It is checked before anything uses it, because it ends up in the bundle, in curl and in the `--var` flags, and OpenNext runs wrangler through a shell.
      - The step fails with a clear message if a required secret is missing.
      - It reads the Convex target, for example `prod:happy-otter-123`, from the part of `CONVEX_DEPLOY_KEY` before `|`. That part is the deployment name, not the secret. Only `prod:` and `dev:` keys are accepted. The build needs the Convex URLs before `convex deploy` runs, so they are derived from the name: `https://<name>.convex.cloud` and `https://<name>.convex.site`. That is the standard Convex cloud URL format. A deployment whose URL doesn't follow it would fail the `/api/health` smoke check and roll the worker back.
   2. **Check the worker's `CALLMISSED_API_KEY`.** If the GitHub secret is set, it is synced later. If it's empty, the step runs `wrangler secret list --env production --format json`, which lists names only, and fails with "First deploy needs CALLMISSED_API_KEY" if the `sahayak` worker has no such secret or doesn't exist yet.
   3. **Build the worker:** `npm run cf:build` with `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_VERSION=${GITHUB_SHA::7}` (the version that `/api/health` reports). `cf:build` still blanks `.open-next/cloudflare/next-env.mjs`.
   4. **Size gate:** `worker-size.sh fail --env production`. The dry run fails the job if the gzipped worker is over `WORKER_GZIP_LIMIT_MIB` (3 MiB, the Workers Free limit; raise it to 10 on Workers Paid), or if wrangler's size line can't be found.
   5. **Deploy Convex:** `npx convex deploy --message "GitHub Actions <sha>"`, with no `--cmd`. It typechecks and pushes the functions and schema to the key's deployment. **This push is not rolled back automatically** if a later step fails; see [Rollback](#rollback).
   6. **Sync the worker secret.** `CALLMISSED_API_KEY` is piped into `wrangler secret put --env production` and never echoed. If the GitHub secret is empty, the step is skipped with a notice (step 2 already made sure the worker has one).
   7. **Deploy the worker:**
      ```
      npx opennextjs-cloudflare deploy --env production -- --var CONVEX_DEPLOYMENT:… --var NEXT_PUBLIC_CONVEX_URL:… --var NEXT_PUBLIC_CONVEX_SITE_URL:… --var NEXT_PUBLIC_SITE_URL:…
      ```
      `--env production` selects `env.production` in `wrangler.jsonc`: worker `sahayak`, with its own `WORKER_SELF_REFERENCE` service binding. The `--var` values override that env's `vars`, whose Convex entries are deliberately empty, so the runtime vars always match the deployment the build used.
   8. **Smoke test** against the site URL. It expects `GET /api/health` 200 (the worker is up and Convex answers), `/login` 200, `/track` 200, `/manifest.webmanifest` 200 and `POST /api/chat` 401. It retries every 5 s for up to 60 s and fails the job if the checks never pass.
   9. **Automatic worker rollback.** If any step fails after the worker deploy succeeded (in practice the smoke test), `npx wrangler rollback --env production --message "smoke test failed <sha>" -y` puts the previous worker version back. On the very first deploy there is no previous version, so this step fails too; the site was not up before anyway.
   10. **Job summary** (always written): the site URL, the commit, the Convex deployment and URL, the worker size, and the outcome of each step, including the rollback.

### Secrets and variables

The secrets are set on the **`production` environment**, which is what
`scripts/setup-github-secrets.sh` does. Repo-level secrets also work.

| Name | Kind | Required | Value |
| --- | --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | secret | yes | A Convex **production** deploy key (`prod:…\|…`), or a dev deploy key (`dev:…\|…`). See below. |
| `CLOUDFLARE_API_TOKEN` | secret | yes | A Cloudflare API token made from the "Edit Cloudflare Workers" template. |
| `CLOUDFLARE_ACCOUNT_ID` | secret | yes | `337c662fed500c2dff530141baaf75c9` |
| `CALLMISSED_API_KEY` | secret | first deploy | The worker's runtime key (`cm_…`). When it's empty, the deploy checks that the `sahayak` worker already has the secret and fails before building if it doesn't. |
| `NEXT_PUBLIC_SITE_URL` | variable | no | The public site URL, an https origin matching `^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$`. It defaults to `https://sahayak.rough-cell-383c.workers.dev`. Set it (Settings → Secrets and variables → Actions → Variables) if you add a custom domain. |

`CALLMISSED_API_KEY` is also read by Convex actions. That copy lives in the
**Convex** env (`npx convex env set`), not in GitHub.

## One-time setup

### 1. Cloudflare API token

1. Go to dash.cloudflare.com → My Profile → **API Tokens** → **Create Token**.
2. Pick the **Edit Cloudflare Workers** template.
3. Under **Account Resources**, choose *Include* → the account `337c662fed500c2dff530141baaf75c9` (not "All accounts").
4. Under **Zone Resources**, choose *Include* → *All zones from an account* → the same account. Workers.dev needs no zone, but the template asks for one.
5. Optionally, set a TTL or a client IP filter. Then create the token and copy it. It is shown only once.

The template covers `wrangler deploy`, `wrangler secret put`, `wrangler rollback` and `wrangler deployments list`.

### 2. Convex deploy key: choose prod or dev

`npx convex deploy` pushes to whichever deployment the key belongs to.

**Recommended: a production deploy key.** The hosted site gets its own Convex
deployment, with its own data, `SITE_URL` and JWT keys. The dev deployment
`whimsical-possum-664` stays yours for `npm run dev`. This also removes the
`SITE_URL` either/or problem described in
[deploy-cloudflare.md](deploy-cloudflare.md#after-the-first-deploy).

1. Open dashboard.convex.dev → project **sahayak** → switch to the **Production** deployment. Create it if it doesn't exist yet.
2. Go to **Deployment Settings → General** → **Generate Production Deploy Key**. Leave the `deployment:deploy` permission on, then copy the key. It looks like `prod:<name>|…`. Note the `<name>`: the prod URLs are `https://<name>.convex.cloud` and `https://<name>.convex.site`.
3. Set up the prod env once. Run these from the repo, logged in to the Convex CLI. `--prod` targets the project's production deployment. Pipe the values so they stay out of your shell history:
   ```bash
   # Copy the secrets you already have on dev straight to prod, without printing them:
   for v in CALLMISSED_API_KEY AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET ADMIN_EMAILS; do
     npx convex env get "$v" | tr -d '\n' | npx convex env set --prod "$v"
   done
   # (or: grep '^CALLMISSED_API_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n"' | npx convex env set --prod CALLMISSED_API_KEY)

   # Where OAuth sign-ins return to: the hosted site.
   npx convex env set --prod SITE_URL https://sahayak.rough-cell-383c.workers.dev

   # Fresh JWT_PRIVATE_KEY + JWKS for prod. Don't reuse the dev keys.
   npx @convex-dev/auth --prod
   ```
   `npx @convex-dev/auth --prod` generates and sets `JWT_PRIVATE_KEY` and `JWKS` on prod. The project files are already set up, so answer its prompts and check `git diff` afterwards. To do it by hand instead, generate the keys with the script at <https://labs.convex.dev/auth/setup/manual> and pipe each value into `npx convex env set --prod JWT_PRIVATE_KEY` or `npx convex env set --prod JWKS`.
   Check the result with `npx convex env list --prod`, which shows names and values, so don't share its output.
4. Google OAuth, in Google Cloud project `gargifarms-a56b0` → APIs & Services → Credentials → OAuth client "Sahayak":
   - **Authorized redirect URIs**: add `https://<prod-name>.convex.site/api/auth/callback/google`
   - **Authorized JavaScript origins**: add `https://sahayak.rough-cell-383c.workers.dev`
5. Run the first deploy (step 4 below). It pushes the schema and functions to prod.
6. Seed prod. It starts empty: no KB, no users, no grievances.
   ```bash
   npm run seed:kb -- --prod                       # the 8 curated entries in data/kb
   # single entry: npx convex run --prod kb:seedIngest '{"title":"…","category":"general","content":"…"}'
   npx convex run --prod kb:backfillEmbeddingsInternal '{}'   # once the CallMissed embeddings API is healthy
   npx convex run --prod roles:grantRole '{"email":"you@example.com","role":"admin"}'  # after that account signs up
   ```

**Alternative: a dev deploy key (keeps using `whimsical-possum-664`).** In the
dashboard, open the dev deployment `whimsical-possum-664` → **Deployment
Settings → General**, and generate a deploy key for it
(`dev:whimsical-possum-664|…`). No extra
Convex setup is needed, because that deployment already has all its env vars.

The Convex docs describe dev keys as giving full access to one deployment. They
don't spell out using them with `convex deploy`, but the CLI (checked in
`convex` 1.46.0) treats `dev:…` keys as deployment keys, and `convex deploy`
pushes to "the deployment associated with that key". This has trade-offs:

- Every deploy of `main` overwrites whatever `npx convex dev` last pushed to `whimsical-possum-664`, and a running `npx convex dev` overwrites CI's push.
- The deployment has a single `SITE_URL`, so Google sign-in works for either localhost or the hosted site, not both. Password sign-in is unaffected.
- Dev and demo data are shared.

You can switch to a prod key later. Replace the secret, do the prod setup above,
and redeploy.

### 3. Put the secrets in GitHub

Run this yourself from the repo root. It needs `gh` logged in as **prasadxa**,
and it prompts with hidden input:

```bash
gh auth status            # if prasadxa isn't the active account: gh auth switch -u prasadxa
bash scripts/setup-github-secrets.sh
```

The script does the following, and is safe to re-run:

- It creates or updates the `production` environment with a deployment branch policy that allows **only `main`** (`custom_branch_policies`, plus a `main` branch rule). If the rule already exists, it is left alone.
- It sets `CALLMISSED_API_KEY` from `.env.local`.
- It prompts for `CONVEX_DEPLOY_KEY` and `CLOUDFLARE_API_TOKEN`. Press Enter to keep an existing value.
- It sets `CLOUDFLARE_ACCOUNT_ID`.
- It prints the names that were set, kept or are still missing. It never prints values.

**Required: the `main`-only branch policy.** The workflow already skips
non-`main` refs, but the branch policy is what stops anyone from pointing a
modified workflow on another branch at the production secrets. Check it under
Settings → Environments → `production` → Deployment branches and tags: it must
say "Selected branches and tags" with the single rule `main`. If you set up the
environment by hand instead of with the script, add that rule yourself.

<a id="protection-rules"></a>
**Protection rules: use a wait timer or the branch policy, not required
reviewers.** Both `preflight` and `deploy` use `environment: production`
(`preflight` only to read the secrets for its presence check). With required
reviewers on the environment, every deploy asks for approval twice, once per
job. If you want a gate, add a **wait timer** to the environment, or rely on the
branch policy above. If you really want required reviewers, move the secrets to
repo-level secrets so that `preflight` no longer needs the environment, and
drop `environment: production` from the `preflight` job.

### 4. First deploy

Push to `main`, or run **Actions → Deploy → Run workflow** on `main`, or
`gh workflow run deploy.yml --repo prasadxa/sahayak --ref main`. The first
deploy needs the `CALLMISSED_API_KEY` GitHub secret (or the secret already on
the `sahayak` worker). If the worker doesn't exist yet, the secret step creates
it and the deploy uploads the code.
A brand-new workers.dev hostname can take a minute or two to answer. If only
the smoke test fails on the very first run, re-run the job.

## Rollback

**Automatic (worker only).** If the smoke test fails after the worker deploy,
the workflow runs `wrangler rollback --env production` and the previous worker
version serves traffic again. **The Convex push is not rolled back.** The new
functions and schema stay live on the Convex deployment, and the old worker
talks to them. That's usually fine for additive changes. After a breaking
change, such as a removed or renamed function or argument, or a schema change
the old code doesn't expect, fix forward or redeploy an older commit (below).
A failure *before* the Convex step (build, size gate, `CALLMISSED_API_KEY`
check) pushes nothing anywhere.

**Worker by hand (fast, code and vars only).** Run these locally after `npx wrangler login`, or with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set:

```bash
npx wrangler deployments list --env production                   # find the version id to go back to
npx wrangler rollback [version-id] --env production -m "reason"  # without an id: the previous version
```

The dashboard does the same: Workers → sahayak → Deployments → ⋯ → Rollback.
Secrets are not rolled back.

**Everything (Convex functions and worker together).** Open Actions → Deploy,
pick an older successful run, and click **Re-run all jobs**. A re-run uses that
run's commit, so it redeploys the Convex functions, schema and worker from that
commit. Alternatively, `git revert` the bad commit and push to `main`. Convex
refuses a schema that existing documents don't match, so a revert across a
schema change may need a data fix first. Convex has no one-click rollback for
functions.

## Troubleshooting

- **Size warning in CI, or the size gate fails the deploy:** the gzipped worker is over 3 MiB. Move the account to Workers Paid (10 MiB, then set `WORKER_GZIP_LIMIT_MIB: "10"` in `deploy.yml`) or drop server dependencies. Measure locally with `bash .github/scripts/worker-size.sh warn --env production` after `npm run cf:build`.
- **"First deploy needs CALLMISSED_API_KEY":** set the GitHub secret (`bash scripts/setup-github-secrets.sh`) or put it on the worker directly: `grep '^CALLMISSED_API_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx wrangler secret put CALLMISSED_API_KEY --env production`.
- **Smoke test fails with 500 on `/login`:** the worker's runtime env failed `env.mjs` validation, for example because the worker has no `CALLMISSED_API_KEY` or was deployed without the `--var` flags. Check `npx wrangler tail --env production`.
- **Smoke test fails with 503 on `/api/health`:** the worker can't reach Convex. Check that the derived Convex URL in the job log is the deployment's real URL.
- **"Bad NEXT_PUBLIC_SITE_URL":** the repo variable must be a bare https origin, such as `https://sahayak.example.org`, with no path.
- **Deploy jobs skipped:** the run wasn't on `main`, or a required secret is missing (see the preflight warning).
- **`Unsupported CONVEX_DEPLOY_KEY`:** preview keys and project tokens aren't supported. Use a `prod:` or `dev:` deploy key.
