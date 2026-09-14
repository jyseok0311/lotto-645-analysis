// 세 페이지(index / report / picker)에 공통 내비게이션을 주입한다.
// 멱등(idempotent): 이미 들어 있으면 기존 것을 새 마크업으로 교체한다.
//   실행:  node scripts/inject_nav.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/jyseok0311/lotto-645-analysis';

const NAV_CSS = fs.readFileSync(path.join(ROOT, 'assets', 'nav.css'), 'utf8');

const PAGES = [
  { file: 'index.html',        base: './',   key: 'home' },
  { file: 'report/index.html', base: '../',  key: 'report' },
  { file: 'picker/index.html', base: '../',  key: 'picker' },
];
const ITEMS = [
  { key: 'home',   label: '개요',      href: b => b },
  { key: 'report', label: '분석 리포트', href: b => b + 'report/' },
  { key: 'picker', label: '추첨기',     href: b => b + 'picker/' },
];

const navHTML = (base, cur) => `<nav class="sitenav" aria-label="사이트 메뉴">
  <a class="brand" href="${base}">로또 6/45 전수 분석</a>
  <ul>
${ITEMS.map(it => `    <li><a class="nl" href="${it.href(base)}"${it.key === cur ? ' aria-current="page"' : ''}>${it.label}</a></li>`).join('\n')}
  </ul>
  <span class="spacer"></span>
  <a class="src" href="${REPO}" rel="noopener">GitHub ↗</a>
</nav>`;

const NAV_START = '<nav class="sitenav"';
const NAV_END = '</nav>';

let changed = 0;
for (const p of PAGES) {
  const fp = path.join(ROOT, p.file);
  if (!fs.existsSync(fp)) { console.log('  (없음) ' + p.file); continue; }
  let h = fs.readFileSync(fp, 'utf8');

  // 1) 내비 CSS 인라인 주입 — 외부 요청 없이, file:// 로 열어도 스타일이 살아 있도록
  //    원본은 assets/nav.css 한 곳이고 이 스크립트가 <style data-nav> 블록으로 심는다.
  const cssBlock = `<style data-nav>\n${NAV_CSS}</style>`;
  h = h.replace(/<link rel="stylesheet" href="[^"]*assets\/nav\.css">\n?/g, '');  // 예전 방식 정리
  if (/<style data-nav>[\s\S]*?<\/style>/.test(h)) {
    h = h.replace(/<style data-nav>[\s\S]*?<\/style>/, cssBlock);
  } else {
    const i = h.indexOf('</head>');
    if (i < 0) throw new Error('</head> 없음: ' + p.file);
    h = h.slice(0, i) + cssBlock + '\n' + h.slice(i);
  }

  // 2) 기존 내비 제거 후 <body> 바로 뒤에 삽입
  const s = h.indexOf(NAV_START);
  if (s >= 0) {
    const e = h.indexOf(NAV_END, s) + NAV_END.length;
    h = h.slice(0, s) + h.slice(e).replace(/^\s*\n/, '');
  }
  const b = h.indexOf('<body>');
  if (b < 0) throw new Error('<body> 없음: ' + p.file);
  const at = b + '<body>'.length;
  h = h.slice(0, at) + '\n' + navHTML(p.base, p.key) + h.slice(at);

  fs.writeFileSync(fp, h, 'utf8');
  console.log(`  ✓ ${p.file}  (현재 메뉴: ${p.key})`);
  changed++;
}
console.log(`\n${changed}개 페이지에 내비게이션 주입 완료.`);
