import {compose,edgeCoverage} from './core.mjs';
let source,w,h;
const preparedCache=new Map();
self.onmessage=({data:m})=>{try{
 if(m.source){source=new Uint8ClampedArray(m.source);w=m.w;h=m.h;preparedCache.clear();}
 const cache=new WeakMap();
 for(const layer of m.layers){const saved=preparedCache.get(layer.cacheKey);if(saved?.revision===layer.maskRevision&&saved.width===w&&saved.height===h)cache.set(layer.mask,saved);}
 const result=compose(source,m.layers,cache,w,h);
 let overlay=null;
 if(m.overlay&&m.layers[m.active]){const layer=m.layers[m.active],coverage=cache.get(layer.mask)?.coverage||edgeCoverage(layer.mask,w,h);overlay=new Uint8ClampedArray(w*h*4);for(let p=0;p<coverage.length;p++)if(coverage[p]){overlay[p*4]=72;overlay[p*4+1]=225;overlay[p*4+2]=205;overlay[p*4+3]=Math.round(75*coverage[p]/255);}}
 for(const layer of m.layers){const prepared=cache.get(layer.mask);if(prepared)preparedCache.set(layer.cacheKey,{...prepared,revision:layer.maskRevision});}
 if(preparedCache.size>30){for(const key of preparedCache.keys()){if(!m.layers.some(layer=>layer.cacheKey===key))preparedCache.delete(key);}}
 self.postMessage({image:m.image,result,overlay},[result.buffer,...(overlay?[overlay.buffer]:[])]);
}catch(e){self.postMessage({image:m.image,error:e.message});}};
