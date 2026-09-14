// 로또 추첨기 3D 강체 시뮬레이터
//  - 원통 챔버 안 45개 구체, 중력 + 구-구/구-벽 충돌(임펄스 기반) + 송풍 난류
//  - 송풍은 힘(F)으로 작용 → 가속도 a = F/m. 무거운 공일수록 덜 떠오름.
//  - 상단 배출구 높이를 먼저 통과한 공이 추첨됨. 6개 뽑을 때까지 반복.
export const CFG = {
  R: 0.28, H: 0.62, exitZ: 0.52, portR: 0.085,   // 챔버(m)
  r: 0.0225, m0: 0.0032,                        // 볼 반지름/기준질량(kg) — 실제 로또볼 급
  g: -9.81, dt: 1/600, rest: 0.62, wallRest: 0.55, damp: 0.9995,
  blow: 26.0,            // 송풍 힘 스케일(N) — 질량으로 나눠 가속도가 됨
  swirl: 7.0,            // 접선방향 선회 성분
  mixSteps: 3000,        // 배출구가 열리기 전 사전 혼합(dt=1/600 → 5초)
  maxSteps: 16000,
};

// xorshift128 난수 (재현 가능)
export function rng(seed) {
  let a = seed >>> 0 || 1, b = 362436069, c = 521288629, d = 88675123;
  return function () {
    const t = a ^ (a << 11); a = b; b = c; c = d;
    d = (d ^ (d >>> 19)) ^ (t ^ (t >>> 8));
    return (d >>> 0) / 4294967296;
  };
}
const gauss = R => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// mass[i] : 번호 i+1 볼의 질량(kg)
export function drawOnce(mass, R, cfg = CFG) {
  const N = mass.length;
  const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
  const vx = new Float64Array(N), vy = new Float64Array(N), vz = new Float64Array(N);
  const dvx = new Float64Array(N), dvy = new Float64Array(N), dvz = new Float64Array(N);
  const dpx = new Float64Array(N), dpy = new Float64Array(N), dpz = new Float64Array(N);
  const cand = [];
  const live = new Uint8Array(N).fill(1);
  // 초기 배치: 바닥에 무작위 산포 (겹침 완화를 위해 여러 번 시도)
  for (let i = 0; i < N; i++) {
    for (let t = 0; t < 60; t++) {
      const rr = Math.sqrt(R()) * (cfg.R - cfg.r), th = R() * 2 * Math.PI;
      const x = rr * Math.cos(th), y = rr * Math.sin(th), z = cfg.r + R() * 0.16;
      let ok = true;
      for (let j = 0; j < i; j++) {
        const dx = x - px[j], dy = y - py[j], dz = z - pz[j];
        if (dx * dx + dy * dy + dz * dz < (2 * cfg.r) ** 2) { ok = false; break; }
      }
      if (ok || t === 59) { px[i] = x; py[i] = y; pz[i] = z; break; }
    }
    vx[i] = gauss(R) * 0.2; vy[i] = gauss(R) * 0.2; vz[i] = gauss(R) * 0.2;
  }
  // 배치 순서에 따른 자리 편향 제거: 번호 ↔ 자리 배정을 무작위로 섞는다.
  // (앞서 배치된 공일수록 겹침 제약이 느슨해 자리가 유리해지는 인공 편향 차단)
  for (let k = N - 1; k > 0; k--) {
    const j = Math.floor(R() * (k + 1));
    for (const arr of [px, py, pz, vx, vy, vz]) { const t = arr[k]; arr[k] = arr[j]; arr[j] = t; }
  }
  const picked = [];
  const d2 = (2 * cfg.r) ** 2;
  for (let s = 0; s < cfg.maxSteps && picked.length < 6; s++) {
    // 힘: 중력 + 송풍(난류) + 선회
    for (let i = 0; i < N; i++) {
      if (!live[i]) continue;
      const inv = 1 / mass[i];
      const fx = gauss(R) * cfg.blow, fy = gauss(R) * cfg.blow;
      const fz = (0.55 + 0.85 * R()) * cfg.blow;     // 상향 편향 송풍
      const rr = Math.hypot(px[i], py[i]) + 1e-9;
      vx[i] += (fx * inv + cfg.swirl * (-py[i] / rr) / mass[i] * 0.001) * cfg.dt;
      vy[i] += (fy * inv + cfg.swirl * ( px[i] / rr) / mass[i] * 0.001) * cfg.dt;
      vz[i] += (fz * inv + cfg.g) * cfg.dt;
      vx[i] *= cfg.damp; vy[i] *= cfg.damp; vz[i] *= cfg.damp;
    }
    // 구-구 충돌 — Jacobi 방식(순서 무관). 한 스텝의 모든 쌍을 스텝 시작 상태로 계산해
    // 누적한 뒤 일괄 적용한다. Gauss-Seidel처럼 인덱스 순서가 결과에 개입하지 않는다.
    dvx.fill(0); dvy.fill(0); dvz.fill(0); dpx.fill(0); dpy.fill(0); dpz.fill(0);
    for (let i = 0; i < N; i++) {
      if (!live[i]) continue;
      for (let j = i + 1; j < N; j++) {
        if (!live[j]) continue;
        const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd >= d2 || dd < 1e-12) continue;
        const dist = Math.sqrt(dd), nx = dx / dist, ny = dy / dist, nz = dz / dist;
        const rel = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny + (vz[j] - vz[i]) * nz;
        const overlap = 2 * cfg.r - dist;
        const mi = mass[i], mj = mass[j], tot = mi + mj;
        dpx[i] -= nx * overlap * (mj / tot); dpy[i] -= ny * overlap * (mj / tot); dpz[i] -= nz * overlap * (mj / tot);
        dpx[j] += nx * overlap * (mi / tot); dpy[j] += ny * overlap * (mi / tot); dpz[j] += nz * overlap * (mi / tot);
        if (rel >= 0) continue;
        const imp = -(1 + cfg.rest) * rel / (1 / mi + 1 / mj);
        dvx[i] -= imp * nx / mi; dvy[i] -= imp * ny / mi; dvz[i] -= imp * nz / mi;
        dvx[j] += imp * nx / mj; dvy[j] += imp * ny / mj; dvz[j] += imp * nz / mj;
      }
    }
    for (let i = 0; i < N; i++) {
      if (!live[i]) continue;
      px[i] += dpx[i]; py[i] += dpy[i]; pz[i] += dpz[i];
      vx[i] += dvx[i]; vy[i] += dvy[i]; vz[i] += dvz[i];
    }
    // 적분 + 벽/바닥 + 배출 판정
    for (let i = 0; i < N; i++) {
      if (!live[i]) continue;
      px[i] += vx[i] * cfg.dt; py[i] += vy[i] * cfg.dt; pz[i] += vz[i] * cfg.dt;
      const rr = Math.hypot(px[i], py[i]);
      if (rr > cfg.R - cfg.r) {                       // 원통 측벽
        const nx = px[i] / rr, ny = py[i] / rr;
        px[i] = nx * (cfg.R - cfg.r); py[i] = ny * (cfg.R - cfg.r);
        const vn = vx[i] * nx + vy[i] * ny;
        if (vn > 0) { vx[i] -= (1 + cfg.wallRest) * vn * nx; vy[i] -= (1 + cfg.wallRest) * vn * ny; }
      }
      if (pz[i] < cfg.r) { pz[i] = cfg.r; if (vz[i] < 0) vz[i] = -vz[i] * cfg.wallRest; }
      if (pz[i] > cfg.H - cfg.r) { pz[i] = cfg.H - cfg.r; if (vz[i] > 0) vz[i] = -vz[i] * cfg.wallRest; }
      // 배출 후보: 상단 포트 반경 안에서 exitZ 통과 + 상승 중
      if (s >= cfg.mixSteps && pz[i] >= cfg.exitZ && vz[i] > 0 && rr <= cfg.portR) cand.push(i);
    }
    // 같은 스텝에 여러 공이 자격을 얻으면 인덱스 순이 아니라 무작위 순으로 배출
    if (cand.length) {
      for (let k = cand.length - 1; k > 0; k--) {
        const j = Math.floor(R() * (k + 1)); const t = cand[k]; cand[k] = cand[j]; cand[j] = t;
      }
      for (const i of cand) {
        if (picked.length >= 6) break;
        live[i] = 0; picked.push(i + 1);
      }
      cand.length = 0;
    }
  }
  return picked.length === 6 ? picked : null;   // 미완료는 버림
}
