const fs=require('node:fs/promises'),path=require('node:path');const {atomic}=require('./storage.cjs');
const ranges={libraryWidth:[150,900],toolsWidth:[220,900],brush:[2,300],edgeStrength:[0,100],anchorRadius:[5,100],fillConfidence:[60,100],lineGap:[0,4],smoothAmount:[1,6],strength:[0,100]};
class Preferences{
 constructor(root){this.file=path.join(root,'settings-v1.json');this.legacy=path.join(root,'preferences.json');this.queue=Promise.resolve();}
 async json(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
 async load(){let saved;try{saved=await this.json(this.file);}catch{saved=await this.json(this.file+'.backup');}if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};let legacy;try{legacy=await this.json(this.legacy);}catch{legacy={};}return {...saved,...(['#ffffff','#000000'].includes(legacy.color)?{color:legacy.color}:{})};}
 async read(){await this.queue;return this.load();}
 save(p){const task=this.queue.catch(()=>{}).then(async()=>{if(!p||typeof p!=='object')throw Error('잘못된 설정');const patch={};for(const [k,v] of Object.entries(p)){if(k==='color'&&['#ffffff','#000000'].includes(v))patch[k]=v;else if(k in ranges&&Number.isFinite(v)&&v>=ranges[k][0]&&v<=ranges[k][1])patch[k]=v;else if(['fillHoles','overlay','refinementOpen'].includes(k)&&typeof v==='boolean')patch[k]=v;else if(k==='tool'&&['positive','negative','line','paint','erase'].includes(v))patch[k]=v;else throw Error('잘못된 설정: '+k);}const previous=await this.load(),next={...previous,...patch};await atomic(this.file+'.backup',JSON.stringify(previous));await atomic(this.file,JSON.stringify(next));if('color' in patch)await atomic(this.legacy,JSON.stringify({color:patch.color}));return next;});this.queue=task;return task;}
}
module.exports={Preferences};
