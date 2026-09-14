import fs from 'node:fs';
import { chi2p, normP2, fmt, pstr, sum, mean } from './stats.mjs';
import { rng } from './sim3d.mjs';

const R = rng(20260915);
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// 편향 = (최대확률 − 최소확률)/평균확률, 번호에 선형으로 부여
const pis = bias => {
  const raw = [...Array(45)].map((_, i) => (6 / 45) * (1 + (bias / 2) * ((i + 1) - 23) / 22));
  const S = raw.reduce((a, c) => a + c, 0);
  return raw.map(v => v * 6 / S);
};
function multinomial(total, p) {
  const out = new Array(45); let rem = total, pr = 1;
  for (let i = 0; i < 44; i++) {
    const q = p[i] / pr, mu = rem * q, sd = Math.sqrt(Math.max(rem * q * (1 - q), 1e-9));
    let v = Math.round(mu + gauss() * sd); if (v < 0) v = 0; if (v > rem) v = rem;
    out[i] = v; rem -= v; pr -= p[i];
    if (pr <= 1e-12) { for (let j = i + 1; j < 44; j++) out[j] = 0; break; }
  }
  out[44] = Math.max(rem, 0); return out;
}
const CRIT = 61.656, ZCRIT = 1.959964;
function tests(cnt, n) {
  const E = n * 6 / 45;
  let x2 = 0; for (const v of cnt) x2 += (v - E) ** 2 / E;
  const idx = [...Array(45)].map((_, i) => i + 1), mx = 23, my = mean(cnt);
  const sxy = sum(idx.map((x, i) => (x - mx) * (cnt[i] - my)));
  const sxx = sum(idx.map(x => (x - mx) ** 2)), syy = sum(cnt.map(y => (y - my) ** 2));
  const r = sxy / Math.sqrt(sxx * syy);
  const tz = r * Math.sqrt(43 / Math.max(1 - r * r, 1e-12));
  return { chi: x2 > CRIT, trend: Math.abs(tz) > ZCRIT };
}
function power(bias, n, reps = 3000) {
  const p = pis(bias).map(v => v / 6);
  let hc = 0, ht = 0;
  for (let i = 0; i < reps; i++) { const t = tests(multinomial(n * 6, p), n); if (t.chi) hc++; if (t.trend) ht++; }
  return { chi: hc / reps, trend: ht / reps };
}

const S = 0.731, M = 4.0;           // 전달함수, 공식 볼 무게(g)
const TOLBIAS = 2 * 0.05 * 100 * S; // ±5% → 최대-최소 10% → 확률편향

console.log('■ 공식 허용오차(볼 4g ± 5%)가 만드는 편향의 검출력\n');
console.log(`  질량 최대차 10% (400mg) → 선택확률 편향 ${TOLBIAS.toFixed(1)}%\n`);
console.log('  회차수      추세검정    카이제곱');
const NS = [1241, 2000, 3000, 4000, 6000, 10000];
const rows = [];
for (const n of NS) {
  const p = power(TOLBIAS / 100, n);
  rows.push({ n, ...p });
  console.log(`  ${String(n).padStart(6)}      ${(p.trend * 100).toFixed(0).padStart(4)}%      ${(p.chi * 100).toFixed(0).padStart(4)}%`);
}
const need = key => {
  for (let i = 0; i < rows.length; i++) if (rows[i][key] >= 0.8) {
    if (i === 0) return rows[0].n;
    const a = rows[i - 1], c = rows[i];
    return Math.round(a.n + (c.n - a.n) * ((0.8 - a[key]) / (c[key] - a[key])));
  }
  return null;
};
const nt = need('trend'), nc = need('chi');
console.log(`\n  80% 검출력 필요 회차 — 추세검정 ${nt ? nt.toLocaleString() : '>10,000'}회차 (${nt ? Math.round(nt / 52) : '>192'}년)` +
            ` / 카이제곱 ${nc ? nc.toLocaleString() : '>10,000'}회차 (${nc ? Math.round(nc / 52) : '>192'}년)`);
console.log(`  1,241회차에서의 검출력 — 추세검정 ${(rows[0].trend * 100).toFixed(0)}% / 카이제곱 ${(rows[0].chi * 100).toFixed(0)}%`);

// 잉크/허용오차 환산표 (볼 4g 기준)
const needN = b => Math.round(6754 * Math.pow(5 / b, 2));
const ink = [
  { label: '인쇄 잉크', mg: 5 }, { label: '인쇄 잉크', mg: 20 }, { label: '인쇄 잉크', mg: 50 },
  { label: '공식 허용오차 ±5%', mg: 400 },
].map(k => { const dm = k.mg / 1000 / M * 100, bias = dm * S, n = needN(bias);
  return { ...k, dm: +dm.toFixed(3), bias: +bias.toFixed(2), n, yrs: Math.round(n / 52) }; });
console.log('\n■ 질량차 → 확률편향 환산 (볼 4g 기준)');
ink.forEach(k => console.log(`  ${k.label.padEnd(16)} ${String(k.mg).padStart(4)}mg = ${k.dm.toFixed(2).padStart(5)}% → 편향 ${k.bias.toFixed(2).padStart(5)}% → ${k.n.toLocaleString()}회차 (${k.yrs.toLocaleString()}년)`));

fs.writeFileSync('tol.json', JSON.stringify({
  tolBias: +TOLBIAS.toFixed(1), M, S,
  at1241: { trend: rows[0].trend, chi: rows[0].chi },
  need: { trend: nt, chi: nc }, ink,
}, null, 0));
