// 동행복권 로또 6/45 전회차 데이터 수집/갱신 스크립트
//   최초 수집:  node update_lotto.mjs --full
//   주간 갱신:  node update_lotto.mjs          (새 회차만 추가)
// 출력: lotto_all.csv (엑셀용, UTF-8 BOM), lotto_all.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(DIR, '..', 'data');
const CSV = path.join(DATA, 'lotto_all.csv');
const JSN = path.join(DATA, 'lotto_all.json');
const FULL = process.argv.includes('--full');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const BASE = 'https://www.dhlottery.co.kr';
let cookie = '';

async function boot() {
  const r = await fetch(`${BASE}/lt645/result`, { headers: { 'User-Agent': UA } });
  cookie = (r.headers.getSetCookie?.() ?? []).map(s => s.split(';')[0]).join('; ');
  await r.text();
}

// 회차 ep를 중심으로 최대 10개 회차를 한 번에 반환하는 공식 API
async function get(ep, tries = 4) {
  const url = `${BASE}/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${ep}&_=${Date.now()}`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: {
        'User-Agent': UA, Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01', Referer: `${BASE}/lt645/result`,
      }});
      return (await r.json())?.data?.list ?? [];
    } catch { await new Promise(s => setTimeout(s, 800 * (i + 1))); }
  }
  throw new Error('수집 실패: ep=' + ep);
}

async function latestDraw() {           // 이분 탐색으로 최신 회차 확인
  let lo = 1000, hi = 3000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    (await get(mid)).some(x => x.ltEpsd === mid) ? (lo = mid) : (hi = mid - 1);
  }
  return lo;
}

const toRec = r => ({
  draw: r.ltEpsd, date: `${r.ltRflYmd.slice(0,4)}-${r.ltRflYmd.slice(4,6)}-${r.ltRflYmd.slice(6,8)}`,
  numbers: [r.tm1WnNo, r.tm2WnNo, r.tm3WnNo, r.tm4WnNo, r.tm5WnNo, r.tm6WnNo], bonus: r.bnsWnNo,
  rank1: { winners: r.rnk1WnNope, prize: r.rnk1WnAmt }, rank2: { winners: r.rnk2WnNope, prize: r.rnk2WnAmt },
  rank3: { winners: r.rnk3WnNope, prize: r.rnk3WnAmt }, rank4: { winners: r.rnk4WnNope, prize: r.rnk4WnAmt },
  rank5: { winners: r.rnk5WnNope, prize: r.rnk5WnAmt },
  totalWinners: r.sumWnNope, totalPrize: r.rlvtEpsdSumNtslAmt,
});

const HDR = ['회차','추첨일','번호1','번호2','번호3','번호4','번호5','번호6','보너스',
  '1등당첨자수','1등당첨금','2등당첨자수','2등당첨금','3등당첨자수','3등당첨금',
  '4등당첨자수','4등당첨금','5등당첨자수','5등당첨금','총당첨자수','총당첨금'];
const toCsvRow = r => [r.draw, r.date, ...r.numbers, r.bonus,
  r.rank1.winners, r.rank1.prize, r.rank2.winners, r.rank2.prize, r.rank3.winners, r.rank3.prize,
  r.rank4.winners, r.rank4.prize, r.rank5.winners, r.rank5.prize, r.totalWinners, r.totalPrize].join(',');

await boot();
const LAST = await latestDraw();

const map = new Map();
let have = 0;
if (!FULL && fs.existsSync(JSN)) {
  for (const r of JSON.parse(fs.readFileSync(JSN, 'utf8'))) map.set(r.draw, r);
  have = Math.max(0, ...map.keys());
}
if (have >= LAST) { console.log(`이미 최신입니다 (${LAST}회차).`); process.exit(0); }

const from = have ? have + 1 : 1;
console.log(`${from}~${LAST}회차 수집 중...`);
for (let ep = from; ep <= LAST + 5; ep += 10) {
  for (const x of await get(ep)) map.set(x.ltEpsd, toRec(x));
  await new Promise(s => setTimeout(s, 120));
}
for (const x of await get(LAST)) map.set(x.ltEpsd, toRec(x));

const rows = [...map.values()].sort((a, b) => a.draw - b.draw);
const missing = [];
for (let i = 1; i <= LAST; i++) if (!map.has(i)) missing.push(i);

fs.writeFileSync(CSV, '\ufeff' + [HDR.join(','), ...rows.map(toCsvRow)].join('\r\n'), 'utf8');
fs.writeFileSync(JSN, JSON.stringify(rows, null, 1), 'utf8');
console.log(`완료: 1~${LAST}회차 ${rows.length}건` + (missing.length ? ` / 누락 ${missing.length}건: ${missing.slice(0,10)}` : ' / 누락 없음'));
