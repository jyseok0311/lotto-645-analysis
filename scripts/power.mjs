import fs from 'node:fs';
import {chi2p, normP2, fmt, pstr, sum, mean} from './stats.mjs';
import {rng} from './sim3d.mjs';
const R = rng(31337);
const gauss = () => { let u=0,v=0; while(!u)u=R(); while(!v)v=R();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };

// 편향 bias = (최대확률-최소확률)/평균확률.  가중치 w_i = 1 + (bias/2)*(i-23)/22
const weights = bias => [...Array(45)].map((_,i)=> 1 + (bias/2)*((i+1)-23)/22);

// 가중 비복원추출로 번호별 '포함확률' π_i 를 직접 측정
function marginals(bias, trials=400000){
  const w = weights(bias), c = new Float64Array(45);
  const idx = new Int32Array(45), ww = new Float64Array(45);
  for(let t=0;t<trials;t++){
    for(let i=0;i<45;i++){ idx[i]=i; ww[i]=w[i]; }
    let n=45, tot=0; for(let i=0;i<45;i++) tot+=ww[i];
    for(let k=0;k<6;k++){
      let x = R()*tot, j=0;
      while(j<n-1 && (x-=ww[j])>0) j++;
      c[idx[j]]++; tot-=ww[j];
      idx[j]=idx[n-1]; ww[j]=ww[n-1]; n--;
    }
  }
  return [...c].map(v=>v/trials);   // 한 회차에 그 번호가 포함될 확률 (합 = 6)
}

// 다항분포 표본 (정규근사 조건부 이항)
function multinomial(total, p){
  const out=new Array(45); let rem=total, pr=1;
  for(let i=0;i<44;i++){
    const q=p[i]/pr, n=rem, mu=n*q, sd=Math.sqrt(Math.max(n*q*(1-q),1e-9));
    let v=Math.round(mu+gauss()*sd); if(v<0)v=0; if(v>rem)v=rem;
    out[i]=v; rem-=v; pr-=p[i];
    if(pr<=1e-12){ for(let j=i+1;j<44;j++) out[j]=0; rem=Math.max(rem,0); break; }
  }
  out[44]=rem; return out;
}

const CRIT = 61.656;   // χ²_44 상위 5% 임계값
const ZCRIT = 1.959964;
function testsOn(cnt, n){
  const E = n*6/45;
  let x2=0; for(const v of cnt) x2+=(v-E)**2/E;
  const idx=[...Array(45)].map((_,i)=>i+1), mx=23, my=mean(cnt);
  const sxy=sum(idx.map((x,i)=>(x-mx)*(cnt[i]-my))), sxx=sum(idx.map(x=>(x-mx)**2));
  const syy=sum(cnt.map(y=>(y-my)**2));
  const r=sxy/Math.sqrt(sxx*syy);
  const tz=r*Math.sqrt(43/Math.max(1-r*r,1e-12));
  return {chi:x2>CRIT, trend:Math.abs(tz)>ZCRIT};
}

const BIASES=[0,0.01,0.02,0.03,0.05,0.10,0.15];
const NS=[1241,5000,10000,23000,50000,150000];
const REPS=600;
console.log(`■ 무작위 시나리오 분석 — 편향 검출력 (반복 ${REPS}회/셀, 유의수준 5%)`);
console.log(`   편향 = (가장 잘 나오는 번호 − 가장 안 나오는 번호) / 평균\n`);
const pis={}; for(const b of BIASES){
  const raw=[...Array(45)].map((_,i)=> (6/45)*(1+(b/2)*((i+1)-23)/22));
  const S=raw.reduce((a,c)=>a+c,0); pis[b]=raw.map(v=>v*6/S);
}
console.log(`   [검증] 편향 0%에서 포함확률 범위 ${fmt(Math.min(...pis[0]),5)}~${fmt(Math.max(...pis[0]),5)} (이론 ${fmt(6/45,5)})`);
console.log(`   [검증] 편향 5%에서 실제 구현된 확률 스프레드 ${fmt((Math.max(...pis[0.05])-Math.min(...pis[0.05]))/(6/45)*100,2)}%\n`);

const grid={};
console.log(`   편향\회차   ` + NS.map(n=>String(n).padStart(8)).join(''));
for(const b of BIASES){
  const p=pis[b].map(v=>v/6);
  const row=[];
  for(const n of NS){
    let hc=0,ht=0;
    for(let rep=0;rep<REPS;rep++){
      const cnt=multinomial(n*6,p);
      const t=testsOn(cnt,n);
      if(t.chi)hc++; if(t.trend)ht++;
    }
    row.push({n,chi:hc/REPS,trend:ht/REPS});
  }
  grid[b]=row;
  console.log(`   ${(b*100).toFixed(0).padStart(3)}%       ` +
    row.map(r=>`${(r.trend*100).toFixed(0).padStart(4)}%/${(r.chi*100).toFixed(0).padStart(3)}%`.padStart(8)).join(''));
}
console.log(`   (각 칸은 "추세검정 검출력 / 카이제곱 검출력")`);

console.log(`\n■ 80% 검출력에 필요한 회차수 (보간)`);
for(const b of BIASES.filter(x=>x>0)){
  const row=grid[b];
  const need=key=>{
    for(let i=0;i<row.length;i++){
      if(row[i][key]>=0.8){
        if(i===0)return `≤${row[0].n.toLocaleString()}`;
        const a=row[i-1],c=row[i];
        const t=(0.8-a[key])/(c[key]-a[key]);
        return Math.round(a.n+(c.n-a.n)*t).toLocaleString();
      }
    }
    return `>${row.at(-1).n.toLocaleString()}`;
  };
  const yrs=s=>{const v=Number(String(s).replace(/[^0-9]/g,''));return v?`${Math.round(v/52).toLocaleString()}년`:'—';};
  console.log(`   편향 ${(b*100).toFixed(0).padStart(2)}% → 추세검정 ${need('trend').padStart(9)}회차 (${yrs(need('trend'))})   카이제곱 ${need('chi').padStart(9)}회차 (${yrs(need('chi'))})`);
}
fs.writeFileSync('power.json',JSON.stringify({BIASES,NS,grid,pi0:pis[0]},null,0));
