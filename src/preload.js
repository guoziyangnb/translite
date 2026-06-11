const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('translator', {
  getSettings: () => ipcRenderer.invoke('translator:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('translator:save-settings', settings),
  selectDirectory: (defaultPath) => ipcRenderer.invoke('translator:select-directory', defaultPath),
  downloadLocalModel: (payload) => ipcRenderer.invoke('translator:download-local-model', payload),
  loadLocalModel: (payload) => ipcRenderer.invoke('translator:load-local-model', payload),
  translateLocal: (payload) => ipcRenderer.invoke('translator:translate-local', payload),
  translateOnline: (payload) => ipcRenderer.invoke('translator:translate-online', payload),
  fetchOnlineModels: (endpoint) => ipcRenderer.invoke('translator:fetch-online-models', endpoint),
  testOnlineEndpoint: (endpoint) => ipcRenderer.invoke('translator:test-online-endpoint', endpoint),
  testUsageConfig: (endpoint) => ipcRenderer.invoke('translator:test-usage-config', endpoint),
  activateOnlineEndpoint: (endpoint) => ipcRenderer.invoke('translator:activate-online-endpoint', endpoint),
  getShortcut: () => ipcRenderer.invoke('translator:get-shortcut'),
  savePreferences: (preferences) => ipcRenderer.invoke('translator:save-preferences', preferences),
  getConfigPath: () => ipcRenderer.invoke('translator:get-config-path'),
  openExternal: (url) => ipcRenderer.invoke('translator:open-external', url),
  revealConfig: () => ipcRenderer.invoke('translator:reveal-config'),
  checkUpdate: () => ipcRenderer.invoke('translator:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('translator:download-update'),
  installUpdate: () => ipcRenderer.invoke('translator:install-update'),
  getAppInfo: () => ipcRenderer.invoke('translator:get-app-info'),
  hide: () => ipcRenderer.invoke('translator:hide'),
  onFocusInput: (callback) => {
    ipcRenderer.on('translator:focus-input', callback);
  },
  onLocalProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('translator:local-progress', listener);
    return () => ipcRenderer.removeListener('translator:local-progress', listener);
  },
  onUpdateEvent: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('translator:update-event', listener);
    return () => ipcRenderer.removeListener('translator:update-event', listener);
  }
});
