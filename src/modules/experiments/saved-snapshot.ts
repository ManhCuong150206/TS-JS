import { BadRequestException } from '@nestjs/common';
const FIELDS=['name','learningRate','maxIterations','degree','lambda','dataSource','csvName','synthetic','sampleCount','featureCount','noise','seed','trainRatio','iterations','w','b','train','test','csvData'] as const;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function snapshotFields(input:Record<string,unknown>):Record<string,unknown>{
 const out:Record<string,unknown>={};for(const key of FIELDS)if(input[key]!==undefined)out[key]=input[key];
 const bad=()=>{throw new BadRequestException('Cấu hình hoặc kết quả thí nghiệm không hợp lệ.');};
 if(Buffer.byteLength(JSON.stringify(out),'utf8')>8*1024*1024)throw new BadRequestException('Bản lưu vượt 8 MiB. Hãy giảm dữ liệu CSV trước khi lưu.');
 if(typeof out.name!=='string'||!out.name.trim()||out.name.length>120)bad();
 if(out.w!==undefined){
  if(!Array.isArray(out.w)||!out.w.length||!out.w.every(finite)||!finite(out.b))bad();
  for(const key of ['learningRate','maxIterations','sampleCount','featureCount','noise','seed','trainRatio','iterations'])if(!finite(out[key]))bad();
  if(!Number.isInteger(out.maxIterations)||!Number.isInteger(out.sampleCount)||Number(out.sampleCount)<2||Number(out.sampleCount)>1000000||Number(out.featureCount)>1000||!Number.isInteger(out.seed)||Number(out.noise)<0||Number(out.noise)>50||Number(out.iterations)>Number(out.maxIterations)||Number(out.learningRate)<=0||Number(out.maxIterations)<1||Number(out.featureCount)<1||!Number.isInteger(out.featureCount)||Number(out.iterations)<0||!Number.isInteger(out.iterations)||Number(out.trainRatio)<=0||Number(out.trainRatio)>=1)bad();
  if(!['synthetic','csv'].includes(String(out.dataSource)))bad();
  for(const key of ['train','test']){const metric=out[key];if(!object(metric))bad();else{
   for(const m of ['mse','rmse','mae'])if(!finite(metric[m])||Number(metric[m])<0)bad();
   if(metric.r2!==null&&!finite(metric.r2))bad();
  }}
 }
 if(out.csvData!==undefined){const c=out.csvData,d=Number(out.featureCount);
  if(!object(c))bad();else{
   for(const [x,y]of [['trainX','trainY'],['testX','testY']]){
    const X=c[x],Y=c[y];if(!Array.isArray(X)||!Array.isArray(Y)||!X.length||X.length!==Y.length||!Y.every(finite)||!X.every(row=>Array.isArray(row)&&row.length===d&&row.every(finite)))bad();
   }
   const indices=c.trainIndices;if(!Array.isArray(indices)||!Array.isArray(c.trainX)||indices.length!==c.trainX.length||!indices.every(v=>Number.isInteger(v)&&v>=0))bad();
   const total=Number((c.trainY as unknown[]).length+(c.testY as unknown[]).length);
   if(total!==Number(out.sampleCount)||(indices as unknown[]).some(v=>Number(v)>=total)||new Set(indices as unknown[]).size!==(indices as unknown[]).length)bad();
   if(c.provenance!==undefined){const p=c.provenance;
     if(!object(p)||!Array.isArray(p.labels)||p.labels.length!==d||!p.labels.every(x=>typeof x==='string')||typeof p.target!=='string'||typeof p.standardized!=='boolean'||!Array.isArray(p.rows)||p.rows.length!==total||!Array.isArray(p.stats))bad();
     else{
       if(!p.rows.every(row=>object(row)&&Number.isInteger(row.sourceRow)&&Number(row.sourceRow)>=2&&Array.isArray(row.original)&&row.original.length===d+1&&row.original.every(x=>typeof x==='string')&&Array.isArray(row.filled)&&row.filled.length===d+1&&row.filled.every(finite)))bad();
       if(p.standardized&&(p.stats.length!==d+1||!p.stats.every(stat=>object(stat)&&finite(stat.mean)&&finite(stat.sd)&&stat.sd>0)))bad();
     }
   }
  }
 }
 return out;
}
