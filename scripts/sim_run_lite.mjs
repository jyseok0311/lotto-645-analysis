import {spawn} from 'node:child_process';
import os from 'node:os';
const W = Math.min(12, os.cpus().length);
export function runParallel(total, delta, seed0 = 1) {
  const per = Math.ceil(total / W);
  return Promise.all([...Array(W)].map((_, k) => new Promise((res, rej) => {
    const p = spawn(process.execPath, ['sim_worker_lite.mjs', String(seed0 + k * 7919), String(per), String(delta)]);
    let out = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => process.stderr.write(d));
    p.on('close', c => c === 0 ? res(JSON.parse(out)) : rej(new Error('worker exit ' + c)));
  }))).then(rs => {
    const f = new Array(45).fill(0);
    let ok = 0, fail = 0;
    rs.forEach(r => { ok += r.ok; fail += r.fail; r.f.forEach((v, i) => f[i] += v); });
    return { ok, fail, f };
  });
}
