import {spawnSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const base='https://region-studio-beta.umirr.workers.dev';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const hash=process.env.INVITE_SHA256;
if(!account||!token||!/^[a-f0-9]{64}$/.test(hash||''))throw new Error('Required deployment secrets are missing');
if(process.env.GITHUB_REF!=='refs/heads/main')throw new Error('Only main may deploy');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha=b=>createHash('sha256').update(b).digest('hex');
function wrangler(...args){const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',timeout:180000});if(r.status!==0)throw new Error('Wrangler command failed');}
async function setHash(value){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/region-studio-beta/secrets`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:'INVITE_SHA256',type:'secret_text',text:value}),signal:AbortSignal.timeout(30000)});
 const data=await r.json();if(!r.ok||!data.success)throw new Error(`Secret update failed: HTTP ${r.status}`);
}
async function health(){const r=await fetch(base+'/health',{signal:AbortSignal.timeout(10000)});return r.ok&&(await r.json()).configured===true;}
if(process.argv.includes('--restore')){await setHash(hash);console.log('Production invitation hash restored');process.exit(0);}
const initial=process.env.BOOTSTRAP_TEST==='true';
wrangler('deploy','--dry-run');
wrangler('deploy');
try{
 if(initial){
  // Explicit maintenance test only; automatic deployments do not rotate the invitation.
  const code=randomBytes(32).toString('hex');
  await setHash(sha(code));
  const id=randomUUID(),body=Buffer.alloc(22);body.writeUInt32LE(0x06054b50);
  const headers={'Content-Type':'application/zip','X-Upload-Code':code,'X-Submission-Id':id,'X-Content-SHA256':sha(body)};
  const upload=()=>fetch(base+'/upload',{method:'POST',headers,body,signal:AbortSignal.timeout(30000)});
  try{
   let response;
   for(let i=0;i<12;i++){try{response=await upload();if(response.status===201)break;}catch{}await sleep(5000);}
   assert.equal(response?.status,201,'First upload must create an R2 object');
   assert.equal((await response.json()).stored,true);
   // Secret updates propagate across edge instances; a briefly stale instance may reject the new code.
   let retry;for(let i=0;i<12;i++){retry=await upload();if(retry.status!==401)break;await sleep(5000);}
   assert.equal(retry.status,200,'Retry must be idempotent');
   assert.equal((await fetch(base+'/upload',{method:'POST',headers:{...headers,'X-Upload-Code':'invalid'},body})).status,401);
   assert.equal((await fetch(base+'/submissions/'+id+'.zip')).status,404);
   console.log('LIVE TEST PASS: R2 upload 201, duplicate 200, invalid invitation 401, public download 404');
  }finally{wrangler('r2','object','delete','region-studio-beta/submissions/'+id+'.zip','--remote','--force');}
 }
}finally{await setHash(hash);}
let ready=false;for(let i=0;i<12;i++){try{ready=await health();if(ready)break;}catch{}await sleep(5000);}
assert.equal(ready,true,'Production server must be configured');
console.log('DEPLOY PASS: '+base+'/health');

