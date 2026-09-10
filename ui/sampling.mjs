// Reconstruct a smooth scalar contour and integrate 4×4 subpixel samples.
// Sampling only affects rendering; pixels outside the binary mask stay untouched.
export function sampledCoverage(mask,w,h){const field=new Float32Array(mask.length),out=new Uint8Array(mask.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=Math.max(0,Math.min(w-1,x+dx)),yy=Math.max(0,Math.min(h-1,y+dy));sum+=mask[yy*w+xx]/255*(dx===0?2:1)*(dy===0?2:1);}field[y*w+x]=sum/16;}
 const sample=(x,y)=>{x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),a=x-x0,b=y-y0;return (field[y0*w+x0]*(1-a)+field[y0*w+x1]*a)*(1-b)+(field[y1*w+x0]*(1-a)+field[y1*w+x1]*a)*b;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!mask[p])continue;if(field[p]>.999){out[p]=255;continue;}let coverage=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)coverage+=Math.max(0,Math.min(1,(sample(x+(sx+.5)/4-.5,y+(sy+.5)/4-.5)-.5)*4+.5));out[p]=Math.min(mask[p],Math.max(24,Math.round(coverage/16*255)));}return out;
}
