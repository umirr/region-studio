const MAX=90*1024*1024;
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/health')return json({service:'region-studio-beta',version:1,configured:!!env.SUBMISSIONS&&!!env.INVITE_SHA256});
 if(request.method!=='POST'||url.pathname!=='/upload')return json({error:'Not found'},404);
 if(!env.SUBMISSIONS||!env.INVITE_SHA256)return json({error:'Upload is not configured'},503);
 const code=request.headers.get('X-Upload-Code')||'';
 if(code.length<20||code.length>200)return json({error:'Invalid invitation code'},401);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const encoder=new TextEncoder();
 if(digest.length!==env.INVITE_SHA256.length||!crypto.subtle.timingSafeEqual(encoder.encode(digest),encoder.encode(env.INVITE_SHA256)))return json({error:'Invalid invitation code'},401);
 const length=Number(request.headers.get('Content-Length'));
 if(!Number.isSafeInteger(length)||length<22||length>MAX)return json({error:'ZIP must be at most 90 MiB'},413);
 if(request.headers.get('Content-Type')!=='application/zip')return json({error:'ZIP required'},415);
 const id=request.headers.get('X-Submission-Id');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))return json({error:'Invalid submission ID'},400);
 const key='submissions/'+id+'.zip';
 const sha=request.headers.get('X-Content-SHA256');
 if(!/^[0-9a-f]{64}$/.test(sha||''))return json({error:'ZIP checksum required'},400);
 // No list or download routes: beta source images remain private.
 try{
  const stored=await env.SUBMISSIONS.put(key,request.body,{sha256:sha,httpMetadata:{contentType:'application/zip'},customMetadata:{sha256:sha},onlyIf:new Headers({'If-None-Match':'*'})});
  if(!stored){const existing=await env.SUBMISSIONS.head(key);if(existing?.customMetadata?.sha256!==sha)return json({error:'Submission ID already has different content'},409);}
  return json({submissionId:id,stored:true},stored?201:200);
 }catch{return json({error:'Storage write failed; retry the same submission'},503);}
}};
