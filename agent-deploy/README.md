# agent-deploy — Vercel root for the eve agent

This directory is the **Root Directory** of the `mtg-agent-agent` Vercel project.
It exists so the agent deploys from git like the web app, instead of via ad-hoc
file uploads.

The repo is a two-project monorepo on Vercel:

| Vercel project    | Root directory | What it serves                          |
| ----------------- | -------------- | --------------------------------------- |
| `mtg-agent`       | `/` (repo root)| Next.js web app (Commander Copilot UI)  |
| `mtg-agent-agent` | `agent-deploy` | eve agent service (`/eve/v1/*` routes)  |

The agent source of truth stays in `../agent` (repo root), where `eve dev` and
the Next app expect it for local development. At build time, `vercel.json`'s
`buildCommand` copies `../agent` in here and runs `eve build` — nothing under
`agent-deploy/agent/` is ever committed (see `.gitignore`).

`ignoreCommand` skips agent builds for pushes that touch neither `../agent`
nor this directory, so web-only changes don't redeploy the agent.

## One-time Vercel dashboard setup

1. Open the `mtg-agent-agent` project → **Settings → Git** → connect
   `jlgrimes/mtg-agent`, production branch `main`.
2. **Settings → Build & Deployment → Root Directory** → set to `agent-deploy`,
   and keep **"Include source files outside of the Root Directory"** enabled
   (the build copies `../agent`).

After that, every push to `main` that touches `agent/` or `agent-deploy/`
redeploys the agent automatically.
