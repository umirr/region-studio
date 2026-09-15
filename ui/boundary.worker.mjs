import {edgeMap,selectBounded,smoothMask} from './boundary.mjs';
let edge,w,h;
self.onmessage=({data:m})=>{try{if(m.type==='init'){w=m.width;h=m.height;edge=edgeMap(new Uint8ClampedArray(m.pixels),w,h);self.postMessage({request:m.request,ok:true});return;}if(!edge)throw Error('이미지 경계가 준비되지 않았습니다.');const result=m.type==='smooth'?{mask:smoothMask(m.mask,w,h,m.points,edge,m.amount)}:selectBounded(m.mask,w,h,m.points,edge,m.options);self.postMessage({request:m.request,...result},[result.mask.buffer]);}catch(e){self.postMessage({request:m.request,error:e.message});}};
