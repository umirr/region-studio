const {app,BrowserWindow,ipcMain,dialog,session,nativeImage}=require('electron');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {Store,atomic}=require('./storage.cjs');
const {registerSubmission}=require('./submission.cjs');
const {registerCloudUpload}=require('./cloud-upload.cjs');
app.disableHardwareAcceleration();
if(!app.isPackaged&&process.env.REGION_STUDIO_TEST_DATA){app.commandLine.appendSwitch('in-process-gpu');app.commandLine.appendSwitch('no-sandbox');}
let window,server,origin,store,closing=false;const prefix='/'+crypto.randomBytes(24).toString('hex'),destinations=new Map();
if(!app.isPackaged&&process.env.REGION_STUDIO_TEST_DATA)app.setPath('userData',process.env.REGION_STUDIO_TEST_DATA);
const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.onnx':'application/octet-stream'};
function check(event){if(event.sender!==window.webContents||!event.senderFrame?.url.startsWith(origin+prefix+'/'))throw Error('허용되지 않은 요청');}
function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{check(e);return fn(...args);});}
const png=s=>{if(typeof s!=='string'||!s.startsWith('data:image/png;base64,'))throw Error('PNG가 필요합니다.');const b=Buffer.from(s.slice(22),'base64');if(b.length>40000000||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('잘못된 PNG');return b;};
app.whenReady().then(async()=>{
 store=new Store(path.join(app.getPath('userData'),'projects'));
 server=http.createServer(async(req,res)=>{try{
  if(req.method!=='GET'){res.writeHead(405).end();return;}const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix+'/')){res.writeHead(404).end();return;}
  const relative=decodeURIComponent(url.pathname.slice(prefix.length+1));let data,type;
  if(relative.startsWith('image/')||relative.startsWith('thumb/')){const id=relative.split('/')[1],item=store.item(id);if(relative.startsWith('thumb/')){const im=nativeImage.createFromPath(item.path);data=im.resize({width:100}).toPNG();type='image/png';}else{data=await fs.readFile(item.path);type=mime[path.extname(item.path).toLowerCase()];}}
  else{const root=path.join(__dirname,'ui'),file=path.resolve(root,relative||'index.html');if(!file.startsWith(root+path.sep))throw Error('경로 오류');data=await fs.readFile(file);type=mime[path.extname(file)]||'application/octet-stream';}
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.end(data);
 }catch(e){res.writeHead(404).end('Not found');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 window=new BrowserWindow({show:app.isPackaged||!process.env.REGION_STUDIO_TEST_DATA,width:1500,height:1000,minWidth:1000,minHeight:700,title:'Region Studio',backgroundColor:'#171d28',webPreferences:{preload:path.join(__dirname,'preload.cjs'),backgroundThrottling:app.isPackaged||!process.env.REGION_STUDIO_TEST_DATA,contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.setMenuBarVisibility(false);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+prefix+'/'))e.preventDefault();});session.defaultSession.setPermissionRequestHandler((_,__,cb)=>cb(false));
 handle('folder',async()=>{const r=await dialog.showOpenDialog(window,{title:'이미지 폴더 선택',properties:['openDirectory']});if(r.canceled)return null;return store.open(r.filePaths[0]);});
 registerCloudUpload({handle,app,atomic});
 registerSubmission({handle,store,dialog,getWindow:()=>window,app,nativeImage,atomic});
 handle('rescan',()=>store.folder?store.open(store.folder):null);handle('cache-read',id=>store.cacheRead(id));handle('cache-write',(id,data)=>store.cacheWrite(id,data));
 handle('preferences-read',async()=>{try{return JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'preferences.json'),'utf8'));}catch{return {};}});handle('preferences-save',async p=>{if(!p||!['#ffffff','#000000'].includes(p.color))throw Error('잘못된 기본 색상');await atomic(path.join(app.getPath('userData'),'preferences.json'),JSON.stringify({color:p.color}));});
 handle('read',id=>store.read(id));handle('save',(id,s)=>store.save(id,s));
 handle('destination',async kind=>{if(!['dataset','results'].includes(kind))throw Error('잘못된 내보내기');const r=await dialog.showOpenDialog(window,{title:'내보낼 위치 선택',properties:['openDirectory','createDirectory']});if(r.canceled)return null;const token=crypto.randomUUID(),dir=path.join(r.filePaths[0],'Region-Studio-'+kind+'-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.mkdir(dir,{recursive:true});destinations.set(token,{kind,dir});return token;});
 handle('write',async(token,id,p)=>{const d=destinations.get(token),item=store.item(id);if(!d)throw Error('내보내기 위치가 없습니다.');if(d.kind==='results'&&p.skipped){const state=await store.read(id);if(!state?.skipped)throw Error('스킵 상태가 아닙니다.');await fs.copyFile(item.path,path.join(d.dir,item.name));return;}if(d.kind==='results'){await atomic(path.join(d.dir,path.parse(item.name).name+'-'+id.slice(0,6)+'.png'),png(p.image));return;}
  const state=await store.read(id);if(!state?.approved||state.skipped)throw Error('확정되지 않은 이미지');const dir=path.join(d.dir,id);await fs.mkdir(dir,{recursive:true});await fs.copyFile(item.path,path.join(dir,'image'+path.extname(item.path).toLowerCase()));if(!Array.isArray(p.masks)||p.masks.length>30)throw Error('잘못된 마스크');for(let i=0;i<p.masks.length;i++)await atomic(path.join(dir,'mask-'+String(i+1).padStart(3,'0')+'.png'),png(p.masks[i]));await atomic(path.join(dir,'annotation.json'),JSON.stringify({version:1,source:item.name,image:'image'+path.extname(item.path).toLowerCase(),width:state.width,height:state.height,layers:state.layers.filter(l=>l.mask&&Buffer.from(l.mask,'base64').some(x=>x)).map((l,i)=>({id:i+1,mask:'mask-'+String(i+1).padStart(3,'0')+'.png'})),approved:true},null,2));
 });
 handle('finish',async(token,manifest)=>{const d=destinations.get(token);if(!d)throw Error('내보내기 세션이 없습니다.');if(d.kind==='dataset')await atomic(path.join(d.dir,'dataset.json'),JSON.stringify({format:'region-studio-binary-masks',version:1,...manifest},null,2));destinations.delete(token);return d.dir;});
 ipcMain.on('close-ready',e=>{check(e);closing=true;window.close();});ipcMain.on('close-failed',(e,message)=>{check(e);dialog.showMessageBox(window,{type:'error',message:'자동 저장에 실패했습니다. 앱을 닫지 않았습니다.',detail:String(message)});});
 window.on('close',e=>{if(!closing){e.preventDefault();window.webContents.send('flush-before-close');}});
 await window.loadURL(origin+prefix+'/index.html');
});
app.on('window-all-closed',()=>{server?.close();app.quit();});
