export function setupPanels(save){
 const main=document.querySelector('main'),sizes={libraryWidth:205,toolsWidth:285},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function apply(){const available=Math.max(370,main.clientWidth-336),factor=Math.min(1,available/(sizes.libraryWidth+sizes.toolsWidth));const left=Math.max(150,sizes.libraryWidth*factor),right=Math.max(220,sizes.toolsWidth*factor);main.style.gridTemplateColumns=`${left}px 8px minmax(0,1fr) 8px ${right}px`;for(const [id,key,value] of [['libraryResize','libraryWidth',left],['toolsResize','toolsWidth',right]]){const e=document.getElementById(id);e.setAttribute('aria-valuemin',key==='libraryWidth'?150:220);e.setAttribute('aria-valuemax',900);e.setAttribute('aria-valuenow',Math.round(value));}}
 for(const [id,key,sign,min] of [['libraryResize','libraryWidth',1,150],['toolsResize','toolsWidth',-1,220]]){const el=document.getElementById(id);let drag;
 el.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={x:e.clientX,width:(key==='libraryWidth'?document.querySelector('.library'):document.querySelector('aside')).getBoundingClientRect().width};el.setPointerCapture(e.pointerId);document.body.classList.add('resizing');};
 el.onpointermove=e=>{if(!drag)return;sizes[key]=clamp(drag.width+sign*(e.clientX-drag.x),min,Math.max(min,Math.min(900,main.clientWidth-336-sizes[key==='libraryWidth'?'toolsWidth':'libraryWidth'])));apply();save({[key]:sizes[key]});};
 const end=()=>{drag=null;document.body.classList.remove('resizing');};el.onpointerup=end;el.onpointercancel=end;el.onlostpointercapture=end;
 el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();sizes[key]=clamp(sizes[key]+(e.key==='ArrowRight'?1:-1)*sign*10,min,900);apply();save({[key]:sizes[key]});};}
 new ResizeObserver(apply).observe(main);apply();return {restore(p){for(const key of Object.keys(sizes))if(Number.isFinite(p[key])&&p[key]>=(key==='libraryWidth'?150:220)&&p[key]<=900)sizes[key]=p[key];apply();}};
}
