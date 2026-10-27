const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exitBridge', {
  submit: (code) => ipcRenderer.send('exit-code:submit', String(code)),
  cancel: () => ipcRenderer.send('exit-code:cancel'),
  onResult: (callback) => {
    ipcRenderer.on('exit-code:result', (_event, payload) => callback(payload));
  }
});
