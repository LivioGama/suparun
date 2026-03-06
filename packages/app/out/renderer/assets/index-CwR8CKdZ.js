import { r as reactExports, i as ipc, j as jsxRuntimeExports, c as client, R as React } from "./globals-fvwobLbG.js";
const useProjects = () => {
  const [projects, setProjects] = reactExports.useState([]);
  const [isLoading, setIsLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    ipc.getDetectedProjects().then((detected) => {
      setProjects(detected);
      setIsLoading(false);
    });
    const unsubscribe = ipc.onProjectsChanged((updated) => {
      setProjects(updated);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);
  return { projects, isLoading };
};
const useProcess = () => {
  const [processes, setProcesses] = reactExports.useState([]);
  reactExports.useEffect(() => {
    ipc.getRunningProcesses().then(setProcesses);
    const unsubscribe = ipc.onProcessStatusChanged((updated) => {
      setProcesses((prev) => {
        const idx = prev.findIndex((p) => p.id === updated.id);
        if (idx === -1) return [...prev, updated];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    });
    return unsubscribe;
  }, []);
  const startProcess = reactExports.useCallback(async (path, script, packageManager) => {
    const proc = await ipc.startProcess(path, script, packageManager);
    setProcesses((prev) => [...prev.filter((p) => p.id !== proc.id), proc]);
    return proc;
  }, []);
  const stopProcess = reactExports.useCallback(async (id) => {
    await ipc.stopProcess(id);
  }, []);
  const restartProcess = reactExports.useCallback(async (id) => {
    const proc = await ipc.restartProcess(id);
    setProcesses((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.id === id);
      if (idx !== -1) next[idx] = proc;
      return next;
    });
    return proc;
  }, []);
  const getProcessForScript = reactExports.useCallback(
    (path, script) => processes.find(
      (p) => p.projectPath === path && p.scriptName === script && p.status !== "stopped"
    ),
    [processes]
  );
  return { processes, startProcess, stopProcess, restartProcess, getProcessForScript };
};
const useRunner = () => {
  const { processes, startProcess, stopProcess } = useProcess();
  const startProject = reactExports.useCallback(
    (projectPath, scriptName, packageManager) => startProcess(projectPath, scriptName, packageManager),
    [startProcess]
  );
  const stopProject = reactExports.useCallback(
    (projectPath) => {
      const running = processes.filter(
        (p) => p.projectPath === projectPath && p.status !== "stopped"
      );
      return Promise.all(running.map((p) => stopProcess(p.id)));
    },
    [processes, stopProcess]
  );
  const getProcessForProject = reactExports.useCallback(
    (projectPath) => processes.find(
      (p) => p.projectPath === projectPath && p.status !== "stopped"
    ),
    [processes]
  );
  return { processes, startProject, stopProject, getProcessForProject };
};
const RunButton = ({ running, scriptName, onRun, onStop, small }) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  "button",
  {
    onClick: running ? onStop : onRun,
    className: "run-button",
    type: "button",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: small ? 4 : 6,
      width: "100%",
      padding: small ? "4px 10px" : "10px 16px",
      borderRadius: small ? 8 : 14,
      border: "none",
      cursor: "pointer",
      fontSize: small ? 11 : 13,
      fontWeight: 600,
      letterSpacing: "0.01em",
      fontFamily: "inherit",
      transition: "opacity 150ms ease",
      background: running ? "linear-gradient(135deg, rgba(239, 68, 68, 0.85), rgba(220, 38, 38, 0.9))" : "linear-gradient(135deg, rgba(74, 222, 128, 0.85), rgba(34, 197, 94, 0.9))",
      color: "#fff",
      boxShadow: running ? "0 2px 8px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)" : "0 2px 8px rgba(74, 222, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)"
    },
    children: [
      running ? /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: small ? 8 : 12, height: small ? 8 : 12, viewBox: "0 0 12 12", fill: "currentColor", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Stop" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "1", width: "10", height: "10", rx: "2" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: small ? 8 : 12, height: small ? 8 : 12, viewBox: "0 0 12 12", fill: "currentColor", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Run" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M2.5 1.5 L10.5 6 L2.5 10.5 Z" })
      ] }),
      running ? "Stop" : small ? scriptName : `Run ${scriptName}`
    ]
  }
);
const formatUptime = (startedAt) => {
  const secs = Math.floor((Date.now() - startedAt) / 1e3);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  }
  if (secs < 86400) {
    const h2 = Math.floor(secs / 3600);
    const m = Math.floor(secs % 3600 / 60);
    return `${h2}h ${m}m`;
  }
  const d = Math.floor(secs / 86400);
  const h = Math.floor(secs % 86400 / 3600);
  return `${d}d ${h}h`;
};
const useUptime = (startedAt) => {
  const [uptime, setUptime] = reactExports.useState(
    startedAt != null ? formatUptime(startedAt) : null
  );
  reactExports.useEffect(() => {
    if (startedAt == null) {
      setUptime(null);
      return;
    }
    setUptime(formatUptime(startedAt));
    const id = setInterval(() => setUptime(formatUptime(startedAt)), 1e3);
    return () => clearInterval(id);
  }, [startedAt]);
  return uptime;
};
const UptimeBadge = ({ startedAt }) => {
  const uptime = useUptime(startedAt);
  if (!uptime) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "span",
    {
      style: {
        fontSize: 10,
        fontVariantNumeric: "tabular-nums",
        fontFamily: "ui-monospace, monospace",
        color: "rgba(255, 255, 255, 0.4)",
        letterSpacing: "0.02em"
      },
      children: uptime
    }
  );
};
const STATUS_CONFIG = {
  starting: { color: "#f59e0b", label: "Starting...", pulse: true },
  running: { color: "#22c55e", label: "Running" },
  crashed: { color: "#ef4444", label: "Crashed" },
  stopped: { color: "rgba(255,255,255,0.3)", label: "Stopped" },
  restarting: { color: "#f59e0b", label: "Restarting...", pulse: true }
};
const hashHue = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};
const vibrantColors = [
  { bg: "linear-gradient(145deg, #FF6B6B 0%, #FF8E53 100%)" },
  { bg: "linear-gradient(145deg, #4ECDC4 0%, #44A08D 100%)" },
  { bg: "linear-gradient(145deg, #FFE66D 0%, #FF6B6B 100%)" },
  { bg: "linear-gradient(145deg, #A8E6CF 0%, #7FCDCD 100%)" },
  { bg: "linear-gradient(145deg, #FFD93D 0%, #FF6B6B 100%)" },
  { bg: "linear-gradient(145deg, #6BCF7F 0%, #56AB2F 100%)" },
  { bg: "linear-gradient(145deg, #FF9FF3 0%, #FECA57 100%)" },
  { bg: "linear-gradient(145deg, #54A0FF 0%, #2E86DE 100%)" }
];
const WorkspaceRow = ({ ws, proc, onStart, onStop }) => {
  const status = proc ? STATUS_CONFIG[proc.status] : null;
  const isRunning = proc?.status === "running" || proc?.status === "starting" || proc?.status === "restarting";
  const primaryScript = ws.scripts[0]?.name ?? "dev";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors duration-200 hover:bg-white/5 min-w-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "rounded-full shrink-0",
        style: {
          width: 6,
          height: 6,
          background: status?.color ?? "rgba(255, 255, 255, 0.15)",
          animation: status?.pulse ? "pulse-dot 1.5s ease-in-out infinite" : "none",
          boxShadow: status?.color ? `0 0 8px ${status.color}` : "none"
        }
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm truncate flex-1", style: { color: "rgba(255, 255, 255, 0.8)" }, children: ws.name }),
    isRunning && proc?.startedAt != null && /* @__PURE__ */ jsxRuntimeExports.jsx(UptimeBadge, { startedAt: proc.startedAt }),
    proc?.port && isRunning && (proc.status === "running" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: () => {
          ipc.openInBrowser(proc.port ?? 3e3, proc.vhostName ?? void 0);
        },
        type: "button",
        className: "text-xs px-2 py-0.5 rounded-md border-none cursor-pointer hover:bg-white/10",
        style: {
          background: "rgba(74, 222, 128, 0.15)",
          color: "rgba(74, 222, 128, 0.9)",
          transition: "all 150ms ease"
        },
        children: proc.vhostName ? `${proc.vhostName}.localhost` : `:${proc.port}`
      }
    ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: "text-xs px-2 py-0.5 rounded-md animate-pulse",
        style: { color: "rgba(255, 255, 255, 0.3)" },
        children: "starting..."
      }
    )),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", style: { width: 85, position: "relative" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(RunButton, { running: isRunning, scriptName: primaryScript, onRun: onStart, onStop, small: true }) })
  ] });
};
const ProjectTile = ({ project, getProcessForProject, onStartProject, onStopProject }) => {
  const hasIcon = !!project.iconPath;
  const letter = (project.name[0] || "?").toUpperCase();
  const hue = hashHue(project.name);
  Math.abs(hashHue(project.name)) % vibrantColors.length;
  const isMonorepo = project.isMonorepo && project.workspaces.length > 0;
  const displayApps = isMonorepo ? project.workspaces : [project];
  const singleProc = !isMonorepo ? getProcessForProject(project.path) : void 0;
  singleProc ? STATUS_CONFIG[singleProc.status] : null;
  singleProc?.status === "running" || singleProc?.status === "starting" || singleProc?.status === "restarting";
  project.scripts[0]?.name ?? "dev";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "tile relative flex flex-col",
      title: project.path,
      "aria-label": `${project.name} — ${project.path}`,
      style: {
        borderRadius: 56,
        width: 534,
        minWidth: 534,
        height: 340,
        boxShadow: `
          0 8px 24px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          inset 0 -1px 0 rgba(0, 0, 0, 0.2),
          0 0 20px rgba(255, 255, 255, 0.1)
        `,
        transition: "transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 300ms ease, border-color 200ms ease",
        border: "3px solid rgba(255, 255, 255, 0.2)",
        position: "relative",
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(10px)",
        overflow: "hidden"
      },
      onMouseEnter: (e) => {
        e.currentTarget.style.zIndex = "50";
        e.currentTarget.style.borderColor = "hsla(38, 80%, 60%, 0.85)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.zIndex = "5";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
      },
      children: [
        hasIcon ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "img",
            {
              src: `local-file://${project.iconPath}`,
              alt: "",
              draggable: false,
              className: "absolute inset-0 w-full h-full object-cover pointer-events-none select-none",
              style: { opacity: 1, filter: "blur(4px)", transform: "scale(1.05)" }
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "absolute inset-0 pointer-events-none",
              style: { background: "rgba(0, 0, 0, 0.5)" }
            }
          )
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "absolute inset-0 flex items-center justify-center pointer-events-none select-none",
            style: { opacity: 0.03 },
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: 200, fontWeight: 800, color: "#fff", lineHeight: 1 }, children: letter })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                ipc.openInEditor(project.path);
              },
              type: "button",
              className: "flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100",
              style: {
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(4px)"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                e.currentTarget.style.color = "#fff";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              },
              title: "Open in Editor",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Open in Editor" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "16 18 22 12 16 6" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "8 6 2 12 8 18" })
              ] })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                ipc.openInClaudeCode(project.path);
              },
              type: "button",
              className: "flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100",
              style: {
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(4px)"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                e.currentTarget.style.color = "#fff";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              },
              title: "Open in Terminal",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Open in Terminal" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "4 17 10 11 4 5" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
              ] })
            }
          ),
          (() => {
            const apps = isMonorepo ? project.workspaces : [project];
            const targets = apps.map((app) => getProcessForProject(app.path)).filter(
              (p) => !!p && (p.status === "running" || p.status === "starting" || p.status === "restarting") && !!p.port
            );
            if (targets.length === 0) return null;
            const titleLabel = targets.length === 1 ? targets[0].vhostName ? `Open ${targets[0].vhostName}.localhost:2999` : `Open localhost:${targets[0].port}` : `Open ${targets.length} targets in browser`;
            return /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  for (const t of targets) ipc.openInBrowser(t.port, t.vhostName ?? void 0);
                },
                type: "button",
                className: "flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100",
                style: {
                  background: "rgba(74, 222, 128, 0.15)",
                  color: "rgba(74, 222, 128, 0.9)",
                  backdropFilter: "blur(4px)"
                },
                onMouseEnter: (e) => {
                  e.currentTarget.style.background = "rgba(74, 222, 128, 0.3)";
                  e.currentTarget.style.color = "#4ade80";
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.background = "rgba(74, 222, 128, 0.15)";
                  e.currentTarget.style.color = "rgba(74, 222, 128, 0.9)";
                },
                title: titleLabel,
                children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Open in Browser" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "12", cy: "12", r: "10" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })
                ] })
              }
            );
          })(),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                ipc.openInFinder(project.path);
              },
              type: "button",
              className: "flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100",
              style: {
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(4px)"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                e.currentTarget.style.color = "#fff";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              },
              title: "Open in Finder",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Open in Finder" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
              ] })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${project.name} from Bento?`)) {
                  ipc.removeFolder(project.path);
                }
              },
              type: "button",
              className: "flex items-center justify-center w-8 h-8 rounded-full border-none cursor-pointer opacity-60 transition-opacity hover:opacity-100",
              style: {
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(4px)"
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)";
                e.currentTarget.style.color = "#fff";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              },
              title: "Remove project",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("title", { children: "Remove project" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
              ] })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex flex-col px-8 pt-5 pb-14 z-10 flex-1 min-h-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", children: hasIcon ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", style: { width: 48, height: 48 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "img",
                {
                  src: `local-file://${project.iconPath}`,
                  alt: project.name,
                  draggable: false,
                  className: "object-cover",
                  style: { width: 48, height: 48, borderRadius: 14, boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)" }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "absolute inset-0 pointer-events-none",
                  style: { borderRadius: 14, background: "linear-gradient(160deg, rgba(255,255,255,0.2) 0%, transparent 45%)" }
                }
              )
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", style: { width: 48, height: 48 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "flex items-center justify-center font-bold",
                  style: {
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    fontSize: 20,
                    background: `linear-gradient(135deg, hsl(${hue}, 50%, 48%), hsl(${(hue + 40) % 360}, 40%, 32%))`,
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)"
                  },
                  children: letter
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "absolute inset-0 pointer-events-none",
                  style: { borderRadius: 14, background: "linear-gradient(160deg, rgba(255,255,255,0.2) 0%, transparent 45%)" }
                }
              )
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xl font-semibold truncate", style: { color: "#fff" }, children: project.name }),
            project.framework && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs px-2 py-0.5 rounded-full shrink-0", style: { background: "rgba(255,255,255,0.1)", color: "rgba(255, 255, 255, 0.5)" }, children: project.framework })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col flex-1 min-w-0 min-h-0", children: isMonorepo ? (
            /* Monorepo: list workspace apps with individual controls */
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col min-h-0 pr-1", style: { overflowY: "auto", overflowX: "hidden" }, children: displayApps.map((ws) => {
              const wsProc = getProcessForProject(ws.path);
              return /* @__PURE__ */ jsxRuntimeExports.jsx(
                WorkspaceRow,
                {
                  ws,
                  proc: wsProc,
                  onStart: () => {
                    const script = ws.scripts[0];
                    if (script) onStartProject(ws.path, script.name, ws.packageManager);
                  },
                  onStop: () => onStopProject(ws.path)
                },
                ws.path
              );
            }) })
          ) : (
            /* Single project: unified with monorepo style */
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col min-h-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                WorkspaceRow,
                {
                  ws: project,
                  proc: singleProc,
                  onStart: () => {
                    const script = project.scripts[0];
                    if (script) onStartProject(project.path, script.name, project.packageManager);
                  },
                  onStop: () => onStopProject(project.path)
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-2 mt-1 ml-5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs", style: { color: "rgba(255, 255, 255, 0.4)" }, children: [
                project.framework || "Node.js",
                " · ",
                project.path.split("/").pop()
              ] }) })
            ] })
          ) })
        ] })
      ]
    }
  );
};
const DIVIDER = 14;
const DIVIDER_PAD = 8;
const GAP = DIVIDER + DIVIDER_PAD * 2;
const BORDER_PAD = 23;
const TILE_W = 534;
const TILE_H = 340;
const GRID_PAD = DIVIDER_PAD;
const BentoGrid = ({
  projects,
  getProcessForProject,
  onStartProject,
  onStopProject
}) => {
  const containerRef = reactExports.useRef(null);
  const [isDragging, setIsDragging] = reactExports.useState(false);
  const dragCounter = reactExports.useRef(0);
  const [columns, setColumns] = reactExports.useState(2);
  reactExports.useEffect(() => {
    const calcColumns = (screenWidth) => {
      let maxCols = 2;
      if (screenWidth < 800) maxCols = 1;
      else if (screenWidth < 2e3) maxCols = 2;
      else maxCols = 3;
      const cols = maxCols === 3 && projects.length < 5 ? 2 : maxCols;
      setColumns(Math.min(cols, projects.length));
    };
    ipc.getScreenWidth().then(calcColumns);
    const unsubScreen = ipc.onScreenChanged(calcColumns);
    return () => {
      unsubScreen();
    };
  }, [projects.length]);
  reactExports.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const BORDER = 14 * 2;
    const rows = Math.ceil(projects.length / columns);
    const contentWidth = projects.length > 0 ? columns * TILE_W + (columns - 1) * GAP + BORDER_PAD * 2 : 200;
    const contentHeight = projects.length > 0 ? rows * TILE_H + (rows - 1) * GAP + BORDER_PAD * 2 : 80;
    ipc.getScreenWidth().then((screenWidth) => {
      const screenHeight = window.screen.availHeight;
      const targetWidth = Math.min(contentWidth + BORDER, screenWidth * 0.95);
      const targetHeight = Math.min(contentHeight + BORDER, screenHeight * 0.9);
      ipc.resizeWindow(Math.ceil(targetWidth), Math.ceil(targetHeight));
    });
  }, [projects.length, columns]);
  reactExports.useEffect(() => {
    const handleGlobalDrop = (e) => {
      console.log("[BentoGrid] Global drop event fired");
    };
    window.addEventListener("drop", handleGlobalDrop);
    return () => window.removeEventListener("drop", handleGlobalDrop);
  }, []);
  const handleDragOver = reactExports.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDragEnter = reactExports.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);
  const handleDragLeave = reactExports.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);
  const handleDrop = reactExports.useCallback((e) => {
    console.log("[BentoGrid] handleDrop fired");
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    console.log("[BentoGrid] Drop event files:", e.dataTransfer.files);
    if (file) {
      const folderPath = file.path || (ipc.webUtils ? ipc.webUtils.getPathForFile(file) : void 0);
      console.log("[BentoGrid] Dropped file object:", file);
      console.log("[BentoGrid] Dropped path:", folderPath);
      if (folderPath) {
        ipc.addFolder(folderPath).then((projects2) => {
          console.log("[BentoGrid] addFolder success, projects returned:", projects2);
        }).catch((err) => {
          console.error("[BentoGrid] addFolder error:", err);
        });
      } else {
        console.error("[BentoGrid] Could not extract path from dropped file");
      }
    }
  }, []);
  const handleAddClick = reactExports.useCallback(() => {
    ipc.openFolderPicker();
  }, []);
  const handleContextMenu = reactExports.useCallback((e) => {
    e.preventDefault();
    ipc.showContextMenu();
  }, []);
  const hasProjects = projects.length > 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "relative", width: "fit-content" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: containerRef,
        className: "bento-container",
        onDragOver: handleDragOver,
        onDragEnter: handleDragEnter,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onContextMenu: handleContextMenu,
        style: {
          borderRadius: "var(--bento-radius)",
          border: `14px solid ${isDragging ? "#A52020" : "#6B1010"}`,
          background: "linear-gradient(170deg, #8B1A1A 0%, #5C0E0E 100%)",
          padding: BORDER_PAD,
          position: "relative",
          overflow: "hidden",
          width: "fit-content",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          ...{ WebkitAppRegion: "drag" }
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                position: "absolute",
                inset: "14px",
                backgroundColor: "#C4A672",
                backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.06)),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 3px,
              rgba(140, 110, 50, 0.3) 3px,
              rgba(140, 110, 50, 0.3) 4px
            ),
            repeating-linear-gradient(
              89deg,
              transparent,
              transparent 7px,
              rgba(120, 90, 40, 0.2) 7px,
              rgba(120, 90, 40, 0.2) 8px
            ),
            repeating-linear-gradient(
              91deg,
              transparent,
              transparent 12px,
              rgba(90, 70, 30, 0.15) 12px,
              rgba(90, 70, 30, 0.15) 14px
            ),
            radial-gradient(ellipse 150px 60px at 40% 50%, rgba(170, 140, 80, 0.25) 0%, transparent 100%)
          `,
                borderRadius: "calc(var(--bento-radius) - 14px)",
                pointerEvents: "none",
                zIndex: 1,
                boxShadow: "inset 0 6px 16px rgba(0, 0, 0, 0.4)"
              }
            }
          ),
          hasProjects && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "absolute inset-0 pointer-events-none select-none overflow-hidden",
              style: { borderRadius: "calc(var(--bento-radius) - 14px)", display: "flex", gap: GAP, padding: GRID_PAD },
              children: projects.map((project, i) => {
                const colorIndex = Math.abs(hashHue(project.name)) % vibrantColors.length;
                return /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    style: {
                      flex: `0 0 ${TILE_W}px`,
                      height: "100%",
                      borderRadius: 56,
                      background: vibrantColors[colorIndex].bg,
                      opacity: 0.5,
                      filter: "blur(20px) saturate(1.2)",
                      transform: "scale(0.92)"
                    }
                  },
                  project.path
                );
              })
            }
          ),
          isDragging && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                position: "absolute",
                inset: 0,
                background: "rgba(139, 26, 26, 0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                borderRadius: "calc(var(--bento-radius) - 14px)",
                // @ts-ignore
                WebkitAppRegion: "no-drag"
              },
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                color: "rgba(255, 200, 200, 0.9)",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.5px"
              }, children: "Drop to add project" })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: GAP,
                position: "relative",
                zIndex: 5,
                minHeight: hasProjects ? void 0 : 80,
                alignItems: "center",
                justifyContent: hasProjects ? void 0 : "center",
                padding: 0,
                ...{ WebkitAppRegion: "no-drag" }
              },
              children: hasProjects ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                projects.map((project) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                  ProjectTile,
                  {
                    project,
                    getProcessForProject,
                    onStartProject,
                    onStopProject
                  },
                  project.path
                )),
                Array.from({ length: columns - 1 }, (_, ci) => {
                  if (ci + 1 >= projects.length) return null;
                  const left = (ci + 1) * TILE_W + ci * GAP + DIVIDER_PAD;
                  return /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        top: -BORDER_PAD,
                        bottom: -BORDER_PAD,
                        left,
                        width: DIVIDER,
                        background: `linear-gradient(90deg,
                      #5C0E0E 0%,
                      #8B1A1A 20%,
                      #9B2222 45%,
                      #8B1A1A 55%,
                      #6B1010 80%,
                      #4A0A0A 100%
                    )`,
                        zIndex: 10,
                        pointerEvents: "none"
                      }
                    },
                    `vdiv-${ci}`
                  );
                }),
                (() => {
                  const totalRows = Math.ceil(projects.length / columns);
                  return Array.from({ length: totalRows - 1 }, (_, ri) => {
                    const top = (ri + 1) * TILE_H + ri * GAP + DIVIDER_PAD;
                    return /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          left: -BORDER_PAD,
                          right: -BORDER_PAD,
                          top,
                          height: DIVIDER,
                          background: `linear-gradient(180deg,
                        #5C0E0E 0%,
                        #8B1A1A 20%,
                        #9B2222 45%,
                        #8B1A1A 55%,
                        #6B1010 80%,
                        #4A0A0A 100%
                      )`,
                          zIndex: 10,
                          pointerEvents: "none"
                        }
                      },
                      `hdiv-${ri}`
                    );
                  });
                })(),
                (() => {
                  const totalRows = Math.ceil(projects.length / columns);
                  const intersections = [];
                  const R = 56;
                  const S = 120;
                  const c = S / 2;
                  const hw = DIVIDER / 2;
                  const p = c - hw;
                  const q = c + hw;
                  const path = [
                    `M ${p} 0`,
                    `L ${q} 0`,
                    `A ${R} ${R} 0 0 0 ${S} ${p}`,
                    `L ${S} ${q}`,
                    `A ${R} ${R} 0 0 0 ${q} ${S}`,
                    `L ${p} ${S}`,
                    `A ${R} ${R} 0 0 0 0 ${q}`,
                    `L 0 ${p}`,
                    `A ${R} ${R} 0 0 0 ${p} 0`,
                    "Z"
                  ].join(" ");
                  for (let ci = 0; ci < columns - 1; ci++) {
                    if (ci + 1 >= projects.length) continue;
                    for (let ri = 0; ri < totalRows - 1; ri++) {
                      const cx = (ci + 1) * TILE_W + ci * GAP + DIVIDER_PAD + DIVIDER / 2;
                      const cy = (ri + 1) * TILE_H + ri * GAP + DIVIDER_PAD + DIVIDER / 2;
                      intersections.push(
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "svg",
                          {
                            width: S,
                            height: S,
                            viewBox: `0 0 ${S} ${S}`,
                            style: {
                              position: "absolute",
                              left: cx - c,
                              top: cy - c,
                              zIndex: 11,
                              pointerEvents: "none"
                            },
                            children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: path, fill: "#7A1818" })
                          },
                          `star-${ci}-${ri}`
                        )
                      );
                    }
                  }
                  return intersections;
                })()
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "rgba(255, 200, 200, 0.4)", fontSize: 13 }, children: "Drop a folder or click + to add a project" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "rgba(255, 200, 200, 0.2)", fontSize: 11 }, children: "Press Shift + Command + R to reload Bento" })
              ] })
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 100,
          height: 100,
          zIndex: 19,
          cursor: "pointer",
          ...{ WebkitAppRegion: "no-drag" }
        },
        onClick: handleAddClick
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "add-btn-wrap",
        onClick: handleAddClick,
        type: "button",
        style: {
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 80,
          height: 80,
          borderRadius: "0 0 calc(var(--bento-radius) - 1px) 0",
          border: "none",
          background: "#6B1010",
          color: "rgba(255, 180, 180, 0.6)",
          fontSize: 20,
          fontWeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20,
          clipPath: "polygon(100% 0%, 100% 100%, 0% 100%)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          ...{ WebkitAppRegion: "no-drag" }
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.width = "100px";
          e.currentTarget.style.height = "100px";
          e.currentTarget.style.fontSize = "24px";
          e.currentTarget.style.color = "rgba(255, 220, 220, 0.95)";
          e.currentTarget.style.background = "#7D1515";
          const span = e.currentTarget.querySelector("span");
          if (span) {
            span.style.bottom = "24px";
            span.style.right = "28px";
          }
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.width = "80px";
          e.currentTarget.style.height = "80px";
          e.currentTarget.style.fontSize = "20px";
          e.currentTarget.style.color = "rgba(255, 180, 180, 0.6)";
          e.currentTarget.style.background = "#6B1010";
          const span = e.currentTarget.querySelector("span");
          if (span) {
            span.style.bottom = "18px";
            span.style.right = "24px";
          }
        },
        title: "Add project",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { position: "absolute", bottom: "18px", right: "24px", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }, children: "+" })
      }
    )
  ] });
};
const StudioHome = () => {
  const { projects, isLoading } = useProjects();
  const { processes, startProject, stopProject, getProcessForProject } = useRunner();
  const pickerOpened = reactExports.useRef(false);
  reactExports.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") ipc.hideOverlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  reactExports.useEffect(() => {
    if (!isLoading && projects.length === 0 && !pickerOpened.current) {
      pickerOpened.current = true;
      ipc.openFolderPicker();
    }
  }, [isLoading, projects.length]);
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-screen w-screen", style: { background: "transparent" } });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "inline-flex", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    BentoGrid,
    {
      projects,
      processes,
      getProcessForProject,
      onStartProject: startProject,
      onStopProject: stopProject
    }
  ) });
};
const App = () => /* @__PURE__ */ jsxRuntimeExports.jsx(StudioHome, {});
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
