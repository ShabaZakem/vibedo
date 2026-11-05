const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  saveText: (payload) => ipcRenderer.invoke('file:saveText', payload),
  info: () => ipcRenderer.invoke('app:info'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  focusWindow: () => ipcRenderer.invoke('window:focus'),
  syncStart: (payload) => ipcRenderer.invoke('sync:start', payload),
  syncStop: () => ipcRenderer.invoke('sync:stop'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  onSyncUpdated: (handler) => {
    const listener = (_event, data) => handler(data)
    ipcRenderer.on('sync:updated', listener)
    return () => ipcRenderer.removeListener('sync:updated', listener)
  },
  onSyncRequest: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('sync:request-snapshot', listener)
    return () => ipcRenderer.removeListener('sync:request-snapshot', listener)
  },
  sendSnapshot: (data) => ipcRenderer.send('sync:snapshot', data),
})
