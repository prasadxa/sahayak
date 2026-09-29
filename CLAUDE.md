# CLAUDE.md

@AGENTS.md

## Claude Code notes

- Before writing or changing Convex functions, read `.cursor/rules/convex.mdc` for the full Convex guidelines.
- After editing anything in `convex/`, run `npx convex dev --once` to push and regenerate types, then `npx tsc --noEmit`.
- To check the deployment target, run `npx convex env list` or grep `CONVEX_DEPLOYMENT` in `.env.local`. Don't print secret values.
- Update the **Status** section of `AGENTS.md` when a gap is closed or a new one is found.
