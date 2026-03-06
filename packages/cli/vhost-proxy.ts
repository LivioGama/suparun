/**
 * vhost-proxy.ts — Bun reverse proxy for suparun vhosts
 *
 * Routes *.localhost:2999 → localhost:<port> based on vhosts.json
 * Supports HTTP + WebSocket (HMR)
 */

import { watch, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"
import { join } from "path"

const VHOST_DIR = join(process.env.HOME!, ".config", "suparun")
const VHOST_FILE = join(VHOST_DIR, "vhosts.json")
const PID_FILE = join(VHOST_DIR, "proxy.pid")
const PROXY_PORT = 2999

type VhostEntry = { port: number; pid: number; cwd: string }
type VhostMap = Record<string, VhostEntry>

let vhosts: VhostMap = {}

const loadVhosts = () => {
  try {
    if (existsSync(VHOST_FILE)) {
      vhosts = JSON.parse(readFileSync(VHOST_FILE, "utf-8"))
    }
  } catch {
    vhosts = {}
  }
}

const purgeStale = () => {
  loadVhosts()
  let changed = false
  for (const [name, entry] of Object.entries(vhosts)) {
    try {
      process.kill(entry.pid, 0)
    } catch {
      delete vhosts[name]
      changed = true
    }
  }
  if (changed) {
    writeFileSync(VHOST_FILE, JSON.stringify(vhosts, null, 2))
  }
}

// Initial load + stale purge
purgeStale()

// Watch for changes
try {
  watch(VHOST_FILE, () => loadVhosts())
} catch {
  // File may not exist yet, poll instead
  setInterval(loadVhosts, 2000)
}

// Write PID file
writeFileSync(PID_FILE, String(process.pid))

const cleanup = () => {
  try { unlinkSync(PID_FILE) } catch {}
  process.exit(0)
}
process.on("SIGTERM", cleanup)
process.on("SIGINT", cleanup)

const notFoundPage = () => {
  const entries = Object.entries(vhosts)
  const links = entries.length > 0
    ? entries.map(([name, e]) =>
        `<li><a href="http://${name}.localhost:${PROXY_PORT}">${name}.localhost:${PROXY_PORT}</a></li>`
      ).join("\n")
    : "<li>No active vhosts</li>"

  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>suparun vhosts</title>
<style>
  body { font-family: system-ui; max-width: 600px; margin: 60px auto; color: #e0e0e0; background: #1a1a2e; }
  a { color: #64ffda; } h1 { color: #fff; } ul { line-height: 2; }
</style></head>
<body><h1>suparun vhosts</h1><ul>${links}</ul></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html" } }
  )
}

const resolveHost = (host: string | null): VhostEntry | null => {
  if (!host) return null
  // Strip port suffix
  const hostname = host.split(":")[0]
  // Extract subdomain(s) from *.localhost (supports dotted names like monorepo.app.localhost)
  const match = hostname.match(/^(.+)\.localhost$/)
  if (!match) return null
  return vhosts[match[1]] ?? null
}

const server = Bun.serve({
  port: PROXY_PORT,
  hostname: "::",
  idleTimeout: 255,

  async fetch(req, server) {
    const entry = resolveHost(req.headers.get("host"))
    if (!entry) return notFoundPage()

    // WebSocket upgrade
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const ok = server.upgrade(req, { data: { target: `ws://localhost:${entry.port}` } })
      return ok ? undefined : new Response("WebSocket upgrade failed", { status: 500 })
    }

    // HTTP proxy
    const url = new URL(req.url)
    const target = `http://localhost:${entry.port}${url.pathname}${url.search}`

    try {
      const headers = new Headers(req.headers)
      headers.delete("host")
      headers.set("X-Forwarded-Host", req.headers.get("host") || url.hostname)
      headers.set("X-Forwarded-Proto", "http")

      // Remove accept-encoding so backend sends uncompressed (Bun auto-decompresses anyway)
      headers.delete("accept-encoding")

      const resp = await fetch(target, {
        method: req.method,
        headers,
        body: req.body,
        redirect: "manual",
      })

      // Copy headers but strip content-encoding/content-length (body may differ after proxy)
      const respHeaders = new Headers(resp.headers)
      respHeaders.delete("content-encoding")
      respHeaders.delete("content-length")
      respHeaders.delete("transfer-encoding")

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      })
    } catch {
      return new Response(`Backend localhost:${entry.port} unreachable`, { status: 502 })
    }
  },

  websocket: {
    open(ws) {
      const target = (ws.data as { target: string }).target
      const backend = new WebSocket(target)

      backend.addEventListener("message", (ev) => {
        try { ws.send(ev.data as string | Buffer) } catch {}
      })
      backend.addEventListener("close", () => ws.close())
      backend.addEventListener("error", () => ws.close())

      ws.data = { target, backend }
    },
    message(ws, msg) {
      const { backend } = ws.data as { backend: WebSocket }
      if (backend.readyState === WebSocket.OPEN) {
        backend.send(msg)
      }
    },
    close(ws) {
      const { backend } = ws.data as { backend: WebSocket }
      try { backend.close() } catch {}
    },
  },
})

console.log(`[suparun] vhost proxy listening on http://localhost:${server.port}`)
