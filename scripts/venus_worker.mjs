import {runOnce, rng, CFG} from './sim_venus.mjs';
const [seed,n]=process.argv.slice(2).map(Number);
const mass=new Array(45).fill(CFG.m0); const R=rng(seed);
const f=new Array(46).fill(0); let ok=0,fail=0;
for(let i=0;i<n;i++){ const p=runOnce(mass,R); if(!p){fail++;continue;} ok++; p.forEach(x=>f[x]++); }
process.stdout.write(JSON.stringify({ok,fail,f:f.slice(1)}));
