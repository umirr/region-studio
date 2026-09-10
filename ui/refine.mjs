// Pure mask post-processing. No image generation or source pixel mutation.
export function refineMask(input,w,h,points,{fill=true}={}){
 if(input.length!==w*h)throw Error('마스크 크기 불일치');
 const out=new Uint8Array(input),valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 const toPixel=p=>({x:Math.max(0,Math.min(w-1,Math.floor(p.x*w))),y:Math.max(0,Math.min(h-1,Math.floor(p.y*h)))});
 const positives=[...new Map(valid.filter(p=>p.label===1).map(p=>{const q=toPixel(p);return [q.y*w+q.x,q];})).values()];
 const negatives=valid.filter(p=>p.label===0).map(toPixel);
 if(!positives.length)return {mask:out,removed:0,filled:0,radius:null};
 let radius=null;
 const queue=new Int32Array(w*h),seen=new Uint8Array(w*h);
 if(fill){let head=0,tail=0;const push=i=>{if(!seen[i]&&!out[i]){seen[i]=1;queue[tail++]=i;}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}for(const p of negatives)push(p.y*w+p.x);
  while(head<tail){const i=queue[head++],x=i%w;if(x)push(i-1);if(x<w-1)push(i+1);if(i>=w)push(i-w);if(i<(h-1)*w)push(i+w);}
  for(let i=0;i<out.length;i++)if(!out[i]&&!seen[i])out[i]=255;
 }
 for(const p of negatives)out[p.y*w+p.x]=0;
 let removed=0,filled=0;for(let i=0;i<out.length;i++){if(input[i]&&!out[i])removed++;if(!input[i]&&out[i])filled++;}
 return {mask:out,removed,filled,radius};
}
