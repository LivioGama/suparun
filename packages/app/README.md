<p align="center">
  <h1 align="center">⚡ suparun — Desktop App</h1>
  <p align="center"><strong>Visual dashboard for the suparun watchdog daemon.</strong></p>
  <p align="center">
    <a href="https://github.com/LivioGama/suparun/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
    <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="Platform" />
  </p>
</p>

---

Optional Electron app that provides a visual interface for [suparun](https://www.npmjs.com/package/@suparun/cli).

<p align="center">
  <img src="https://raw.githubusercontent.com/LivioGama/suparun/main/packages/app/screenshot.webp" alt="Suparun GUI — project dashboard" width="800" />
</p>

## Features

- One-click start/stop for all your projects
- Live port status, uptime badges, and log viewer
- Virtual host links (e.g. `myapp.localhost:2999`)
- System tray with global shortcut (`Cmd+Shift+S`)
- macOS crash notifications
- Processes survive app restarts
- Open in your favorite editor or AI coding tool

## Run Modes

### Electron Desktop App (Recommended)

Download from [Releases](https://github.com/LivioGama/suparun/releases), or build from source:

```bash
git clone https://github.com/LivioGama/suparun.git
cd suparun && bun install
bun run --filter @suparun/app build:mac
```

For development:

```bash
bun run --filter @suparun/app dev:electron
```

### Web Browser Mode

Run the same UI in your browser — no Electron required:

```bash
bun run --filter @suparun/app dev:web
```

Opens at `http://localhost:3008`. Backend API runs on port 3007.

The CLI watchdog is available separately: `bun add -g @suparun/cli`

## Usage

Add project folders in the app, then click the play button to start any `dev` or `start` script with suparun's watchdog protection.

## What is suparun?

A **watchdog daemon** that guards your dev server port, auto-revives crashed processes, adopts servers started by other tools, and HTTP-pings to detect hung processes. Never restart `bun run dev` again.

See the [CLI package](https://www.npmjs.com/package/@suparun/cli) for full documentation.

## License

[MIT](https://github.com/LivioGama/suparun/blob/main/LICENSE)
