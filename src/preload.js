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
  hide: () => ipcRenderer.invoke('translator:hide'),
  onFocusInput: (callback) => {
    ipcRenderer.on('translator:focus-input', callback);
  },
  onLocalProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('translator:local-progress', listener);
    return () => ipcRenderer.removeListener('translator:local-progress', listener);
  }
});
