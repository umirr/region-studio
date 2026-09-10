let model,processor,Tensor,RawImage,processed,embeddings;
const MODEL='Xenova/slimsam-77-uniform';
self.onmessage=async({data:m})=>{try{
  if(m.type==='encode'||m.type==='restore'){
    if(!model){
      self.postMessage({type:'status',text:'AI 모델 다운로드 중 · 첫 실행은 시간이 걸립니다'});
      const lib=await import('./vendor/transformers.web.min.js');
      ({Tensor,RawImage}=lib);lib.env.allowLocalModels=true;lib.env.allowRemoteModels=false;lib.env.localModelPath=new URL('./models/',import.meta.url).href;lib.env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;lib.env.backends.onnx.wasm.numThreads=1;
      processor=await lib.AutoProcessor.from_pretrained(MODEL);
      model=await lib.SamModel.from_pretrained(MODEL,{device:'wasm',dtype:'fp32'});
    }
    if(m.type==='restore'){processed=m.cache.processed;embeddings=Object.fromEntries(Object.entries(m.cache.embeddings).map(([k,v])=>[k,new Tensor(v.type,v.data,v.dims)]));self.postMessage({type:'ready'});return;}
    self.postMessage({type:'status',text:'이미지 분석 중…'});
    const raw=new RawImage(new Uint8ClampedArray(m.pixels),m.width,m.height,4);
    processed=await processor(raw);embeddings=await model.get_image_embeddings(processed);
    self.postMessage({type:'ready',cache:{processed:{original_sizes:processed.original_sizes,reshaped_input_sizes:processed.reshaped_input_sizes},embeddings:Object.fromEntries(Object.entries(embeddings).map(([k,v])=>[k,{type:v.type,data:v.data,dims:v.dims}]))}});
  }else if(m.type==='decode'){
    if(!embeddings)throw new Error('먼저 AI 분석을 실행하세요.');
    const size=processed.reshaped_input_sizes[0],n=m.points.length;
    const input_points=new Tensor('float32',m.points.flatMap(p=>[p.x*size[1],p.y*size[0]]),[1,1,n,2]);
    const input_labels=new Tensor('int64',m.points.map(p=>BigInt(p.label)),[1,1,n]);
    const result=await model({...embeddings,input_points,input_labels});
    const masks=await processor.post_process_masks(result.pred_masks,processed.original_sizes,processed.reshaped_input_sizes);
    const raw=RawImage.fromTensor(masks[0][0]),scores=Array.from(result.iou_scores.data);
    const candidates=scores.map((score,k)=>{const a=new Uint8Array(raw.width*raw.height);for(let i=0;i<a.length;i++)a[i]=raw.data[i*scores.length+k]?255:0;return a;});
    self.postMessage({type:'masks',candidates,scores});
  }
}catch(e){self.postMessage({type:'error',text:e.message||String(e)});}};
