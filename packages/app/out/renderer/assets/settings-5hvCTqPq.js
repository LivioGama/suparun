import { r as reactExports, i as ipc, j as jsxRuntimeExports, c as client, R as React } from "./globals-fvwobLbG.js";
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
const useSettings = () => {
  const [settings, setSettings] = reactExports.useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    ipc.getSettings().then((s) => {
      setSettings(s);
      setIsLoading(false);
    });
  }, []);
  const updateSettings = reactExports.useCallback(async (partial) => {
    const updated = await ipc.updateSettings(partial);
    setSettings(updated);
    return updated;
  }, []);
  return { settings, updateSettings, isLoading };
};
const SettingsView = ({ onBack }) => {
  const { settings, updateSettings, isLoading } = useSettings();
  const [newTag, setNewTag] = reactExports.useState("");
  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !settings.scriptNames.includes(tag)) {
      updateSettings({ scriptNames: [...settings.scriptNames, tag] });
      setNewTag("");
    }
  };
  const handleRemoveTag = (name) => {
    updateSettings({ scriptNames: settings.scriptNames.filter((s) => s !== name) });
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center h-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", style: { color: "var(--text-muted)" }, children: "Loading..." }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col h-full", style: { background: "var(--bg-primary, #1a1a1a)" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 overflow-y-auto p-5 flex flex-col gap-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Script Names" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-1", children: settings.scriptNames.map((name) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "span",
        {
          className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
          style: { background: "var(--bg-tertiary)", color: "var(--text-primary)" },
          children: [
            name,
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => handleRemoveTag(name),
                className: "w-3.5 h-3.5 flex items-center justify-center rounded-full border-none bg-transparent text-[10px] leading-none",
                style: { color: "var(--text-muted)" },
                onMouseEnter: (e) => e.currentTarget.style.color = "var(--error)",
                onMouseLeave: (e) => e.currentTarget.style.color = "var(--text-muted)",
                children: "x"
              }
            )
          ]
        },
        name
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "text",
            value: newTag,
            onChange: (e) => setNewTag(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: "Add script name...",
            className: "flex-1 px-2 py-1 rounded text-xs border-none outline-none",
            style: {
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)"
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleAddTag,
            className: "px-2 py-1 rounded text-xs border-none",
            style: { background: "var(--accent)", color: "#fff" },
            onMouseEnter: (e) => e.currentTarget.style.background = "var(--accent-hover)",
            onMouseLeave: (e) => e.currentTarget.style.background = "var(--accent)",
            children: "Add"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          label: "Auto-restart on crash",
          checked: settings.autoRestart,
          onChange: (v) => updateSettings({ autoRestart: v })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          label: "Notifications",
          checked: settings.notifications,
          onChange: (v) => updateSettings({ notifications: v })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          label: "Launch at login",
          checked: settings.launchAtLogin,
          onChange: (v) => updateSettings({ launchAtLogin: v })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          label: "Virtual hosts (app.localhost:2999)",
          checked: settings.vhostEnabled,
          onChange: (v) => updateSettings({ vhostEnabled: v })
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Max crash restarts" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "number",
          min: 1,
          max: 100,
          value: settings.maxCrashCount,
          onChange: (e) => updateSettings({ maxCrashCount: parseInt(e.target.value) || 1 }),
          className: "w-20 px-2 py-1 rounded text-xs border-none outline-none",
          style: { background: "var(--bg-tertiary)", color: "var(--text-primary)" }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Favorite Editor" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: settings.favoriteEditor || "code",
          onChange: (e) => updateSettings({ favoriteEditor: e.target.value }),
          className: "w-48 px-2 py-1 rounded text-xs border-none outline-none",
          style: { background: "var(--bg-tertiary)", color: "var(--text-primary)" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "code", children: "VS Code" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "cursor", children: "Cursor" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "zed", children: "Zed" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "webstorm", children: "WebStorm" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "subl", children: "Sublime Text" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Terminal Coding Tool" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: settings.terminalCodingTool || "claude",
          onChange: (e) => updateSettings({ terminalCodingTool: e.target.value }),
          className: "w-48 px-2 py-1 rounded text-xs border-none outline-none",
          style: { background: "var(--bg-tertiary)", color: "var(--text-primary)" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "claude", children: "Claude Code" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "opencode", children: "OpenCode" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "codex", children: "Codex" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "gemini", children: "Gemini" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "jimmy", children: "Jimmy (llama3.1-8B)" })
          ]
        }
      )
    ] }),
    settings.terminalCodingTool === "jimmy" && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Jimmy API Key" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "password",
          value: settings.jimmyApiKey || "",
          onChange: (e) => updateSettings({ jimmyApiKey: e.target.value }),
          placeholder: "Enter API key...",
          className: "w-full px-2 py-1 rounded text-xs border-none outline-none",
          style: { background: "var(--bg-tertiary)", color: "var(--text-primary)" }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium", style: { color: "var(--text-secondary)" }, children: "Global shortcut" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "span",
        {
          className: "text-xs px-2 py-1 rounded inline-block w-fit",
          style: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
          children: settings.globalShortcut
        }
      )
    ] })
  ] }) });
};
const ToggleRow = ({ label, checked, onChange }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", style: { color: "var(--text-primary)" }, children: label }),
  /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick: () => onChange(!checked),
      className: "relative w-8 h-[18px] rounded-full border-none transition-colors",
      style: { background: checked ? "var(--success)" : "var(--text-muted)" },
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "span",
        {
          className: "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all",
          style: { left: checked ? 14 : 2 }
        }
      )
    }
  )
] });
const SettingsApp = () => /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsView, { onBack: () => window.close() });
client.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsApp, {}) })
);
