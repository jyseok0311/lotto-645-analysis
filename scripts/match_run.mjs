import {spawn} from 'node:child_process';
import os from 'node:os';
import {C, fmt} from './stats.mjs';
import fs from 'node:fs';
const REAL = process.argv[2];
const TARGET = Number(process.argv[3] || 23000);
const W = Math.min(12, os.cpus().length);
const ATTEMPTS = Math.ceil(TARGET / 0.78 / W);   // 완료율 ~78% 보정
const t0 = Date.now();
const rs = await Promise.all([...Array(W)].map((_, k) => new Promise((res, rej) => {
  const p = spawn(process.execPath, ['match_worker.mjs', String(424242 + k * 104729), String(ATTEMPTS), REAL]);
  let out = ''; p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => process.stderr.write(d));
  p.on('close', c => c === 0 ? res(JSON.parse(out)) : rej(new Error('worker ' + c)));
})));
let ok = 0, fail = 0; const hits = [], allKeys = [];
rs.forEach(r => { ok += r.ok; fail += r.fail; hits.push(...r.hits); allKeys.push(...r.keys); });
const gseen = new Map(); let dup = 0;
for (const k of allKeys) { const c = gseen.get(k) || 0; dup += c; gseen.set(k, c + 1); }
fs.writeFileSync("sim_combos.txt", allKeys.join(String.fromCharCode(10)), "utf8");
const TOT = C(45, 6);
console.log(`■ 3D 시뮬레이션 ${ok.toLocaleString()}회차 (= ${fmt(ok/52,0)}년치) 완주  [${((Date.now()-t0)/1000).toFixed(0)}초, 미완료 ${fail.toLocaleString()}]\n`);
const exp = ok * 1241 / TOT;
console.log(`【실제 당첨 조합과 일치한 시뮬 회차】`);
console.log(`   이론 기대값 ${fmt(exp,2)}건  (= ${ok.toLocaleString()} × 1,241 / 8,145,060)`);
console.log(`   실제 발생   ${hits.length}건\n`);
if (hits.length) {
  hits.sort((a,b)=>a.draw-b.draw).forEach(h =>
    console.log(`   ${String(h.draw).padStart(4)}회 (${h.date})  ${h.key.split('-').map(x=>x.padStart(2)).join(' ')}`));
} else console.log(`   (없음)`);
console.log(`\n【시뮬레이션 내부 중복】`);
console.log(`   같은 조합이 두 번 이상 나온 쌍: ${dup}건 (이론 기대 ${fmt(ok*(ok-1)/2/TOT,1)}건)`);
console.log(`   서로 다른 조합 ${gseen.size.toLocaleString()}종 / 전체 ${ok.toLocaleString()}회차`);
