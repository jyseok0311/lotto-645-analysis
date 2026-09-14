// 공식 허용오차(4g ±5%) 안에서 무작위로 질량이 배정된 '실제 볼세트' 한 벌을
// 만들어 놓고, 그 세트로 수만 회차를 돌려 번호별 출현확률을 직접 측정한다.
import { runOnce, rng, CFG } from './sim_venus.mjs';

const [seed, n, setSeed, mode] = process.argv.slice(2);
const R = rng(Number(seed));
const RS = rng(Number(setSeed));               // 볼세트 질량용 별도 난수

// 질량 배정: uniform = 허용오차 내 균등, normal = ±5%가 2σ인 정규(허용오차 밖 절단)
const mass = [...Array(45)].map(() => {
  if (mode === 'normal') {
    let u = 0, v = 0, z;
    do {
      while (!u) u = RS(); while (!v) v = RS();
      z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      u = 0; v = 0;
    } while (Math.abs(z) > 2);                 // ±5% = 2σ 로 놓고 밖은 버림
    return CFG.m0 * (1 + 0.025 * z);
  }
  return CFG.m0 * (0.95 + 0.10 * RS());        // uniform
});

const f = new Array(46).fill(0);
let ok = 0, fail = 0;
for (let i = 0; i < Number(n); i++) {
  const p = runOnce(mass, R);
  if (!p) { fail++; continue; }
  ok++; p.forEach(x => f[x]++);
}
process.stdout.write(JSON.stringify({ ok, fail, f: f.slice(1), mass }));
