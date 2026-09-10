const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ENDPOINT='https://region-studio-beta.umirr.workers.dev/upload';
function registerCloudUpload({handle,app,atomic}){
 let uploading=false;
 handle('beta-upload',async(id,code)=>{
  if(uploading)throw Error('이미 업로드 중입니다.');
  if(!/^[0-9a-f-]{36}$/i.test(id)||typeof code!=='string'||code.length<20||code.length>200)throw Error('제출 ID와 초대 코드를 확인하세요.');
  uploading=true;
  try{
   const file=path.join(app.getPath('userData'),'beta-receipts',id+'.json');const receipt=JSON.parse(await fs.readFile(file,'utf8'));
   const stat=await fs.stat(receipt.path);if(stat.size>90*1024*1024)throw Error('R2 제출은 ZIP당 90 MiB 이하입니다. 이미지를 나눠 새 패키지를 만드세요.');
   const data=await fs.readFile(receipt.path);if(data.length<22||data.readUInt32LE(0)!==0x04034b50)throw Error('ZIP 파일이 아닙니다.');
   const sha=crypto.createHash('sha256').update(data).digest('hex');if(sha!==receipt.zipSha256)throw Error('패키지가 변경됐거나 이전 버전에서 생성됐습니다. 검토 후 새 ZIP을 만드세요.');
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/zip','X-Upload-Code':code,'X-Submission-Id':id,'X-Content-SHA256':sha},body:data,signal:AbortSignal.timeout(180000),redirect:'error'});
   if(!response.ok)throw Error(response.status===401?'초대 코드가 올바르지 않습니다.':'R2 업로드 실패: '+response.status);
   const result=await response.json();if(!result.stored||result.submissionId!==id)throw Error('업로드 확인 응답이 올바르지 않습니다.');
   receipt.uploadedAt=new Date().toISOString();await atomic(file,JSON.stringify(receipt));return {submissionId:id,uploadedAt:receipt.uploadedAt};
  }finally{uploading=false;}
 });
}
module.exports={registerCloudUpload};
