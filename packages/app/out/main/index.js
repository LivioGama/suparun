"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const url = require("url");
const child_process = require("child_process");
const node_fs = require("node:fs");
const node_path = require("node:path");
const fg = require("fast-glob");
const node_events = require("node:events");
const node_child_process = require("node:child_process");
const node_crypto = require("node:crypto");
const node_os = require("node:os");
const treeKill = require("tree-kill");
const IPC_CHANNELS = [
  "get-detected-projects",
  "start-process",
  "stop-process",
  "restart-process",
  "get-running-processes",
  "get-log-buffer",
  "get-settings",
  "update-settings",
  "get-history",
  "remove-history",
  "clear-history",
  "open-in-browser",
  "open-in-finder",
  "add-folder",
  "remove-folder",
  "open-folder-picker",
  "hide-overlay",
  "resize-window",
  "show-context-menu",
  "open-in-editor",
  "open-in-claude-code"
];
let registered = false;
const registerIpcHandlers = ({
  processManager: processManager2,
  settings: settings2,
  history: history2,
  window: win,
  getCurrentProjects: getCurrentProjects2
}) => {
  if (registered) {
    for (const ch of IPC_CHANNELS) electron.ipcMain.removeHandler(ch);
  }
  registered = true;
  electron.ipcMain.handle("show-context-menu", async () => {
    const { showContextMenu: showContextMenu2 } = await Promise.resolve().then(() => index);
    showContextMenu2();
  });
  electron.ipcMain.handle("get-detected-projects", async () => {
    const projects = getCurrentProjects2();
    console.log(`[suparun] get-detected-projects called, returning ${projects.length} projects`);
    return projects;
  });
  electron.ipcMain.handle("start-process", async (_event, projectPath, scriptName, packageManager) => {
    return processManager2.start(projectPath, scriptName, packageManager);
  });
  electron.ipcMain.handle("stop-process", async (_event, processId) => {
    processManager2.stop(processId);
  });
  electron.ipcMain.handle("restart-process", async (_event, processId) => {
    return processManager2.restart(processId);
  });
  electron.ipcMain.handle("get-running-processes", async () => {
    return processManager2.getRunningProcesses();
  });
  electron.ipcMain.handle("get-log-buffer", async (_event, processId) => {
    return processManager2.getLogBuffer(processId);
  });
  electron.ipcMain.handle("get-settings", async () => {
    return settings2.get();
  });
  electron.ipcMain.handle("update-settings", async (_event, partial) => {
    const updated = settings2.update(partial);
    if ("launchAtLogin" in partial) {
      electron.app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin });
    }
    return updated;
  });
  electron.ipcMain.handle("get-history", async () => {
    return history2.getAll();
  });
  electron.ipcMain.handle("remove-history", async (_event, path2) => {
    history2.remove(path2);
  });
  electron.ipcMain.handle("clear-history", async () => {
    history2.clear();
  });
  electron.ipcMain.handle("open-in-browser", async (_event, port, vhostName) => {
    const url2 = vhostName ? `http://${vhostName}.localhost:2999` : `http://localhost:${port}`;
    console.log("[IPC] open-in-browser called with port:", port, "vhost:", vhostName, "→", url2);
    try {
      await electron.shell.openExternal(url2);
    } catch (err) {
      console.error("[IPC] shell.openExternal failed:", err);
      child_process.exec(`open "${url2}"`);
    }
  });
  electron.ipcMain.handle("open-in-finder", async (_event, folderPath) => {
    child_process.exec(`open "${folderPath}"`);
  });
  electron.ipcMain.handle("open-in-editor", async (_event, folderPath) => {
    const editor = settings2.get().favoriteEditor || "code";
    child_process.exec(`${editor} "${folderPath}"`);
  });
  electron.ipcMain.handle("open-in-claude-code", async (_event, folderPath) => {
    const s = settings2.get();
    const tool = s.terminalCodingTool || "claude";
    const safePath = folderPath.replace(/"/g, '\\"');
    const tmpScript = `/tmp/suparun-${tool}-${Date.now()}.command`;
    let command;
    if (tool === "jimmy") {
      const apiKey = s.jimmyApiKey || "";
      command = `export JIMMY_API_KEY="${apiKey}" && npx jimmy`;
    } else {
      command = tool;
    }
    child_process.exec(`printf '#!/bin/bash\\ncd "${safePath}" && exec ${command}\\n' > "${tmpScript}" && chmod +x "${tmpScript}" && open "${tmpScript}"`);
  });
  electron.ipcMain.handle("add-folder", async (_event, folderPath) => {
    const { addFolder: addFolder2 } = await Promise.resolve().then(() => index);
    return addFolder2(folderPath);
  });
  electron.ipcMain.handle("remove-folder", async (_event, folderPath) => {
    const { removeFolder: removeFolder2 } = await Promise.resolve().then(() => index);
    return removeFolder2(folderPath);
  });
  electron.ipcMain.handle("open-folder-picker", async () => {
    const { openFolderPicker: openFolderPicker2 } = await Promise.resolve().then(() => index);
    return openFolderPicker2();
  });
  electron.ipcMain.handle("hide-overlay", async () => {
    const { hideOverlay: hideOverlay2 } = await Promise.resolve().then(() => index);
    hideOverlay2();
  });
  electron.ipcMain.handle("resize-window", async (_event, width, height) => {
    if (win) {
      const bounds = win.getBounds();
      const display = electron.screen.getDisplayMatching(bounds);
      const { x, y, width: dw, height: dh } = display.workArea;
      const newW = Math.round(width);
      const newH = Math.round(height);
      win.setBounds({
        x: Math.round(x + (dw - newW) / 2),
        y: Math.round(y + (dh - newH) / 2),
        width: newW,
        height: newH
      }, true);
    }
  });
  electron.ipcMain.handle("get-screen-width", async () => {
    if (!win) return 1920;
    const display = electron.screen.getDisplayMatching(win.getBounds());
    return display.workAreaSize.width;
  });
  if (win) {
    let lastDisplayId = electron.screen.getDisplayMatching(win.getBounds()).id;
    win.on("moved", () => {
      const currentDisplay = electron.screen.getDisplayMatching(win.getBounds());
      if (currentDisplay.id !== lastDisplayId) {
        lastDisplayId = currentDisplay.id;
        win.webContents.send("screen-changed", currentDisplay.workAreaSize.width);
      }
    });
  }
};
const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", ".next", "dist", "build"]);
const MAX_DEPTH = 3;
const MAX_PACKAGES = 50;
const MAX_RECURSIVE_SCAN_DEPTH = 4;
const FRAMEWORK_DEPS = [
  ["next", "next"],
  ["vite", "vite"],
  ["astro", "astro"],
  ["@remix-run/react", "remix"],
  ["nuxt", "nuxt"],
  ["svelte", "svelte"],
  ["@sveltejs/kit", "svelte"],
  ["expo", "expo"]
];
class PackageScanner {
  settingsStore;
  constructor(settingsStore) {
    this.settingsStore = settingsStore;
  }
  scan = async (folderPath) => {
    const resolvedPath = node_path.resolve(folderPath);
    const rootPath = this.findProjectRoot(resolvedPath);
    if (!rootPath) {
      console.log(`[suparun] PackageScanner: no project root found for ${resolvedPath}`);
      return [];
    }
    console.log(`[suparun] PackageScanner: scanning ${rootPath}`);
    const pkgPath = node_path.join(rootPath, "package.json");
    if (!node_fs.existsSync(pkgPath)) {
      console.log(`[suparun] PackageScanner: no package.json at ${pkgPath}`);
      return [];
    }
    const pkg = this.readPackageJson(pkgPath);
    if (!pkg) {
      console.log(`[suparun] PackageScanner: failed to read/parse ${pkgPath}`);
      return [];
    }
    const workspacePatterns = pkg.workspaces;
    const isMonorepo = Array.isArray(workspacePatterns) && workspacePatterns.length > 0;
    if (isMonorepo) {
      console.log(`[suparun] PackageScanner: detected monorepo at ${rootPath}`);
      return [await this.scanMonorepo(rootPath, pkg, workspacePatterns)];
    }
    const project = this.buildProject(rootPath, pkg);
    const nestedProjects = await this.scanNestedPackages(rootPath);
    if (nestedProjects.length > 0) {
      console.log(`[suparun] PackageScanner: detected nested packages in ${rootPath}`);
      return [
        {
          ...project,
          isMonorepo: true,
          workspaces: nestedProjects
        }
      ];
    }
    console.log(`[suparun] PackageScanner: found single project ${project.name}`);
    return [project];
  };
  findProjectRoot = (startPath) => {
    let current = startPath;
    let depth = 0;
    if (node_fs.existsSync(node_path.join(current, "package.json"))) {
      return current;
    }
    try {
      const entries = node_fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          const childPath = node_path.join(current, entry.name);
          if (node_fs.existsSync(node_path.join(childPath, "package.json"))) {
            return childPath;
          }
          try {
            const grandEntries = node_fs.readdirSync(childPath, { withFileTypes: true });
            for (const grand of grandEntries) {
              if (grand.isDirectory() && !SKIP_DIRS.has(grand.name)) {
                const grandPath = node_path.join(childPath, grand.name);
                if (node_fs.existsSync(node_path.join(grandPath, "package.json"))) {
                  return grandPath;
                }
              }
            }
          } catch {
          }
        }
      }
    } catch (e) {
      console.error(`[suparun] PackageScanner: error reading directory ${current}`, e);
    }
    while (depth < MAX_DEPTH) {
      const parent = node_path.dirname(current);
      if (parent === current) break;
      if (node_fs.existsSync(node_path.join(parent, "package.json"))) {
        return parent;
      }
      current = parent;
      depth++;
    }
    return null;
  };
  scanMonorepo = async (rootPath, rootPkg, workspacePatterns) => {
    const workspaceGlobs = workspacePatterns.map((pattern) => {
      if (pattern.endsWith("/package.json")) return pattern;
      if (pattern.endsWith("/")) return `${pattern}package.json`;
      return `${pattern}/package.json`;
    });
    const packageJsonPaths = await fg(workspaceGlobs, {
      cwd: rootPath,
      absolute: true,
      deep: MAX_RECURSIVE_SCAN_DEPTH,
      ignore: [...SKIP_DIRS].map((d) => `**/${d}/**`)
    });
    const rootPm = this.detectPackageManager(rootPath);
    const workspaces = [];
    for (const pkgJsonPath of packageJsonPaths.slice(0, MAX_PACKAGES)) {
      const pkg = this.readPackageJson(pkgJsonPath);
      if (!pkg) continue;
      const projectPath = node_path.dirname(pkgJsonPath);
      const ownPm = this.detectPackageManager(projectPath);
      const project = this.buildProject(projectPath, pkg, ownPm !== "npm" ? ownPm : rootPm);
      if (project.scripts.length > 0) {
        workspaces.push(project);
      }
    }
    const rootProject = this.buildProject(rootPath, rootPkg, rootPm);
    return {
      ...rootProject,
      isMonorepo: true,
      workspaces
    };
  };
  buildProject = (projectPath, pkg, parentPm) => {
    const scripts = this.filterScripts(pkg.scripts);
    const framework = this.detectFramework(pkg);
    const packageManager = parentPm ?? this.detectPackageManager(projectPath);
    return {
      path: projectPath,
      name: pkg.name || node_path.basename(projectPath),
      scripts,
      framework,
      packageManager,
      isMonorepo: false,
      workspaces: [],
      iconPath: this.resolveIcon(projectPath)
    };
  };
  scanNestedPackages = async (rootPath) => {
    const rootPackageJsonPath = node_path.join(rootPath, "package.json");
    const packageJsonPaths = await fg("**/package.json", {
      cwd: rootPath,
      absolute: true,
      deep: MAX_RECURSIVE_SCAN_DEPTH,
      ignore: [...SKIP_DIRS].map((d) => `**/${d}/**`)
    });
    const nested = [];
    for (const pkgJsonPath of packageJsonPaths.slice(0, MAX_PACKAGES)) {
      if (pkgJsonPath === rootPackageJsonPath) continue;
      const pkg = this.readPackageJson(pkgJsonPath);
      if (!pkg) continue;
      const projectPath = node_path.dirname(pkgJsonPath);
      const project = this.buildProject(projectPath, pkg);
      if (project.scripts.length > 0) {
        nested.push(project);
      }
    }
    return nested;
  };
  filterScripts = (scripts) => {
    if (!scripts) return [];
    const allowedNames = this.settingsStore.get().scriptNames;
    const filtered = Object.entries(scripts).filter(([name]) => allowedNames.includes(name)).map(([name, command]) => ({ name, command }));
    if (filtered.length > 0) return filtered;
    return Object.entries(scripts).map(([name, command]) => ({ name, command }));
  };
  detectFramework = (pkg) => {
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };
    for (const [depName, framework] of FRAMEWORK_DEPS) {
      if (deps[depName]) return framework;
    }
    return null;
  };
  detectPackageManager = (projectPath) => {
    if (node_fs.existsSync(node_path.join(projectPath, "bun.lock")) || node_fs.existsSync(node_path.join(projectPath, "bun.lockb"))) return "bun";
    if (node_fs.existsSync(node_path.join(projectPath, "yarn.lock"))) return "yarn";
    if (node_fs.existsSync(node_path.join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
    if (node_fs.existsSync(node_path.join(projectPath, "package-lock.json"))) return "npm";
    return "npm";
  };
  resolveIcon = (projectPath) => {
    const names = ["logo", "icon", "favicon"];
    const exts = [".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp"];
    const dirs = [
      "public",
      "public/assets",
      "src/assets",
      "assets",
      "app",
      "src/app",
      "public/images",
      "public/img",
      "static",
      "static/images",
      "static/assets",
      "resources",
      "src/images",
      "img"
    ];
    for (const dir of dirs) {
      for (const name of names) {
        for (const ext of exts) {
          const fullPath = node_path.join(projectPath, dir, `${name}${ext}`);
          if (node_fs.existsSync(fullPath)) return fullPath;
        }
      }
    }
    const workspaceDirs = ["apps", "packages", "services"];
    for (const wsDir of workspaceDirs) {
      const wsRoot = node_path.join(projectPath, wsDir);
      if (!node_fs.existsSync(wsRoot)) continue;
      try {
        const children = node_fs.readdirSync(wsRoot, { withFileTypes: true });
        for (const child of children) {
          if (!child.isDirectory()) continue;
          for (const dir of dirs) {
            for (const name of names) {
              for (const ext of exts) {
                const fullPath = node_path.join(wsRoot, child.name, dir, `${name}${ext}`);
                if (node_fs.existsSync(fullPath)) return fullPath;
              }
            }
          }
        }
      } catch {
      }
    }
    return null;
  };
  readPackageJson = (pkgPath) => {
    try {
      const raw = node_fs.readFileSync(pkgPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
}
const FRAMEWORK_DEFAULTS = {
  next: 3e3,
  vite: 5173,
  astro: 4321,
  remix: 3e3
};
const FRAMEWORK_CONFIG_FILES = [
  [["next.config.ts", "next.config.mjs", "next.config.js"], "next"],
  [["vite.config.ts", "vite.config.js", "vite.config.mjs"], "vite"],
  [["astro.config.mjs", "astro.config.ts"], "astro"],
  [["remix.config.js", "remix.config.ts"], "remix"]
];
class PortDetector {
  detectPort = (projectPath, scriptName) => {
    const portFromScript = this.extractPortFromScript(projectPath, scriptName);
    if (portFromScript) return portFromScript;
    const portFromEnv = this.extractPortFromEnvFiles(projectPath);
    if (portFromEnv) return portFromEnv;
    const portFromFramework = this.detectFrameworkPort(projectPath);
    if (portFromFramework) return portFromFramework;
    return 3020;
  };
  extractPortFromScript = (projectPath, scriptName) => {
    const pkgPath = node_path.join(projectPath, "package.json");
    if (!node_fs.existsSync(pkgPath)) return null;
    try {
      const pkg = JSON.parse(node_fs.readFileSync(pkgPath, "utf-8"));
      const scriptCmd = pkg.scripts?.[scriptName] || "";
      const portMatch = scriptCmd.match(/--port\s+(\d+)/);
      if (portMatch) return Number.parseInt(portMatch[1], 10);
      const pMatch = scriptCmd.match(/-p\s+(\d+)/);
      if (pMatch) return Number.parseInt(pMatch[1], 10);
      const envPortMatch = scriptCmd.match(/\bPORT=(\d+)/);
      if (envPortMatch) return Number.parseInt(envPortMatch[1], 10);
    } catch {
    }
    return null;
  };
  extractPortFromEnvFiles = (projectPath) => {
    const envFiles = [".env.local", ".env.development", ".env"];
    for (const envFile of envFiles) {
      const envPath = node_path.join(projectPath, envFile);
      if (!node_fs.existsSync(envPath)) continue;
      try {
        const content = node_fs.readFileSync(envPath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const match = line.match(/^PORT=["']?(\d+)["']?/);
          if (match) return Number.parseInt(match[1], 10);
          const variantMatch = line.match(/^[A-Z_]*PORT=["']?(\d+)["']?/);
          if (variantMatch) return Number.parseInt(variantMatch[1], 10);
        }
      } catch {
      }
    }
    return null;
  };
  detectFrameworkPort = (projectPath) => {
    for (const [configFiles, framework] of FRAMEWORK_CONFIG_FILES) {
      for (const configFile of configFiles) {
        if (node_fs.existsSync(node_path.join(projectPath, configFile))) {
          return FRAMEWORK_DEFAULTS[framework] ?? null;
        }
      }
    }
    return null;
  };
}
const LOG_BATCH_INTERVAL = 100;
const HEALTH_CHECK_INTERVAL = 2e3;
const KILL_GRACE_PERIOD = 3e3;
const EXTERNAL_SCAN_INTERVAL = 5e3;
const STATE_DIR = node_path.join(node_os.homedir(), ".config", "suparun");
const STATE_FILE = node_path.join(STATE_DIR, "processes.json");
const LOG_DIR = node_path.join(node_os.homedir(), ".suparun", "logs");
const LOG_FILE = node_path.join(LOG_DIR, "process-manager.log");
const log = (message) => {
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const line = `[${ts}] ${message}
`;
  try {
    if (!node_fs.existsSync(LOG_DIR)) node_fs.mkdirSync(LOG_DIR, { recursive: true });
    node_fs.appendFileSync(LOG_FILE, line, "utf-8");
  } catch {
  }
};
class ProcessManager extends node_events.EventEmitter {
  processes = /* @__PURE__ */ new Map();
  portDetector = new PortDetector();
  settingsStore;
  logBatchQueue = [];
  logFlushTimer = null;
  externalScanTimer = null;
  suparunPath = "suparun";
  shellPath = process.env.PATH || "";
  disposed = false;
  pendingAdoptionPids = /* @__PURE__ */ new Set();
  proxyChild = null;
  constructor(settingsStore) {
    super();
    this.settingsStore = settingsStore;
    this.initShellEnv();
    this.logFlushTimer = setInterval(() => this.flushLogs(), LOG_BATCH_INTERVAL);
    this.externalScanTimer = setInterval(() => this.scanExternalProcesses(), EXTERNAL_SCAN_INTERVAL);
  }
  /** Re-attach to suparun processes that survived a UI restart */
  reattach = async () => {
    const saved = this.loadState();
    log(`reattach: found ${saved.length} saved processes`);
    if (saved.length === 0) return;
    for (const entry of saved) {
      if (!this.isPidAlive(entry.pid)) {
        log(`reattach: ${entry.projectName}:${entry.scriptName} pid=${entry.pid} is dead, skipping`);
        continue;
      }
      log(`reattach: ${entry.projectName}:${entry.scriptName} pid=${entry.pid} port=${entry.port} — re-attaching`);
      const proc = {
        id: entry.id,
        projectPath: entry.projectPath,
        projectName: entry.projectName,
        scriptName: entry.scriptName,
        packageManager: entry.packageManager,
        child: null,
        pid: entry.pid,
        port: entry.port,
        status: entry.port ? this.isPortAliveSync(entry.port) ? "running" : "starting" : "running",
        startedAt: entry.startedAt,
        crashCount: 0,
        logBuffer: [],
        healthTimer: null
      };
      this.processes.set(entry.id, proc);
      proc.healthTimer = setInterval(() => this.checkReattachedHealth(proc), HEALTH_CHECK_INTERVAL);
      this.emitStatusChanged(proc);
    }
    this.saveState();
    if (this.processes.size > 0) this.ensureVhostProxy();
  };
  /** Start a script via the suparun CLI watchdog */
  start = async (projectPath, scriptName, _packageManager = "npm") => {
    log(`start: projectPath=${projectPath} script=${scriptName} pm=${_packageManager}`);
    const existing = this.findExisting(projectPath, scriptName);
    if (existing) {
      log(`start: already exists id=${existing.id} status=${existing.status} port=${existing.port}`);
      return this.toManagedProcess(existing);
    }
    const id = node_crypto.randomUUID();
    const projectName = projectPath.split("/").pop() || projectPath;
    const idealPort = this.portDetector.detectPort(projectPath, scriptName);
    const detectedPort = this.findAvailablePort(idealPort);
    log(`start: id=${id} idealPort=${idealPort} detectedPort=${detectedPort}`);
    const suparunBin = this.resolveSuparunBin();
    const args = [suparunBin, scriptName, "--port", String(detectedPort)];
    if (!this.settingsStore.get().vhostEnabled) {
      args.push("--no-vhost");
    }
    log(`start: spawning bash ${args.join(" ")} in ${projectPath}`);
    const child = node_child_process.spawn("bash", args, {
      cwd: projectPath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env, FORCE_COLOR: "1", PATH: this.shellPath, SUPARUN_SKIP_PROXY: "1" }
    });
    child.unref();
    if (!child.pid) {
      log(`start: spawn failed — child.pid is undefined`);
      const failedProc = {
        id,
        projectPath,
        projectName,
        scriptName,
        packageManager: _packageManager,
        child: null,
        pid: 0,
        port: detectedPort,
        status: "crashed",
        startedAt: Date.now(),
        crashCount: 1,
        logBuffer: [],
        healthTimer: null
      };
      this.emitStatusChanged(failedProc);
      return this.toManagedProcess(failedProc);
    }
    const proc = {
      id,
      projectPath,
      projectName,
      scriptName,
      packageManager: _packageManager,
      child,
      pid: child.pid,
      port: detectedPort,
      status: "starting",
      startedAt: Date.now(),
      crashCount: 0,
      logBuffer: [],
      healthTimer: null
    };
    this.processes.set(id, proc);
    this.emitStatusChanged(proc);
    this.saveState();
    log(`start: spawned pid=${child.pid}`);
    child.stdout?.on("data", (data) => {
      this.processOutput(proc, data, "stdout");
      const text = data.toString("utf-8");
      log(`stdout[${proc.projectName}:${proc.scriptName}]: ${text.substring(0, 200).replace(/\n/g, "\\n")}`);
      if (proc.status === "starting" && !text.match(/\w\.localhost:\d+/)) {
        const portMatch = text.match(
          /(?:guarding|on)\s+port\s+(\d+)|localhost:(\d+)|127\.0\.0\.1:(\d+)|listening\s+on\s+(?:port\s+)?:?(\d+)|started\s+on\s+:(\d+)/i
        );
        if (portMatch) {
          const detectedPort2 = Number.parseInt(portMatch[1] || portMatch[2] || portMatch[3] || portMatch[4] || portMatch[5], 10);
          log(`stdout: port detected: ${detectedPort2} (was port=${proc.port})`);
          proc.port = detectedPort2;
          if (text.match(/guarding/i)) {
            this.emitStatusChanged(proc);
            this.saveState();
          } else {
            proc.status = "running";
            this.emitStatusChanged(proc);
            this.saveState();
          }
        }
      }
    });
    child.stderr?.on("data", (data) => {
      this.processOutput(proc, data, "stderr");
      const text = data.toString("utf-8");
      log(`stderr[${proc.projectName}:${proc.scriptName}]: ${text.substring(0, 200).replace(/\n/g, "\\n")}`);
    });
    child.on("exit", (code) => {
      log(`exit[${proc.projectName}:${proc.scriptName}]: code=${code} status=${proc.status}`);
      this.clearTimer(proc);
      if (this.isTerminal(proc.status)) return;
      this.markTerminated(proc, code === 0 ? "stopped" : "crashed");
    });
    child.on("error", (err) => {
      log(`error[${proc.projectName}:${proc.scriptName}]: ${err.message}`);
      console.error(`[process-manager] Failed to spawn suparun:`, err);
      this.markTerminated(proc, "crashed");
    });
    proc.healthTimer = setInterval(() => {
      if (proc.port) this.checkPortHealth(proc);
    }, HEALTH_CHECK_INTERVAL);
    this.ensureVhostProxy();
    return this.toManagedProcess(proc);
  };
  stop = (processId) => {
    const proc = this.processes.get(processId);
    if (!proc) {
      log(`stop: id=${processId} not found`);
      return;
    }
    log(`stop: ${proc.projectName}:${proc.scriptName} pid=${proc.pid} port=${proc.port}`);
    this.clearTimer(proc);
    proc.status = "stopped";
    this.emitStatusChanged(proc);
    this.killPid(proc.pid);
    this.processes.delete(processId);
    this.saveState();
    this.stopVhostProxy();
  };
  restart = async (processId) => {
    const proc = this.processes.get(processId);
    if (!proc) throw new Error(`Process ${processId} not found`);
    const { projectPath, scriptName, packageManager } = proc;
    this.stop(processId);
    return this.start(projectPath, scriptName, packageManager);
  };
  getRunningProcesses = () => {
    return Array.from(this.processes.values()).map(this.toManagedProcess);
  };
  getLogBuffer = (processId) => {
    const proc = this.processes.get(processId);
    if (!proc) return [];
    return [...proc.logBuffer];
  };
  /** Disconnect from all processes without killing them — they survive UI restart */
  disconnectAll = () => {
    this.disposed = true;
    if (this.logFlushTimer) {
      clearInterval(this.logFlushTimer);
      this.logFlushTimer = null;
    }
    if (this.externalScanTimer) {
      clearInterval(this.externalScanTimer);
      this.externalScanTimer = null;
    }
    for (const proc of this.processes.values()) {
      this.clearTimer(proc);
      if (proc.child) proc.child.unref();
    }
    this.processes.clear();
  };
  /** Kill all processes — used for explicit "stop all" */
  killAll = () => {
    this.disposed = true;
    if (this.logFlushTimer) {
      clearInterval(this.logFlushTimer);
      this.logFlushTimer = null;
    }
    if (this.externalScanTimer) {
      clearInterval(this.externalScanTimer);
      this.externalScanTimer = null;
    }
    for (const [, proc] of this.processes) {
      this.clearTimer(proc);
      this.killPid(proc.pid);
    }
    this.processes.clear();
    this.saveState();
  };
  // ─── State persistence ──────────────────────────────────────────
  saveState = () => {
    const entries = [];
    for (const proc of this.processes.values()) {
      if (proc.status === "stopped") continue;
      entries.push({
        id: proc.id,
        projectPath: proc.projectPath,
        projectName: proc.projectName,
        scriptName: proc.scriptName,
        packageManager: proc.packageManager,
        pid: proc.pid,
        port: proc.port,
        startedAt: proc.startedAt
      });
    }
    try {
      if (!node_fs.existsSync(STATE_DIR)) node_fs.mkdirSync(STATE_DIR, { recursive: true });
      node_fs.writeFileSync(STATE_FILE, JSON.stringify(entries, null, 2), "utf-8");
    } catch (err) {
      console.error("[process-manager] Failed to save state:", err);
    }
  };
  loadState = () => {
    try {
      if (node_fs.existsSync(STATE_FILE)) return JSON.parse(node_fs.readFileSync(STATE_FILE, "utf-8"));
    } catch (err) {
      console.error("[process-manager] Failed to load state:", err);
    }
    return [];
  };
  isPidAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  /** Synchronous port-alive check for reattach — avoids showing 'starting' when port is already up */
  isPortAliveSync = (port) => {
    try {
      const result = node_child_process.execFileSync("lsof", ["-ti", `:${port}`], { timeout: 2e3, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      return result.trim().length > 0;
    } catch {
      return false;
    }
  };
  // ─── Internal ───────────────────────────────────────────────────
  initShellEnv = () => {
    for (const shell of ["bash", "zsh"]) {
      try {
        const result = node_child_process.execFileSync(shell, ["-lc", "echo $PATH"], {
          timeout: 5e3,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"]
        }).trim();
        if (result && result.length > this.shellPath.length) {
          this.shellPath = result;
          log(`initShellEnv[${shell}]: resolved PATH (${result.split(":").length} entries)`);
        }
      } catch (e) {
        log(`initShellEnv[${shell}]: failed: ${e.message}`);
      }
    }
    const knownDirs = [
      node_path.join(node_os.homedir(), ".nvm/versions/node"),
      node_path.join(node_os.homedir(), ".bun/bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin"
    ];
    for (const base of knownDirs) {
      if (!node_fs.existsSync(base)) continue;
      if (base.includes(".nvm")) {
        try {
          const versions = node_fs.readdirSync(base);
          for (const v of versions) {
            const binDir = node_path.join(base, v, "bin");
            if (node_fs.existsSync(binDir) && !this.shellPath.includes(binDir)) {
              this.shellPath = `${binDir}:${this.shellPath}`;
              log(`initShellEnv: added NVM bin: ${binDir}`);
            }
          }
        } catch {
        }
      } else if (!this.shellPath.includes(base)) {
        this.shellPath = `${base}:${this.shellPath}`;
      }
    }
  };
  resolveSuparunBin = () => {
    if (this.suparunPath !== "suparun") return this.suparunPath;
    for (const dir of this.shellPath.split(":")) {
      if (!dir) continue;
      const candidate = node_path.join(dir, "suparun");
      try {
        const stat = node_fs.lstatSync(candidate);
        if (stat.isSymbolicLink()) {
          try {
            node_fs.realpathSync(candidate);
          } catch {
            continue;
          }
        }
        log(`resolveSuparunBin: found at ${candidate}`);
        this.suparunPath = candidate;
        return candidate;
      } catch {
        continue;
      }
    }
    if (process.resourcesPath) {
      const packaged = node_path.join(process.resourcesPath, "cli", "suparun.sh");
      if (node_fs.existsSync(packaged)) {
        log(`resolveSuparunBin: using packaged CLI at ${packaged}`);
        this.suparunPath = packaged;
        return packaged;
      }
    }
    const bundled = node_path.join(__dirname, "../../../cli/suparun.sh");
    if (node_fs.existsSync(bundled)) {
      log(`resolveSuparunBin: using bundled CLI at ${bundled}`);
      this.suparunPath = bundled;
      return bundled;
    }
    log('resolveSuparunBin: not found, falling back to "suparun"');
    return "suparun";
  };
  ensureVhostProxy = () => {
    if (!this.settingsStore.get().vhostEnabled) return;
    if (this.proxyChild && !this.proxyChild.killed) {
      try {
        process.kill(this.proxyChild.pid, 0);
        return;
      } catch {
      }
    }
    const pidFile = node_path.join(node_os.homedir(), ".config", "suparun", "proxy.pid");
    try {
      const pid2 = parseInt(node_fs.readFileSync(pidFile, "utf-8").trim(), 10);
      if (pid2) {
        process.kill(pid2, 0);
        log("ensureVhostProxy: already running (pid file)");
        return;
      }
    } catch {
    }
    const suparunBin = this.resolveSuparunBin();
    let proxyScript;
    try {
      const realBin = node_fs.realpathSync(suparunBin);
      proxyScript = node_path.join(realBin, "..", "vhost-proxy.ts");
    } catch {
      proxyScript = node_path.join(suparunBin, "..", "vhost-proxy.ts");
    }
    if (!node_fs.existsSync(proxyScript)) {
      log(`ensureVhostProxy: vhost-proxy.ts not found at ${proxyScript}`);
      return;
    }
    log(`ensureVhostProxy: starting ${proxyScript}`);
    const bunPath = this.shellPath.split(":").map((d) => node_path.join(d, "bun")).find((p) => node_fs.existsSync(p)) || "bun";
    this.proxyChild = node_child_process.spawn(bunPath, [proxyScript], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: this.shellPath }
    });
    const pid = this.proxyChild.pid;
    log(`ensureVhostProxy: spawned pid=${pid}`);
    this.proxyChild.stderr?.on("data", (data) => {
      log(`vhostProxy[stderr]: ${data.toString().trim()}`);
    });
    this.proxyChild.on("exit", (code) => {
      log(`ensureVhostProxy: proxy pid=${pid} exited with code=${code}`);
      this.proxyChild = null;
      const hasRunning = Array.from(this.processes.values()).some((p) => !this.isTerminal(p.status));
      if (hasRunning && !this.disposed) {
        log("ensureVhostProxy: restarting proxy (processes still running)");
        setTimeout(() => this.ensureVhostProxy(), 1e3);
      }
    });
  };
  stopVhostProxy = () => {
    const running = Array.from(this.processes.values()).filter((p) => !this.isTerminal(p.status));
    if (running.length > 0) return;
    const pidFile = node_path.join(node_os.homedir(), ".config", "suparun", "proxy.pid");
    try {
      const pid = parseInt(node_fs.readFileSync(pidFile, "utf-8").trim(), 10);
      if (pid) {
        process.kill(pid, "SIGTERM");
        log(`stopVhostProxy: killed pid=${pid}`);
      }
    } catch {
    }
    this.proxyChild = null;
  };
  findAvailablePort = (idealPort) => {
    const usedPorts = /* @__PURE__ */ new Set();
    for (const proc of this.processes.values()) {
      if (proc.port && !this.isTerminal(proc.status)) usedPorts.add(proc.port);
    }
    let port = idealPort;
    while (usedPorts.has(port)) port++;
    log(`findAvailablePort: ideal=${idealPort} used=[${[...usedPorts].join(",")}] → ${port}`);
    return port;
  };
  findExisting = (projectPath, scriptName) => {
    for (const proc of this.processes.values()) {
      if (proc.projectPath === projectPath && proc.scriptName === scriptName && !this.isTerminal(proc.status)) {
        return proc;
      }
    }
    return void 0;
  };
  processOutput = (proc, data, stream) => {
    const maxLines = this.settingsStore.get().maxLogLines;
    const lines = data.toString("utf-8").split("\n").filter((l) => l.length > 0);
    for (const text of lines) {
      const logLine = { processId: proc.id, text, stream, timestamp: Date.now() };
      proc.logBuffer.push(logLine);
      while (proc.logBuffer.length > maxLines) proc.logBuffer.shift();
      this.logBatchQueue.push(logLine);
    }
  };
  flushLogs = () => {
    if (this.logBatchQueue.length === 0) return;
    this.emit("log-batch", this.logBatchQueue.splice(0));
  };
  checkPortHealth = (proc) => {
    if (!proc.port || proc.status === "stopped") return;
    node_child_process.execFile("lsof", ["-ti", `:${proc.port}`], { timeout: 3e3 }, (_err, stdout) => {
      if (this.disposed || proc.status === "stopped") return;
      const pids = stdout?.trim() || "";
      if (proc.status === "starting") {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: port=${proc.port} lsof_pids="${pids}" err=${_err?.message ?? "none"}`);
      }
      if (proc.child && !this.isPidAlive(proc.pid)) {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: PID ${proc.pid} is dead but port alive (zombie) → crashed`);
        this.markTerminated(proc, "crashed");
        return;
      }
      if (pids.length > 0 && proc.status === "starting") {
        log(`healthCheck[${proc.projectName}:${proc.scriptName}]: port ${proc.port} is alive → running`);
        proc.status = "running";
        this.emitStatusChanged(proc);
        this.saveState();
      }
    });
  };
  checkReattachedHealth = (proc) => {
    if (proc.status === "stopped") return;
    if (!this.isPidAlive(proc.pid)) {
      log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: pid=${proc.pid} is dead → stopped`);
      this.markTerminated(proc, "stopped");
      return;
    }
    if (proc.port) {
      node_child_process.execFile("lsof", ["-ti", `:${proc.port}`], { timeout: 3e3 }, (_err, stdout) => {
        if (this.disposed || proc.status === "stopped") return;
        const pids = stdout?.trim() || "";
        if (proc.status === "starting") {
          log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: port=${proc.port} lsof_pids="${pids}" err=${_err?.message ?? "none"}`);
        }
        if (pids.length > 0 && proc.status === "starting") {
          log(`reattachedHealth[${proc.projectName}:${proc.scriptName}]: port ${proc.port} is alive → running`);
          proc.status = "running";
          this.emitStatusChanged(proc);
        }
      });
    }
  };
  /** Resolve the cwd of a running process via lsof (macOS / Linux) */
  getCwdForPid = (pid) => {
    return new Promise((resolve) => {
      node_child_process.execFile("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { timeout: 4e3 }, (_err, stdout) => {
        if (!stdout) {
          resolve(null);
          return;
        }
        for (const line of stdout.split("\n")) {
          if (line.startsWith("n/")) {
            resolve(line.slice(1));
            return;
          }
        }
        resolve(null);
      });
    });
  };
  /**
   * Scan for suparun CLI processes that were NOT started by this ProcessManager
   * and adopt them so they appear in the bento UI.
   *
   * Runs every EXTERNAL_SCAN_INTERVAL ms.
   */
  scanExternalProcesses = () => {
    const managedPids = /* @__PURE__ */ new Set();
    for (const proc of this.processes.values()) {
      if (proc.pid) managedPids.add(proc.pid);
    }
    node_child_process.execFile("ps", ["-eo", "pid,command"], { timeout: 5e3 }, (_err, stdout) => {
      if (this.disposed || !stdout) return;
      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const spaceIdx = trimmed.indexOf(" ");
        if (spaceIdx === -1) continue;
        const pidStr = trimmed.slice(0, spaceIdx).trim();
        const command = trimmed.slice(spaceIdx + 1).trim();
        const pid = Number.parseInt(pidStr, 10);
        if (Number.isNaN(pid) || pid <= 0) continue;
        if (managedPids.has(pid)) continue;
        if (pid === process.pid) continue;
        if (command.includes("-c ") || command.includes("eval ")) continue;
        const parts = command.split(/\s+/);
        const suparunIdx = parts.findIndex((p) => p === "suparun" || p.endsWith("/suparun"));
        if (suparunIdx === -1) continue;
        const scriptName = parts[suparunIdx + 1];
        if (!scriptName || scriptName.startsWith("-")) continue;
        let port = null;
        const portIdx = parts.indexOf("--port");
        if (portIdx !== -1 && parts[portIdx + 1]) {
          const parsed = Number.parseInt(parts[portIdx + 1], 10);
          if (!Number.isNaN(parsed)) port = parsed;
        }
        if (this.pendingAdoptionPids.has(pid)) continue;
        this.pendingAdoptionPids.add(pid);
        log(`scanExternal: found untracked suparun pid=${pid} script=${scriptName} port=${port} cmd="${command}"`);
        this.getCwdForPid(pid).then((cwd) => {
          this.pendingAdoptionPids.delete(pid);
          if (this.disposed) return;
          if (!this.isPidAlive(pid)) {
            log(`scanExternal: pid=${pid} died before adoption`);
            return;
          }
          for (const p of this.processes.values()) {
            if (p.pid === pid) return;
          }
          const projectPath = cwd ?? process.cwd();
          const projectName = projectPath.split("/").pop() || projectPath;
          const id = node_crypto.randomUUID();
          const proc = {
            id,
            projectPath,
            projectName,
            scriptName,
            packageManager: "npm",
            child: null,
            pid,
            port,
            status: "starting",
            startedAt: Date.now(),
            crashCount: 0,
            logBuffer: [],
            healthTimer: null
          };
          this.processes.set(id, proc);
          log(`scanExternal: adopted pid=${pid} as id=${id} projectPath=${projectPath} port=${port}`);
          proc.healthTimer = setInterval(() => this.checkReattachedHealth(proc), HEALTH_CHECK_INTERVAL);
          this.emitStatusChanged(proc);
          this.saveState();
        }).catch((err) => {
          this.pendingAdoptionPids.delete(pid);
          log(`scanExternal: getCwdForPid(${pid}) error: ${String(err)}`);
        });
      }
    });
  };
  killPid = (pid) => {
    if (!pid) return;
    treeKill(pid, "SIGTERM", (err) => {
      if (err) setTimeout(() => treeKill(pid, "SIGKILL", () => {
      }), KILL_GRACE_PERIOD);
    });
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        treeKill(pid, "SIGKILL", () => {
        });
      } catch {
      }
    }, KILL_GRACE_PERIOD);
  };
  isTerminal = (status) => status === "stopped" || status === "crashed";
  /** Clean up a process that has terminated (crashed or stopped) */
  markTerminated = (proc, status) => {
    this.clearTimer(proc);
    proc.status = status;
    if (status === "crashed") proc.crashCount++;
    this.emitStatusChanged(proc);
    this.processes.delete(proc.id);
    this.saveState();
  };
  clearTimer = (proc) => {
    if (proc.healthTimer) {
      clearInterval(proc.healthTimer);
      proc.healthTimer = null;
    }
  };
  emitStatusChanged = (proc) => {
    log(`statusChanged: ${proc.projectName}:${proc.scriptName} → ${proc.status} port=${proc.port} pid=${proc.pid}`);
    try {
      this.emit("status-changed", this.toManagedProcess(proc));
    } catch (err) {
      log(`emitStatusChanged: listener error: ${String(err)}`);
    }
  };
  lookupVhostName = (port) => {
    if (!port || !this.settingsStore.get().vhostEnabled) return null;
    try {
      const vhostFile = node_path.join(node_os.homedir(), ".config", "suparun", "vhosts.json");
      const raw = node_fs.readFileSync(vhostFile, "utf-8");
      const data = JSON.parse(raw);
      for (const [name, entry] of Object.entries(data)) {
        if (entry.port === port) {
          log(`lookupVhostName: port=${port} → ${name}`);
          return name;
        }
      }
      log(`lookupVhostName: port=${port} not found in ${Object.keys(data).join(",")}`);
    } catch (err) {
      log(`lookupVhostName: error reading vhosts.json: ${String(err)}`);
    }
    return null;
  };
  toManagedProcess = (proc) => ({
    id: proc.id,
    projectPath: proc.projectPath,
    projectName: proc.projectName,
    scriptName: proc.scriptName,
    pid: proc.pid,
    port: proc.port,
    status: proc.status,
    startedAt: proc.startedAt,
    crashCount: proc.crashCount,
    vhostName: this.lookupVhostName(proc.port)
  });
}
const DEFAULT_SETTINGS = {
  scriptNames: ["dev", "start"],
  autoRestart: true,
  maxCrashCount: 50,
  notifications: true,
  launchAtLogin: false,
  globalShortcut: "CommandOrControl+Shift+S",
  maxLogLines: 5e3,
  savedFolders: [],
  favoriteEditor: "code",
  terminalCodingTool: "claude",
  jimmyApiKey: "",
  vhostEnabled: true
};
const CONFIG_DIR$1 = node_path.join(node_os.homedir(), ".config", "suparun");
const SETTINGS_PATH = node_path.join(CONFIG_DIR$1, "settings.json");
class SettingsStore {
  settings;
  constructor() {
    this.settings = this.load();
  }
  load = () => {
    try {
      if (!node_fs.existsSync(CONFIG_DIR$1)) {
        node_fs.mkdirSync(CONFIG_DIR$1, { recursive: true });
      }
      if (node_fs.existsSync(SETTINGS_PATH)) {
        const raw = node_fs.readFileSync(SETTINGS_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.error("[settings-store] Failed to load settings:", err);
    }
    return { ...DEFAULT_SETTINGS };
  };
  reload = () => {
    this.settings = this.load();
    return this.get();
  };
  get = () => {
    return { ...this.settings };
  };
  update = (partial) => {
    this.settings = { ...this.settings, ...partial };
    this.save();
    return this.get();
  };
  save = () => {
    try {
      if (!node_fs.existsSync(node_path.dirname(SETTINGS_PATH))) {
        node_fs.mkdirSync(node_path.dirname(SETTINGS_PATH), { recursive: true });
      }
      node_fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this.settings, null, 2), "utf-8");
    } catch (err) {
      console.error("[settings-store] Failed to save settings:", err);
    }
  };
}
const CONFIG_DIR = node_path.join(node_os.homedir(), ".config", "suparun");
const HISTORY_PATH = node_path.join(CONFIG_DIR, "history.json");
const MAX_ENTRIES = 50;
class HistoryStore {
  entries;
  constructor() {
    this.entries = this.load();
  }
  load = () => {
    try {
      if (!node_fs.existsSync(CONFIG_DIR)) {
        node_fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      if (node_fs.existsSync(HISTORY_PATH)) {
        const raw = node_fs.readFileSync(HISTORY_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.error("[history-store] Failed to load history:", err);
    }
    return [];
  };
  save = () => {
    try {
      if (!node_fs.existsSync(node_path.dirname(HISTORY_PATH))) {
        node_fs.mkdirSync(node_path.dirname(HISTORY_PATH), { recursive: true });
      }
      node_fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.entries, null, 2), "utf-8");
    } catch (err) {
      console.error("[history-store] Failed to save history:", err);
    }
  };
  getAll = () => {
    return [...this.entries];
  };
  add = (entry) => {
    const existingIndex = this.entries.findIndex((e) => e.path === entry.path);
    if (existingIndex !== -1) {
      const existing = this.entries[existingIndex];
      const mergedScripts = [.../* @__PURE__ */ new Set([...existing.scriptsUsed, ...entry.scriptsUsed])];
      this.entries.splice(existingIndex, 1);
      this.entries.unshift({ ...entry, scriptsUsed: mergedScripts });
    } else {
      this.entries.unshift(entry);
    }
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }
    this.save();
  };
  remove = (path2) => {
    this.entries = this.entries.filter((e) => e.path !== path2);
    this.save();
  };
  clear = () => {
    this.entries = [];
    this.save();
  };
}
const ACTIVE_STATUSES = /* @__PURE__ */ new Set(["starting", "running", "restarting"]);
const settings = new SettingsStore();
const history = new HistoryStore();
const packageScanner = new PackageScanner(settings);
const processManager = new ProcessManager(settings);
const isDev = process.env.NODE_ENV === "development";
const rendererUrl = isDev ? process.env["ELECTRON_RENDERER_URL"] : `file://${path.join(__dirname, "../renderer/index.html")}`;
electron.app.name = "Suparun";
let studioWindow = null;
let tray = null;
let currentProjects = [];
const STATUS_LABELS = {
  starting: "Starting...",
  running: "Running",
  crashed: "Crashed",
  stopped: "Stopped",
  restarting: "Restarting..."
};
const buildTrayMenu = () => {
  const items = [];
  items.push({ label: "Suparun", enabled: false });
  items.push({ type: "separator" });
  const running = processManager.getRunningProcesses();
  if (currentProjects.length === 0) {
    items.push({ label: "No projects detected", enabled: false });
  } else {
    const flat = currentProjects.flatMap(
      (p) => p.isMonorepo ? [p, ...p.workspaces] : [p]
    );
    for (const project of flat) {
      if (project.scripts.length === 0) continue;
      items.push({ label: project.name, enabled: false });
      for (const script of project.scripts) {
        const proc = running.find(
          (r) => r.projectPath === project.path && r.scriptName === script.name && r.status !== "stopped"
        );
        if (proc) {
          const statusLabel = STATUS_LABELS[proc.status];
          const portStr = proc.port ? ` :${proc.port}` : "";
          items.push({
            label: `  ${script.name} — ${statusLabel}${portStr}`,
            submenu: [
              {
                label: "Stop",
                click: () => {
                  processManager.stop(proc.id);
                  rebuildTrayMenu();
                }
              },
              {
                label: "Restart",
                click: async () => {
                  await processManager.restart(proc.id);
                  rebuildTrayMenu();
                }
              },
              ...proc.port ? [{
                label: `Open localhost:${proc.port}`,
                click: () => {
                  import("electron").then(
                    ({ shell }) => shell.openExternal(`http://localhost:${proc.port}`)
                  );
                }
              }] : []
            ]
          });
        } else {
          items.push({
            label: `  ${script.name}`,
            click: async () => {
              await processManager.start(project.path, script.name, project.packageManager);
              rebuildTrayMenu();
            }
          });
        }
      }
      items.push({ type: "separator" });
    }
  }
  items.push({ type: "separator" });
  const activeCount = running.filter((p) => ACTIVE_STATUSES.has(p.status)).length;
  if (activeCount > 0) {
    items.push({
      label: `Stop All (${activeCount} running)`,
      click: () => {
        processManager.killAll();
        rebuildTrayMenu();
      }
    });
    items.push({ type: "separator" });
  }
  items.push({
    label: "Settings…",
    accelerator: "CommandOrControl+,",
    click: () => openSettingsWindow()
  });
  if (studioWindow) {
    items.push({
      label: studioWindow.isVisible() ? "Hide Overlay" : "Show Overlay",
      accelerator: "Escape",
      click: () => toggleStudioOverlay()
    });
  }
  items.push({ type: "separator" });
  items.push({
    label: "Quit Suparun",
    accelerator: "CommandOrControl+Q",
    click: () => electron.app.quit()
  });
  return electron.Menu.buildFromTemplate(items);
};
const toggleStudioOverlay = () => {
  if (!studioWindow) return;
  if (studioWindow.isVisible()) {
    studioWindow.hide();
    electron.app.dock?.hide();
  } else {
    electron.app.dock?.show();
    studioWindow.show();
    studioWindow.focus();
    updateMenu();
  }
};
let settingsWindow = null;
const settingsUrl = isDev ? process.env["ELECTRON_RENDERER_URL"] + "/settings.html" : `file://${path.join(__dirname, "../renderer/settings.html")}`;
const openSettingsWindow = () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new electron.BrowserWindow({
    width: 480,
    height: 420,
    title: "Suparun Settings",
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.setAlwaysOnTop(true, "floating");
  settingsWindow.loadURL(settingsUrl);
  settingsWindow.on("closed", () => {
    settingsWindow = null;
    settings.reload();
  });
};
const showContextMenu = () => {
  if (!studioWindow) return;
  const template = [
    { label: "Reload Bento", accelerator: "Shift+Command+R", click: () => studioWindow?.webContents.reload() },
    { type: "separator" },
    { label: "Hide Overlay", accelerator: "Escape", click: () => toggleStudioOverlay() },
    { label: "Quit Suparun", accelerator: "Command+Q", click: () => electron.app.quit() }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  menu.popup();
};
const updateMenu = () => {
  const template = [
    {
      label: "Suparun",
      submenu: [
        { label: "About Suparun", role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "Command+,",
          click: () => openSettingsWindow()
        },
        { type: "separator" },
        { label: "Hide Suparun", accelerator: "Command+H", role: "hide" },
        { label: "Hide Others", accelerator: "Command+Alt+H", role: "hideOthers" },
        { label: "Show All", role: "unhide" },
        { type: "separator" },
        { label: "Quit", accelerator: "Command+Q", click: () => electron.app.quit() }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "Command+Z", role: "undo" },
        { label: "Redo", accelerator: "Shift+Command+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "Command+X", role: "cut" },
        { label: "Copy", accelerator: "Command+C", role: "copy" },
        { label: "Paste", accelerator: "Command+V", role: "paste" },
        { label: "Select All", accelerator: "Command+A", role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload Bento",
          accelerator: "Shift+Command+R",
          click: () => {
            studioWindow?.webContents.reload();
          }
        },
        { type: "separator" },
        { label: "Toggle Full Screen", accelerator: "Ctrl+Command+F", role: "togglefullscreen" }
      ]
    },
    {
      label: "Processes",
      submenu: [
        {
          label: "Stop All Processes",
          enabled: processManager.getRunningProcesses().some((p) => ACTIVE_STATUSES.has(p.status)),
          click: () => {
            processManager.killAll();
            rebuildTrayMenu();
          }
        }
      ]
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", accelerator: "Command+M", role: "minimize" },
        { label: "Close", accelerator: "Command+W", click: () => toggleStudioOverlay() },
        { type: "separator" },
        { label: "Bring All to Front", role: "front" }
      ]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
};
const rebuildTrayMenu = () => {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  updateMenu();
  const hasRunning = processManager.getRunningProcesses().some(
    (p) => ACTIVE_STATUSES.has(p.status)
  );
  tray.setImage(
    path.join(__dirname, hasRunning ? "../../assets/iconActiveTemplate.png" : "../../assets/iconTemplate.png")
  );
};
const createTray = () => {
  tray = new electron.Tray(path.join(__dirname, "../../assets/iconTemplate.png"));
  tray.setToolTip("Suparun");
  rebuildTrayMenu();
};
const startSharedServices = () => {
  processManager.on("log-batch", (lines) => {
    studioWindow?.webContents.send("log-batch", lines);
  });
  processManager.on("status-changed", (proc) => {
    studioWindow?.webContents.send("process-status-changed", proc);
    rebuildTrayMenu();
    const s = settings.get();
    if (s.notifications) {
      if (proc.status === "crashed") {
        new electron.Notification({
          title: "Suparun",
          body: `${proc.projectName} - ${proc.scriptName} crashed (attempt ${proc.crashCount})`
        }).show();
      } else if (proc.status === "running" && proc.crashCount > 0) {
        new electron.Notification({
          title: "Suparun",
          body: `${proc.projectName} - ${proc.scriptName} recovered`
        }).show();
      }
    }
    if (proc.status === "running") {
      history.add({
        path: proc.projectPath,
        name: proc.projectName,
        framework: null,
        isMonorepo: false,
        lastUsed: Date.now(),
        scriptsUsed: [proc.scriptName]
      });
    }
  });
  const currentSettings = settings.get();
  electron.app.setLoginItemSettings({ openAtLogin: currentSettings.launchAtLogin });
  const shortcut = currentSettings.globalShortcut;
  if (shortcut) {
    electron.globalShortcut.register(shortcut, () => {
      toggleStudioOverlay();
    });
  }
};
const startApp = async () => {
  const appIcon = electron.nativeImage.createFromPath(path.join(__dirname, "../../assets/icon.png"));
  electron.app.dock?.setIcon(appIcon);
  electron.app.dock?.hide();
  updateMenu();
  createTray();
  studioWindow = new electron.BrowserWindow({
    width: 900,
    height: 600,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    center: true,
    minWidth: 400,
    minHeight: 300,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  studioWindow.on("closed", () => {
    studioWindow = null;
  });
  const savedFolders = settings.get().savedFolders ?? [];
  for (const folderPath of savedFolders) {
    const projects = await packageScanner.scan(folderPath);
    const existingPaths = new Set(currentProjects.map((p) => p.path));
    for (const p of projects) {
      if (!existingPaths.has(p.path)) {
        currentProjects.push(p);
        existingPaths.add(p.path);
      }
    }
  }
  console.log(`[suparun] Scanned ${savedFolders.length} saved folders, ${currentProjects.length} projects found`);
  registerIpcHandlers({
    processManager,
    settings,
    history,
    window: studioWindow,
    getCurrentProjects: () => currentProjects
  });
  await processManager.reattach();
  startSharedServices();
  rebuildTrayMenu();
  studioWindow.loadURL(rendererUrl);
  studioWindow.once("ready-to-show", () => {
    console.log("[suparun] studioWindow ready-to-show, calling show()");
    electron.app.dock?.show();
    updateMenu();
    studioWindow?.show();
    studioWindow?.focus();
  });
  setTimeout(() => {
    if (studioWindow && !studioWindow.isVisible()) {
      console.log("[suparun] studioWindow still not visible after 2s, forcing show()");
      electron.app.dock?.show();
      updateMenu();
      studioWindow.show();
      studioWindow.focus();
    }
  }, 2e3);
  if (isDev && process.env["SUPARUN_OPEN_DEVTOOLS"] === "1") {
    studioWindow.webContents.openDevTools({ mode: "detach" });
  }
  console.log("[suparun] Studio overlay ready");
};
const getCurrentProjects = () => currentProjects;
const hideOverlay = () => {
  studioWindow?.hide();
};
const openFolderPicker = async () => {
  if (!studioWindow) return null;
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select a project folder"
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const folderPath = result.filePaths[0];
  console.log(`[suparun] openFolderPicker: selected ${folderPath}`);
  const projects = await packageScanner.scan(folderPath);
  console.log(`[suparun] openFolderPicker: scanned ${projects.length} projects`);
  if (projects.length > 0) {
    const existingPaths = new Set(currentProjects.map((p) => p.path));
    for (const p of projects) {
      if (!existingPaths.has(p.path)) {
        currentProjects.push(p);
        existingPaths.add(p.path);
      }
    }
    studioWindow?.webContents.send("projects-changed", currentProjects);
    rebuildTrayMenu();
  }
  const currentSettings = settings.get();
  const savedFolders = currentSettings.savedFolders ?? [];
  if (!savedFolders.includes(folderPath)) {
    console.log(`[suparun] openFolderPicker: persisting ${folderPath}`);
    settings.update({ savedFolders: [...savedFolders, folderPath] });
  }
  return folderPath;
};
const addFolder = async (folderPath) => {
  console.log(`[suparun] addFolder: ${folderPath}`);
  const projects = await packageScanner.scan(folderPath);
  console.log(`[suparun] addFolder: scanned ${projects.length} projects`);
  const existingPaths = new Set(currentProjects.map((p) => p.path));
  for (const p of projects) {
    if (!existingPaths.has(p.path)) {
      currentProjects.push(p);
      existingPaths.add(p.path);
    }
  }
  const currentSettings = settings.get();
  const savedFolders = currentSettings.savedFolders ?? [];
  if (!savedFolders.includes(folderPath)) {
    console.log(`[suparun] addFolder: persisting ${folderPath}`);
    settings.update({ savedFolders: [...savedFolders, folderPath] });
  }
  studioWindow?.webContents.send("projects-changed", currentProjects);
  rebuildTrayMenu();
  return projects;
};
const removeFolder = (folderPath) => {
  const currentSettings = settings.get();
  const savedFolders = currentSettings.savedFolders ?? [];
  settings.update({ savedFolders: savedFolders.filter((f) => f !== folderPath) });
  const running = processManager.getRunningProcesses();
  for (const proc of running) {
    if (proc.projectPath.startsWith(folderPath)) {
      processManager.stop(proc.id);
    }
  }
  currentProjects = currentProjects.filter((p) => !p.path.startsWith(folderPath));
  studioWindow?.webContents.send("projects-changed", currentProjects);
  rebuildTrayMenu();
};
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "local-file", privileges: { bypassCSP: true, supportFetchAPI: true, stream: true } }
]);
electron.app.whenReady().then(() => {
  electron.protocol.handle("local-file", (request) => {
    const filePath = decodeURIComponent(request.url.replace("local-file://", ""));
    return electron.net.fetch(url.pathToFileURL(filePath).toString());
  });
  startApp();
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
  processManager.disconnectAll();
  tray?.destroy();
});
electron.app.on("before-quit", () => {
  processManager.disconnectAll();
});
for (const sig of ["SIGTERM", "SIGHUP", "SIGINT"]) {
  process.on(sig, () => {
    processManager.disconnectAll();
    process.exit();
  });
}
electron.app.on("window-all-closed", () => {
});
const index = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addFolder,
  getCurrentProjects,
  hideOverlay,
  openFolderPicker,
  removeFolder,
  showContextMenu,
  toggleStudioOverlay
}, Symbol.toStringTag, { value: "Module" }));
exports.addFolder = addFolder;
exports.getCurrentProjects = getCurrentProjects;
exports.hideOverlay = hideOverlay;
exports.openFolderPicker = openFolderPicker;
exports.removeFolder = removeFolder;
exports.showContextMenu = showContextMenu;
exports.toggleStudioOverlay = toggleStudioOverlay;
