const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24);
const extensions=new Set(['.png','.jpg','.jpeg','.webp']);
async function catalog(folder){const entries=await fs.readdir(folder,{withFileTypes:true});const files=[];for(const e of entries){if(!e.isFile()||!extensions.has(path.extname(e.name).toLowerCase()))continue;const p=path.join(folder,e.name),s=await fs.stat(p);files.push({id:hash(p.toLowerCase()),name:e.name,path:p,legacySignature:`${s.size}:${s.mtimeMs}`,signature:crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex')});}return files.sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));}
async function atomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,data);await fs.rename(temp,file);}
function validate(state){if(!state||state.version!==2||!Number.isInteger(state.width)||!Number.isInteger(state.height)||state.width<1||state.height<1||state.width*state.height>5000000||!Array.isArray(state.layers)||state.layers.length>30)throw Error('잘못된 작업 데이터');for(const l of state.layers){if(typeof l.mask!=='string'||Buffer.from(l.mask,'base64').length!==state.width*state.height||!/^#[0-9a-f]{6}$/i.test(l.color)||!Number.isFinite(l.strength)||l.strength<0||l.strength>1||typeof l.name!=='string'||l.name.length>100)throw Error('잘못된 레이어');}return state;}
class Store{
 constructor(root){this.root=root;this.items=new Map();this.queue=Promise.resolve();}
 async open(folder){await this.queue;this.folder=folder;this.dir=path.join(this.root,hash(folder.toLowerCase()));const files=await catalog(folder);this.items=new Map(files.map(f=>[f.id,f]));const list=[];for(const f of files){const s=await this.read(f.id);list.push({id:f.id,name:f.name,signature:f.signature,prepared:await this.hasCache(f.id),status:s?.skipped?'skipped':s?.approved?'approved':s?'working':'new'});}return {folder,files:list};}
 cachePath(id){return path.join(this.dir,'embeddings-v1',this.item(id).signature+'.bin');}
 async hasCache(id){try{await fs.access(this.cachePath(id));return true;}catch{return false;}}
 async cacheRead(id){try{return require('node:v8').deserialize(await fs.readFile(this.cachePath(id)));}catch{return null;}}
 async cacheWrite(id,data){const b=require('node:v8').serialize(data);if(b.length>100000000)throw Error('분석 캐시 크기 초과');await atomic(this.cachePath(id),b);}
 item(id){const item=this.items.get(id);if(!item)throw Error('목록에 없는 이미지');return item;}
 async read(id){const f=this.item(id);try{const s=JSON.parse(await fs.readFile(path.join(this.dir,id+'.json'),'utf8'));if(s.signature!==f.signature&&s.signature!==f.legacySignature)return null;validate(s);if(s.signature===f.legacySignature){s.signature=f.signature;await atomic(path.join(this.dir,id+'.json'),JSON.stringify(s));}return s;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 save(id,state){const f=this.item(id),dir=this.dir;validate(state);const s={...state,signature:f.signature,updatedAt:new Date().toISOString()};const task=this.queue.catch(()=>{}).then(()=>atomic(path.join(dir,id+'.json'),JSON.stringify(s)));this.queue=task;return task;}
}
module.exports={Store,atomic,validate,hash};
