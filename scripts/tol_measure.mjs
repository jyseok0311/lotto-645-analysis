import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { chi2p, normP2, fmt, pstr, sum, mean } from './stats.mjs';

const W = Math.min(12, os.cpus().length);
const TOTAL = Number(process.argv[2] || 240000);
const SETSEED = Number(process.argv[3] || 8121);
const MODE = process.argv[4] || 'uniform';
const per = Math.ceil(TOTAL / W);

const t0 = Date.now();
const rs = await Promise.all([...Array(W)].map((_, k) => new Promise((res, rej) => {
  // 모든 워커가 같은 setSeed → 동일한 볼세트, 추첨 난수만 다름
  const p = spawn(process.execPath, ['tol_worker.mjs', String(5000 + k * 7919), String(per), String(SETSEED), MODE]);
  let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => process.stderr.write(d));
  p.on('close', c => c === 0 ? res(JSON.parse(o)) : rej(new Error('worker ' + c)));
})));

const f = new Array(45).fill(0);
let ok = 0, fail = 0;
rs.forEach(r => { ok += r.ok; fail += r.fail; r.f.forEach((v, i) => f[i] += v); });
const mass = rs[0].mass;
const mAvg = mean(mass);

console.log(`■ 공식 허용오차 볼세트 한 벌의 실측 편향 (${MODE}, setSeed=${SETSEED})`);
console.log(`  시뮬 ${ok.toLocaleString()}회차 (미완료 ${fail.toLocaleString()}, ${((Date.now() - t0) / 1000).toFixed(0)}초)\n`);
console.log(`  질량 범위 ${(Math.min(...mass) * 1000).toFixed(3)}g ~ ${(Math.max(...mass) * 1000).toFixed(3)}g`
          + `  (평균 ${(mAvg * 1000).toFixed(3)}g, 최대차 ${((Math.max(...mass) - Math.min(...mass)) / mAvg * 100).toFixed(1)}%)`);

// 번호별 포함확률
const pi = f.map(v => v / ok);                       // 회차당 그 번호가 나올 확률 (합=6)
const pbar = 6 / 45;
const rel = pi.map(v => v / pbar - 1);               // 평균 대비 상대 편차
const spread = (Math.max(...pi) - Math.min(...pi)) / pbar * 100;
const sdRel = Math.sqrt(sum(rel.map(x => x * x)) / 45) * 100;
console.log(`  실측 확률 스프레드 (최대−최소)/평균 = ${fmt(spread, 2)}%`);
console.log(`  번호별 상대편차 표준편차 = ${fmt(sdRel, 2)}%`);

// 질량 → 확률 전달함수 재확인 (무작위 질량에서도 성립하는가)
const lm = mass.map(m => Math.log(m / mAvg));
const lp = pi.map(v => Math.log(v / pbar));
const mx = mean(lm), my = mean(lp);
const S = sum(lm.map((x, i) => (x - mx) * (lp[i] - my))) / sum(lm.map(x => (x - mx) ** 2));
const resid = lp.map((y, i) => y - (my + S * (lm[i] - mx)));
const seS = Math.sqrt(sum(resid.map(r => r * r)) / 43 / sum(lm.map(x => (x - mx) ** 2)));
const rr = sum(lm.map((x, i) => (x - mx) * (lp[i] - my)))
         / Math.sqrt(sum(lm.map(x => (x - mx) ** 2)) * sum(lp.map(y => (y - my) ** 2)));
console.log(`\n  전달함수 재측정: S = ${fmt(S, 3)} ± ${fmt(1.96 * seS, 3)}  (상관 r = ${fmt(rr, 3)})`);

// 이 편향이 '번호 크기'와 상관이 있는가 → 추세검정이 먹히는가
const idx = [...Array(45)].map((_, i) => i + 1);
const ix = 23, iy = mean(rel);
const rTrend = sum(idx.map((x, i) => (x - ix) * (rel[i] - iy)))
             / Math.sqrt(sum(idx.map(x => (x - ix) ** 2)) * sum(rel.map(y => (y - iy) ** 2)));
console.log(`  편향 ↔ 번호 크기 상관 r = ${fmt(rTrend, 3)}  → 추세검정은 ${Math.abs(rTrend) < 0.3 ? '무력' : '유효'}`);

// 카이제곱 비중심모수로 1,241회차 검출력 계산
const q = pi.map(v => v / 6);                        // 공 한 개가 그 번호일 확률
const q0 = 1 / 45;
const ncpPer = sum(q.map(v => (v - q0) ** 2 / q0));  // 공 1개당 비중심모수 기여
function powerChi(n, alpha95 = 61.656) {
  const lam = n * 6 * ncpPer;
  // 비중심 카이제곱 상측확률 근사 (Patnaik): 자유도/스케일 보정
  const df = 44;
  const c = (df + 2 * lam) / (df + lam), dfStar = (df + lam) ** 2 / (df + 2 * lam);
  return chi2p(alpha95 / c, dfStar);
}
console.log(`\n■ 이 볼세트를 검출하려면 (카이제곱 검정, 유의수준 5%)`);
console.log(`  회차수      검출력`);
for (const n of [1241, 5000, 10000, 30000, 100000, 300000]) {
  console.log(`  ${String(n).padStart(7)}      ${(powerChi(n) * 100).toFixed(1).padStart(5)}%`);
}
let lo = 100, hi = 5e6;
for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); powerChi(mid) < 0.8 ? lo = mid : hi = mid; }
console.log(`  → 80% 검출력 필요 회차 ≈ ${Math.round(hi).toLocaleString()}회차 (${Math.round(hi / 52).toLocaleString()}년)`);

fs.writeFileSync(`tol_measured_${MODE}_${SETSEED}.json`,
  JSON.stringify({ mode: MODE, setSeed: SETSEED, draws: ok, spread, sdRel, S, rTrend,
    need80: Math.round(hi), power1241: powerChi(1241), pi, mass }, null, 0));
