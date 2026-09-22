import {compose} from './core.mjs';
self.onmessage=({data:m})=>{
 try {
  const result=compose(m.source,m.layers,undefined,m.width,m.height);
  self.postMessage({changed:result.some((value,i)=>value!==m.source[i])});
 } catch(e) { self.postMessage({error:e.message}); }
};
