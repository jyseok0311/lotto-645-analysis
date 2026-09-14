import {drawOnce, rng, CFG} from './sim3d_lite.mjs';
const [seed, n, delta] = process.argv.slice(2).map(Number);
// 질량 구배: 번호가 클수록 delta 비율만큼 무거움 (±delta/2 범위)
const mass = [...Array(45)].map((_, i) => CFG.m0 * (1 + delta * ((i + 1) - 23) / 22));
const R = rng(seed);
const f = new Array(46).fill(0);
let ok = 0, fail = 0;
for (let d = 0; d < n; d++) {
  const p = drawOnce(mass, R);
  if (!p) { fail++; continue; }
  ok++; p.forEach(x => f[x]++);
}
process.stdout.write(JSON.stringify({ ok, fail, f: f.slice(1) }));
