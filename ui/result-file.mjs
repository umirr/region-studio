export function encodeResult(data,width,height,name){
 const ext=name.split('.').pop().toLowerCase();
 const type={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ext];
 if(!type)throw Error('지원하지 않는 이미지 형식: '+name);
 const c=document.createElement('canvas');c.width=width;c.height=height;
 c.getContext('2d').putImageData(new ImageData(data,width,height),0,0);
 const result=c.toDataURL(type,1);
 if(!result.startsWith('data:'+type+';base64,'))throw Error('이미지 형식을 저장할 수 없습니다: '+name);
 return result;
}
