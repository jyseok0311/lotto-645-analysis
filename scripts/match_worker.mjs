import fs from 'node:fs';
import {drawOnce, rng, CFG} from './sim3d.mjs';
const [seed, n, realPath] = process.argv.slice(2);
const real = new Map();
JSON.parse(fs.readFileSync(realPath,'utf8')).forEach(r =>
  real.set([...r.numbers].sort((a,b)=>a-b).join('-'), {draw:r.draw, date:r.date}));
const mass = new Array(45).fill(CFG.m0);
const R = rng(Number(seed));
const seen = new Map();            // 시뮬 내부 중복 추적
const hits = [];
let ok = 0, fail = 0, dupPairs = 0;
for (let d = 0; d < Number(n); d++) {
  const p = drawOnce(mass, R);
  if (!p) { fail++; continue; }
  ok++;
  const key = [...p].sort((a,b)=>a-b).join('-');
  if (real.has(key)) hits.push({ key, ...real.get(key), simIndex: ok });
  const c = seen.get(key) || 0;
  dupPairs += c;                   // 이미 c번 나왔다면 c쌍이 추가됨
  seen.set(key, c + 1);
}
process.stdout.write(JSON.stringify({ ok, fail, hits, keys: [...seen.keys()].length===ok ? [...seen.keys()] : Array.from(seen.entries()).flatMap(([k,c])=>Array(c).fill(k)) }));
