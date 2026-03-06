<p align="center">
  <h1 align="center">⚡ suparun</h1>
  <p align="center"><strong>Never restart <code>bun run dev</code> again.</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/@suparun/cli"><img src="https://img.shields.io/npm/v/@suparun/cli.svg" alt="npm" /></a>
    <a href="https://github.com/LivioGama/suparun/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey.svg" alt="Platform" />
    <img src="https://img.shields.io/badge/zero-dependencies-brightgreen.svg" alt="Zero deps" />
  </p>
</p>

---

You're deep in flow. Something kills your dev server — a build tool, a port conflict, an IDE restart, a random crash. Or your non-obedient AI coding assistant casually runs `bun run dev` — despite the rules explicitly telling it not to. You don't notice for 5 minutes. Then you're debugging why your changes aren't showing up, only to realize the server died. *Again.*

Suparun is a **watchdog daemon** that guards your port, auto-revives crashed processes, adopts servers started by other tools, and HTTP-pings to detect hung processes. Set it and forget it.

- **Watch the port** every 2s — not just the PID
- **Adopt external processes** — if your IDE started the server, suparun watches it too
- **Auto-revive** the moment the port goes down or stops responding
- **Exponential backoff** on crash loops (gives up after 50)
- **Clean shutdown** — kills the entire process tree, no orphans
- **Virtual hosts** — access `myapp.localhost:2999` instead of `localhost:3000`

## Install

```bash
bun add -g @suparun/cli
suparun init          # enables the --hard flag in your shell
```

## Usage

```bash
bun run dev --hard              # watchdog mode (works with npm/yarn/pnpm too)
bun run build --hard            # auto-retry on failure (3 attempts)
suparun dev --port 4000         # direct usage with port override
suparun dev --no-vhost          # disable virtual host proxy
suparun uninstall               # remove shell hooks
```

Port is auto-detected from package.json scripts, `PORT` env, `.env` files, or framework defaults (Next.js → 3000, Vite → 5173, Astro → 4321).

## Virtual Hosts

When running in a monorepo, suparun automatically registers virtual hosts so you can access your apps by name:

```
http://myapp.localhost:2999      → localhost:3000
http://monorepo.api.localhost:2999 → localhost:4000
```

A lightweight Bun reverse proxy runs on port 2999 and routes based on `~/.config/suparun/vhosts.json`. Supports HTTP and WebSocket (HMR).

Disable with `--no-vhost` or set `SUPARUN_SKIP_PROXY=1`.

## Desktop App

There's also an optional [Electron desktop app](https://www.npmjs.com/package/@suparun/app) with a visual dashboard. Installing it also installs the CLI:

```bash
bun add -g @suparun/app
```

## License

[MIT](https://github.com/LivioGama/suparun/blob/main/LICENSE)
