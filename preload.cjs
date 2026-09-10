const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
 preferencesRead:()=>ipcRenderer.invoke('preferences-read'),preferencesSave:p=>ipcRenderer.invoke('preferences-save',p),
 betaUpload:(id,code)=>ipcRenderer.invoke('beta-upload',id,code),
 betaProfile:()=>ipcRenderer.invoke('beta-profile'),betaBegin:r=>ipcRenderer.invoke('beta-begin',r),betaAdd:(t,id,image)=>ipcRenderer.invoke('beta-add',t,id,image),betaFinish:t=>ipcRenderer.invoke('beta-finish',t),betaCancel:t=>ipcRenderer.invoke('beta-cancel',t),
 rescan:()=>ipcRenderer.invoke('rescan'),cacheRead:id=>ipcRenderer.invoke('cache-read',id),cacheWrite:(id,data)=>ipcRenderer.invoke('cache-write',id,data),
 openFolder:()=>ipcRenderer.invoke('folder'),read:id=>ipcRenderer.invoke('read',id),save:(id,s)=>ipcRenderer.invoke('save',id,s),
 destination:kind=>ipcRenderer.invoke('destination',kind),write:(token,id,payload)=>ipcRenderer.invoke('write',token,id,payload),
 finish:(token,manifest)=>ipcRenderer.invoke('finish',token,manifest),
 onClose:fn=>ipcRenderer.on('flush-before-close',()=>fn()),closeReady:()=>ipcRenderer.send('close-ready'),closeFailed:message=>ipcRenderer.send('close-failed',message)
});
