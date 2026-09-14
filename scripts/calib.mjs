import {runParallel} from './sim_run.mjs';
import {chi2p, normP2, fmt, pstr, sum, mean} from './stats.mjs';
const N = Number(process.argv[2] || 10000);
console.log(`■ 질량 → 선택확률 전달함수 보정  (레벨당 ${N.toLocaleString()}회차 시뮬)\n`);
const rows = [];
for (const delta of [0.20, 0.40]) {
  const t0 = Date.now();
  const { ok, fail, f } = await runParallel(N, delta, 1000 + Math.round(delta * 1000));
  const E = ok * 6 / 45;
  let x2 = 0; for (const v of f) x2 += (v - E) ** 2 / E;
  // 로그 확률 vs 로그 질량 회귀 → 민감도 S
  const lm = [...Array(45)].map((_, i) => Math.log(1 + delta * ((i + 1) - 23) / 22));
  const lp = f.map(v => Math.log(Math.max(v, 1) / E));
  const mx = mean(lm), my = mean(lp);
  const S = delta === 0 ? 0 : sum(lm.map((x, i) => (x - mx) * (lp[i] - my))) / sum(lm.map(x => (x - mx) ** 2));
  // 기울기 표준오차
  const res = lp.map((y, i) => y - (my + S * (lm[i] - mx)));
  const se = delta === 0 ? 0 : Math.sqrt(sum(res.map(r => r * r)) / 43 / sum(lm.map(x => (x - mx) ** 2)));
  rows.push({ delta, ok, fail, x2, S, se });
  console.log(`  질량구배 ±${(delta / 2 * 100).toFixed(0)}%  ${ok.toLocaleString()}회차 (미완료 ${fail})  ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  console.log(`     균등성 χ² = ${fmt(x2, 1)} (df 44), p = ${pstr(chi2p(x2, 44))}`);
  if (delta > 0) console.log(`     민감도 S = d(ln p)/d(ln m) = ${fmt(S, 3)} ± ${fmt(1.96 * se, 3)}   (S<0 = 무거울수록 덜 뽑힘)`);
  console.log(`     1번 대비 45번 빈도비 ${fmt(f[44] / f[0], 3)}`);
}
console.log(`\n■ 요약`);
const good = rows.filter(r => r.delta > 0);
console.log(`   선형성 확인: ${good.map(r => `±${(r.delta/2*100).toFixed(0)}%→S=${fmt(r.S,3)}`).join('  ')}`);
const Sm = mean(good.map(r => r.S));
console.log(`   평균 민감도 S ≈ ${fmt(Sm, 3)}`);
console.log(`   → 볼 질량이 1% 무거우면 선택확률이 약 ${fmt(-Sm, 2)}% 낮아진다.`);
console.log(`   → 선택확률 5% 편향을 만들려면 질량 차이 약 ${fmt(5 / Math.abs(Sm), 1)}% 필요.`);
