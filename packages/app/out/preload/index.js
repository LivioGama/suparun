"use strict";
const electron = require("electron");
const api = {
  webUtils: {
    getPathForFile: (file) => electron.webUtils.getPathForFile(file)
  },
  getDetectedProjects: () => electron.ipcRenderer.invoke("get-detected-projects"),
  startProcess: (projectPath, scriptName, packageManager) => electron.ipcRenderer.invoke("start-process", projectPath, scriptName, packageManager),
  stopProcess: (processId) => electron.ipcRenderer.invoke("stop-process", processId),
  restartProcess: (processId) => electron.ipcRenderer.invoke("restart-process", processId),
  getRunningProcesses: () => electron.ipcRenderer.invoke("get-running-processes"),
  getLogBuffer: (processId) => electron.ipcRenderer.invoke("get-log-buffer", processId),
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  updateSettings: (settings) => electron.ipcRenderer.invoke("update-settings", settings),
  getHistory: () => electron.ipcRenderer.invoke("get-history"),
  removeHistory: (path) => electron.ipcRenderer.invoke("remove-history", path),
  clearHistory: () => electron.ipcRenderer.invoke("clear-history"),
  openInBrowser: (port, vhostName) => electron.ipcRenderer.invoke("open-in-browser", port, vhostName),
  openInFinder: (folderPath) => electron.ipcRenderer.invoke("open-in-finder", folderPath),
  openInEditor: (folderPath) => electron.ipcRenderer.invoke("open-in-editor", folderPath),
  openInClaudeCode: (folderPath) => electron.ipcRenderer.invoke("open-in-claude-code", folderPath),
  addFolder: (folderPath) => electron.ipcRenderer.invoke("add-folder", folderPath),
  removeFolder: (folderPath) => electron.ipcRenderer.invoke("remove-folder", folderPath),
  openFolderPicker: () => electron.ipcRenderer.invoke("open-folder-picker"),
  hideOverlay: () => electron.ipcRenderer.invoke("hide-overlay"),
  resizeWindow: (width, height) => electron.ipcRenderer.invoke("resize-window", width, height),
  showContextMenu: () => electron.ipcRenderer.invoke("show-context-menu"),
  getScreenWidth: () => electron.ipcRenderer.invoke("get-screen-width"),
  onScreenChanged: (callback) => {
    const handler = (_event, screenWidth) => callback(screenWidth);
    electron.ipcRenderer.on("screen-changed", handler);
    return () => {
      electron.ipcRenderer.removeListener("screen-changed", handler);
    };
  },
  onProjectsChanged: (callback) => {
    const handler = (_event, projects) => callback(projects);
    electron.ipcRenderer.on("projects-changed", handler);
    return () => {
      electron.ipcRenderer.removeListener("projects-changed", handler);
    };
  },
  onLogBatch: (callback) => {
    const handler = (_event, lines) => callback(lines);
    electron.ipcRenderer.on("log-batch", handler);
    return () => {
      electron.ipcRenderer.removeListener("log-batch", handler);
    };
  },
  onProcessStatusChanged: (callback) => {
    const handler = (_event, process) => callback(process);
    electron.ipcRenderer.on("process-status-changed", handler);
    return () => {
      electron.ipcRenderer.removeListener("process-status-changed", handler);
    };
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
