// Gaussian contour reconstruction and 8x8 integration; binary masks are unchanged.
export function sampledCoverage(mask,w,h){
 if(w*h!==mask.length)throw Error('마스크 크기 불일치');
 const tmp=new Float32Array(mask.length),field=new Float32Array(mask.length),out=new Uint8Array(mask.length),kernel=[1,4,6,4,1];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let d=-2;d<=2;d++)sum+=mask[y*w+Math.max(0,Math.min(w-1,x+d))]*kernel[d+2];tmp[y*w+x]=sum/(255*16);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let d=-2;d<=2;d++)sum+=tmp[Math.max(0,Math.min(h-1,y+d))*w+x]*kernel[d+2];field[y*w+x]=sum/16;}
 const sample=(x,y)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),a=x-x0,b=y-y0;return (field[y0*w+x0]*(1-a)+field[y0*w+x1]*a)*(1-b)+(field[y1*w+x0]*(1-a)+field[y1*w+x1]*a)*b;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(field[p]===0)continue;if(field[p]===1){out[p]=255;continue;}let coverage=0;
  for(let sy=0;sy<8;sy++)for(let sx=0;sx<8;sx++){const v=sample(x+(sx+.5)/8-.5,y+(sy+.5)/8-.5),t=Math.max(0,Math.min(1,(v-.2)/.6));coverage+=t*t*(3-2*t);}
  out[p]=Math.round(coverage/64*255);
 }return out;
}
