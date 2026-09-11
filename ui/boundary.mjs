const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function edgeMap(rgba,w,h){
 const lum=new Float32Array(w*h),edge=new Uint8Array(w*h);
 for(let i=0;i<lum.length;i++)lum[i]=(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x;
  const gx=lum[p-w+1]+2*lum[p+1]+lum[p+w+1]-lum[p-w-1]-2*lum[p-1]-lum[p+w-1];
  const gy=lum[p+w-1]+2*lum[p+w]+lum[p+w+1]-lum[p-w-1]-2*lum[p-w]-lum[p-w+1];
  const ridge=Math.max(0,(lum[p-1]+lum[p+1]+lum[p-w]+lum[p+w])/4-lum[p]);
  edge[p]=Math.round(clamp(Math.hypot(gx,gy)/3+ridge*2,0,1)*255);
 }return edge;
}
function seeds(points,w,h,label){return points.filter(p=>p.label===label&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>clamp(Math.floor(p.y*h),0,h-1)*w+clamp(Math.floor(p.x*w),0,w-1));}
function barrierMap(edge,w,h,strength,gap){const threshold=clamp(165-strength*1.3,25,165),b=Uint8Array.from(edge,v=>v>=threshold?1:0);if(gap<=0)return b;const out=b.slice(),r=clamp(Math.round(gap),1,4);
 // Bridge short horizontal/vertical line breaks, without expanding every line.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(b[p])continue;let left=false,right=false,up=false,down=false;for(let d=1;d<=r;d++){if(x>=d&&b[p-d])left=true;if(x+d<w&&b[p+d])right=true;if(y>=d&&b[p-d*w])up=true;if(y+d<h&&b[p+d*w])down=true;}if(left&&right||up&&down)out[p]=1;}return out;
}
export function selectBounded(input,w,h,points,edge,{strength=65,radius=35,gap=1,lineOnly=false,confidence=90}={}){
 const positives=seeds(points,w,h,1),negatives=new Set(seeds(points,w,h,0)),out=new Uint8Array(w*h);
 if(!positives.length)return {mask:input.slice(),confidence:0,accepted:false};
 const barrier=barrierMap(edge,w,h,strength,gap),allowed=new Uint8Array(w*h),r=Math.max(8,Math.min(w,h)*radius/100),r2=r*r;
 for(const p of positives){const sx=p%w,sy=Math.floor(p/w);for(let y=Math.max(0,Math.ceil(sy-r));y<=Math.min(h-1,Math.floor(sy+r));y++)for(let x=Math.max(0,Math.ceil(sx-r));x<=Math.min(w-1,Math.floor(sx+r));x++)if((x-sx)**2+(y-sy)**2<=r2)allowed[y*w+x]=1;}
 // Exclusion seeds compete spatially with inclusion seeds at 1.3x weight.
 // Inclusion coordinates, radius and model prompts remain unchanged.
 if(negatives.size)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!allowed[p])continue;let positiveDistance=Infinity,negativeDistance=Infinity;for(const q of positives)positiveDistance=Math.min(positiveDistance,(x-q%w)**2+(y-Math.floor(q/w))**2);for(const q of negatives)negativeDistance=Math.min(negativeDistance,(x-q%w)**2+(y-Math.floor(q/w))**2);if(negativeDistance<=positiveDistance*(1.3*1.3))allowed[p]=0;}
 const queue=new Int32Array(w*h),seen=new Uint8Array(w*h);let head=0,tail=0,perimeter=0,sealed=0,touchesLimit=false;
 const push=p=>{if(!seen[p]&&allowed[p]&&!barrier[p]&&!negatives.has(p)&&(lineOnly||input[p])){seen[p]=1;queue[tail++]=p;out[p]=255;}};
 for(const p of positives){if(barrier[p]){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=p%w+dx,y=Math.floor(p/w)+dy;if(x>=0&&x<w&&y>=0&&y<h)push(y*w+x);}}else push(p);}
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1]){if(q<0){perimeter++;touchesLimit=true;continue;}if(barrier[q]||!allowed[q]||negatives.has(q)||!lineOnly&&!input[q]){perimeter++;if(barrier[q])sealed+=edge[q]?Math.min(1,.5+edge[q]/255):.25;if(!allowed[q]||negatives.has(q))touchesLimit=true;}else push(q);}}
 const score=tail>=4&&!touchesLimit&&perimeter?Math.round(sealed/perimeter*100):0;
 if(lineOnly&&(score<confidence||tail<4))return {mask:input.slice(),confidence:score,accepted:false};
 return {mask:out,confidence:score,accepted:true,selected:tail};
}
export function smoothMask(mask,w,h,points,edge,amount=2){let out=mask.slice();const protectedPixels=new Map([...seeds(points,w,h,1).map(p=>[p,255]),...seeds(points,w,h,0).map(p=>[p,0])]);
 for(let pass=0;pass<clamp(Math.round(amount),1,6);pass++){const next=out.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x;if(edge[p]>110)continue;let total=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)total+=(out[p+dy*w+dx]?1:0)*(dx===0?2:1)*(dy===0?2:1);if(total>8)next[p]=255;else if(total<8)next[p]=0;}for(const [p,value] of protectedPixels)next[p]=value;out=next;}return out;
}
