import fs from 'node:fs';
// 비너스 사양 시뮬레이터에서 '허용오차 안 무작위 질량' 볼세트를 직접 돌려 얻은 실측치
const SETS = [
  { seed: 8121, mode: 'uniform', draws: 233886, mmax: 9.8,  spread: 13.74, S: -1.397, rTrend: -0.148, need80: 3219, p1241: 0.282 },
  { seed: 4242, mode: 'uniform', draws: 126599, mmax: 9.5,  spread: 15.30, S: -1.386, rTrend: -0.262, need80: 2981, p1241: null },
  { seed: 1357, mode: 'uniform', draws: 126755, mmax: 10.0, spread: 13.54, S: -1.398, rTrend: -0.236, need80: 2971, p1241: null },
  { seed: 9090, mode: 'normal',  draws: 126751, mmax: 8.7,  spread: 13.91, S: -1.388, rTrend:  0.142, need80: 4847, p1241: null },
];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const S = mean(SETS.map(s => Math.abs(s.S)));
const SPREAD = mean(SETS.map(s => s.spread));
const NEED = mean(SETS.map(s => s.need80));
const M = 4.0;
const P = console.log;

P('■ 공식 허용오차(폴리우레탄 4g ±5%) 볼세트의 실측 편향');
P('  비너스 사양 시뮬레이터(구형 챔버 50cm, 회전링 4구)에서 허용오차 안 무작위 질량을');
P('  배정한 볼세트를 만들고, 세트당 12~23만 회차를 돌려 번호별 출현확률을 직접 측정.\n');
P('  세트   질량모델   최대질량차   확률 스프레드   전달함수 S   번호크기 상관   80%검출 회차');
SETS.forEach(s => P(`  ${String(s.seed).padStart(4)}   ${s.mode.padEnd(8)}   ${s.mmax.toFixed(1).padStart(6)}%   `
  + `${s.spread.toFixed(2).padStart(11)}%   ${s.S.toFixed(3).padStart(9)}   ${s.rTrend.toFixed(3).padStart(11)}   ${s.need80.toLocaleString().padStart(10)}`));
P(`\n  평균: 전달함수 S = -${S.toFixed(2)},  확률 스프레드 ${SPREAD.toFixed(1)}%,  80% 검출 ${Math.round(NEED).toLocaleString()}회차 (${Math.round(NEED / 52)}년)`);
P(`  1,241회차(24년)에서의 카이제곱 검출력: 약 ${(SETS[0].p1241 * 100).toFixed(0)}%`);

P('\n■ 핵심 정정 두 가지');
P('  (1) 전달함수가 이전 값의 두 배다.');
P('      원통 챔버 + 과장된 송풍력으로 재던 S = -0.73 은 기하·유동 모델이 바뀌자 -1.39 가 됐다.');
P('      4개 볼세트에서 -1.386 ~ -1.398 로 일관되고 상관 r ~ 0.98 로 선형성도 뚜렷하다.');
P('      → S 는 기계 설계에 크게 의존한다. 실제 비너스 추첨기의 S 는 알 수 없다.');
P('  (2) 추세검정은 제조 오차에 무력하다.');
P('      제조 오차는 번호 순서와 무관한 무작위 질량이므로, 편향이 번호 크기와 상관이 없다');
P(`      (측정 상관 ${SETS.map(s => s.rTrend.toFixed(2)).join(', ')} — 부호도 제각각).`);
P('      방향을 아는 검정을 쓸 수 없고 카이제곱 전방위 검정만 남는다. 앞서 "추세검정이면');
P('      3배 효율적"이라고 한 것은 편향이 번호 크기에 비례하는 인공 시나리오에서만 맞다.');

const needFor = b => Math.round(NEED * Math.pow(SPREAD / b, 2));   // 검출력 ∝ n × 편향²
const ink = [
  { label: '인쇄 잉크', mg: 5 }, { label: '인쇄 잉크', mg: 20 }, { label: '인쇄 잉크', mg: 50 },
].map(k => { const dm = k.mg / 1000 / M * 100, bias = dm * S;
  const n = needFor(bias); return { ...k, dm: +dm.toFixed(2), bias: +bias.toFixed(2), n, yrs: Math.round(n / 52) }; });
ink.push({ label: '공식 허용오차 ±5%', mg: 400, dm: 10, bias: +SPREAD.toFixed(1),
           n: Math.round(NEED), yrs: Math.round(NEED / 52) });

P('\n■ 질량차 → 확률 편향 → 검출 난이도 (볼 4g, S = -1.39, 카이제곱 기준)');
P('  구분                질량차      확률편향     80% 검출 필요');
ink.forEach(k => P(`  ${k.label.padEnd(16)} ${k.dm.toFixed(2).padStart(6)}%   ${k.bias.toFixed(2).padStart(7)}%   `
  + `${k.n.toLocaleString().padStart(12)}회차 (${k.yrs.toLocaleString()}년)`));

P('\n■ 반드시 함께 읽어야 할 한계');
P('  S = -1.39 는 "내가 만든 유동 모델"의 성질이지 실제 추첨기의 성질이 아니다.');
P('  실제 비너스 추첨기가 질량에 얼마나 민감한지는 공개 자료로 알 수 없고,');
P('  잘 설계된 공기혼합식 기계라면 훨씬 둔감할 수 있다.');
P('  이 분석이 뒷받침하는 것은 "한국 로또에 14% 편향이 있다"가 아니라,');
P('  "제조 허용오차가 만드는 편향은 추세검정으로 잡을 수 없고, 24년치 표본으로는');
P('   검출력이 30% 안팎에 그친다"는 방법론적 사실이다.');

fs.writeFileSync('tol_final.json', JSON.stringify({
  S: +S.toFixed(2), spread: +SPREAD.toFixed(1), need80: Math.round(NEED),
  yrs80: Math.round(NEED / 52), power1241: SETS[0].p1241, sets: SETS, ink,
}, null, 0));
