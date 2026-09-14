import {spawn} from 'node:child_process'; import os from 'node:os';
import {chi2p,normP2,fmt,pstr} from './stats.mjs';
const W=Math.min(12,os.cpus().length), TOTAL=Number(process.argv[2]||100000);
const per=Math.ceil(TOTAL/W); const t0=Date.now();
const rs=await Promise.all([...Array(W)].map((_,k)=>new Promise((res,rej)=>{
  const p=spawn(process.execPath,['venus_worker.mjs',String(909+k*7919),String(per)]);
  let o=''; p.stdout.on('data',d=>o+=d); p.stderr.on('data',d=>process.stderr.write(d));
  p.on('close',c=>c===0?res(JSON.parse(o)):rej(new Error('w'+c)));})));
const f=new Array(45).fill(0); let ok=0,fail=0;
rs.forEach(r=>{ok+=r.ok;fail+=r.fail;r.f.forEach((v,i)=>f[i]+=v);});
const E=ok*6/45; let x2=0; for(const v of f) x2+=(v-E)**2/E;
const idx=[...Array(45)].map((_,i)=>i+1), mx=23, my=f.reduce((a,b)=>a+b,0)/45;
const r=idx.reduce((a,x,i)=>a+(x-mx)*(f[i]-my),0)/Math.sqrt(idx.reduce((a,x)=>a+(x-mx)**2,0)*f.reduce((a,y)=>a+(y-my)**2,0));
console.log(`비너스 사양 시뮬 ${ok.toLocaleString()}회차 (미완료 ${fail.toLocaleString()}, ${((Date.now()-t0)/1000).toFixed(0)}초)`);
console.log(`  균등성 χ² = ${fmt(x2,2)}, df=44, p = ${pstr(chi2p(x2,44))}`);
console.log(`  번호값 추세 r = ${fmt(r,3)}, p = ${pstr(normP2(r*Math.sqrt(43/(1-r*r))))}`);
console.log(`  1번 대비 45번 빈도비 ${fmt(f[44]/f[0],3)}`);
