// Приёмочная проверка в headless Chrome/Edge через DevTools Protocol. Без npm-зависимостей (Node 22+).
//
//   1) запустите сайт:  python -m http.server 8080 --directory site
//   2) node tools/check.mjs                 (BASE=http://127.0.0.1:8080 по умолчанию)
//      BASE=http://127.0.0.1:8081 node tools/check.mjs   — например, для Docker-контейнера
//
// Скриншоты сохраняются в docs/screenshots/, отчёт — в docs/check-report.json.

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const SHOTS = process.env.SHOTS_DIR || path.join(ROOT, 'docs', 'screenshots');
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error('Не найден Chrome/Edge. Укажите путь в переменной CHROME.'); process.exit(2); }

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ── CDP ──
class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data || ''}`)); else resolve(msg.result);
      } else if (msg.method) {
        (this.handlers.get(msg.method) || []).forEach((fn) => fn(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout ${method}`)), timeout);
      const fn = (p) => { clearTimeout(t); this.handlers.set(method, this.handlers.get(method).filter((f) => f !== fn)); resolve(p); };
      this.on(method, fn);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async goto(url, settle = 500) {
    const loaded = this.once('Page.loadEventFired', 20000);
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(settle);
  }
  async viewport(width, height, mobile = false) {
    this.mobile = mobile;
    this.vp = { width, height, mobile };
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile, screenWidth: width, screenHeight: height });
    await this.send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  }
  /** Клик по видимому элементу с проверкой, что его не перекрывает другой (hit-test) */
  async click(selector, { text = null, index = 0 } = {}) {
    const find = `(() => {
      let els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.getClientRects().length);
      ${text ? `els = els.filter(e => e.textContent.includes(${JSON.stringify(text)}));` : ''}
      return els[${index}] || null; })()`;
    const found = await this.eval(`(() => { const el = ${find}; if (!el) return false; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return true; })()`);
    if (!found) throw new Error(`click: ${selector}${text ? ` «${text}»` : ''} — not found`);
    await sleep(120);
    const info = await this.eval(`(() => {
      const el = ${find};
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, covered: !(hit === el || el.contains(hit) || (hit && hit.contains(el) && hit.tagName === 'LABEL')), hit: hit ? hit.tagName + '.' + hit.className : null };
    })()`);
    if (process.env.DEBUG) console.log('  click', selector, text || '', index, this.mobile ? 'touch' : 'mouse');
    if (info.error) throw new Error(`click: ${selector}${text ? ` «${text}»` : ''} — ${info.error}`);
    if (info.covered) throw new Error(`click: ${selector} перекрыт элементом ${info.hit}`);
    if (this.mobile) {
      await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: info.x, y: info.y }] });
      await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        .catch(() => this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: info.x, y: info.y }] }));
    } else {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await this.send('Input.dispatchMouseEvent', { type, x: info.x, y: info.y, button: 'left', clickCount: 1 });
      }
    }
    await sleep(250);
  }
  async key(key, { times = 1, shift = false } = {}) {
    const codes = { Escape: 27, Tab: 9, Enter: 13, ArrowRight: 39, ArrowLeft: 37, Home: 36, End: 35 };
    for (let i = 0; i < times; i += 1) {
      for (const type of ['keyDown', 'keyUp']) {
        await this.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: codes[key], modifiers: shift ? 8 : 0 });
      }
      await sleep(40);
    }
    await sleep(150);
  }
  async shot(name, { full = false } = {}) {
    const vp = this.vp;
    const dpr = vp.mobile ? 2 : 1;
    let data;
    if (!full) {
      ({ data } = await this.send('Page.captureScreenshot', { format: 'png' }));   // видимая область, мобильные в 2x
    } else {
      const y0 = await this.eval('scrollY');
      await this.eval(`window.scrollTo(0, 0)`);
      await this.eval(`Promise.all([...document.images].map(i => { i.loading = 'eager'; return (i.complete && i.naturalWidth) || !i.getAttribute('src') ? 1 : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 5000); }); }))`);
      const m = await this.send('Page.getLayoutMetrics');
      const height = Math.ceil((m.cssContentSize || m.contentSize).height);
      await this.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height, deviceScaleFactor: dpr, mobile: vp.mobile, screenWidth: vp.width, screenHeight: height });
      await sleep(600);
      const clip = { x: 0, y: 0, width: vp.width, height, scale: 1 / dpr };
      try {
        ({ data } = await this.send('Page.captureScreenshot', { format: name.endsWith('.jpg') ? 'jpeg' : 'png', quality: name.endsWith('.jpg') ? 82 : undefined, clip }));
      } catch {
        await sleep(800);   // бывает на очень длинных страницах — повтор с меньшим масштабом
        ({ data } = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { ...clip, scale: clip.scale * 0.75 } }));
      }
      await this.viewport(vp.width, vp.height, vp.mobile);
      await this.eval(`window.scrollTo(0, ${y0})`);
      await sleep(300);
    }
    await writeFile(path.join(SHOTS, name), Buffer.from(data, 'base64'));
  }
}

async function launch() {
  const profile = await mkdtemp(path.join(tmpdir(), 'd1147-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--force-color-profile=srgb', '--lang=ru-RU', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 160 && !up; i += 1) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); up = true; } catch { await sleep(250); }
  }
  if (!up) throw new Error('Chrome не запустился за 40 с');
  return { proc, profile };
}

async function newPage() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const t = await res.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const p = new Page(ws);
  p.targetId = t.id;
  p.errors = [];
  p.failed = [];
  p.bytes = 0;
  p.on('Runtime.exceptionThrown', (e) => p.errors.push(e.exceptionDetails?.exception?.description || e.exceptionDetails?.text));
  p.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') p.errors.push(e.args.map((a) => a.value || a.description).join(' ')); });
  p.on('Log.entryAdded', (e) => { if (e.entry.level === 'error' && !/favicon/.test(e.entry.url || '')) p.errors.push(`${e.entry.text} ${e.entry.url || ''}`); });
  p.on('Network.responseReceived', (e) => { if (e.response.status >= 400 && e.response.url.startsWith(BASE)) p.failed.push(`${e.response.status} ${e.response.url}`); });
  p.on('Network.loadingFailed', (e) => { if (!e.canceled) p.failed.push(`failed ${e.errorText} ${e.requestId}`); });
  p.on('Network.loadingFinished', (e) => { p.bytes += e.encodedDataLength; });
  await p.send('Page.enable');
  await p.send('Runtime.enable');
  await p.send('Network.enable');
  await p.send('Log.enable');
  return p;
}

async function closePage(p) {
  try { p.ws.close(); } catch { /* */ }
  await fetch(`http://127.0.0.1:${PORT}/json/close/${p.targetId}`).catch(() => {});
}

const overflowExpr = `(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
  wide: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('dialog:not([open])') && !e.closest('.sprite'); }).slice(0, 5).map(e => e.tagName + '.' + String(e.className).slice(0, 40)) }))()`;

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const { proc, profile } = await launch();
  const report = { base: BASE, browser: path.basename(CHROME), date: new Date().toISOString(), results };
  try {
    // ── 0. Статусы HTTP ──
    const st = async (u, opts) => (await fetch(BASE + u, { redirect: 'manual', ...opts })).status;
    check('HTTP / → 200', (await st('/')) === 200);
    check('HTTP /admin/ → 200', (await st('/admin/')) === 200);
    const adminNoSlash = await fetch(`${BASE}/admin`, { redirect: 'manual' });
    check('HTTP /admin → редирект на /admin/', [301, 302].includes(adminNoSlash.status) && /\/admin\/$/.test(adminNoSlash.headers.get('location') || ''), `${adminNoSlash.status} ${adminNoSlash.headers.get('location')}`);
    check('HTTP неизвестный путь → 404', (await st('/no-such-page')) === 404);
    check('HTTP /robots.txt → 200', (await st('/robots.txt')) === 200);
    for (const u of ['/README.md', '/Dockerfile', '/tools/check.mjs', '/nginx/default.conf', '/brand/logo-1147-original.png']) {
      check(`Служебный файл не публикуется: ${u}`, (await st(u)) === 404);
    }

    // ── 1. Главная на 390 px: ошибки, загрузка, вес ──
    let p = await newPage();
    await p.send('Network.setCacheDisabled', { cacheDisabled: true });
    await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__cls = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}` });
    await p.viewport(390, 844, true);
    p.bytes = 0;
    await p.goto(`${BASE}/`, 2500);
    const initialKB = Math.round(p.bytes / 1024);
    const resources = await p.eval(`performance.getEntriesByType('resource').map(r => r.name.replace(location.origin, '') + ' ' + Math.round(r.transferSize / 1024) + 'KB')`);
    report.mobileInitial = { kb: initialKB, resources };
    check('Мобильная главная: начальная передача ≤ 750 КБ (без карты)', initialKB <= 750, `${initialKB} КБ, ${resources.length + 1} запросов, ${BASE}`);
    const base = await p.eval(`({ ready: document.documentElement.classList.contains('app-ready'), cls: window.__cls, h1: document.querySelector('h1').textContent, nimg: [...document.images].filter(i => i.getAttribute('src') && i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').length })`);
    check('JS инициализирован (html.app-ready)', base.ready);
    check('Сдвиг макета при загрузке (CLS) < 0.05', base.cls < 0.05, `CLS ${base.cls.toFixed(4)}`);
    check('Нет битых изображений на первом экране', base.nimg === 0);
    const fold = await p.eval(`(() => { const vh = innerHeight; const b = el => el.getBoundingClientRect(); return { h1: b(document.querySelector('h1')).bottom <= vh, cta: b(document.querySelector('.hero-actions [data-book]')).bottom <= vh - 0, address: b(document.querySelector('.hero-address')).bottom <= vh, bar: getComputedStyle(document.getElementById('mobile-bar')).display !== 'none' }; })()`);
    check('390 px: заголовок, адрес и «Записаться» в первом экране', fold.h1 && fold.cta && fold.address, JSON.stringify(fold));
    await p.shot('home-390-first-screen.png');
    await p.shot('home-390-full.jpg', { full: true });

    // ── 2. Ссылки: телефон, Telegram, маршрут, отзывы ──
    const links = await p.eval(`(() => {
      const hrefs = sel => [...document.querySelectorAll(sel)].map(a => a.getAttribute('href'));
      return {
        tel: [...new Set(hrefs('a[href^="tel:"]'))],
        tg: [...new Set(hrefs('a[href*="t.me"]'))],
        route: [...new Set([...document.querySelectorAll('a')].filter(a => a.textContent.includes('маршрут') || a.textContent.includes('Маршрут')).map(a => a.getAttribute('href')))],
        reviews: [...document.querySelectorAll('a')].filter(a => a.textContent.includes('Отзывы')).map(a => a.getAttribute('href')),
        anchors: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1))),
        blank: [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).length,
      }; })()`);
    check('Телефон: только tel:+79367771147', links.tel.length === 1 && links.tel[0] === 'tel:+79367771147', links.tel.join(', '));
    check('Telegram: https://t.me/+79367771147', links.tg.length === 1 && links.tg[0] === 'https://t.me/+79367771147', links.tg.join(', '));
    check('Маршрут ведёт в Яндекс Карты к точке центра', links.route.length >= 1 && links.route.every((h) => h.startsWith('https://yandex.ru/maps/') && h.includes('rtext=~55.812381%2C37.648965') && h.includes('181605289694')), links.route[0]);
    check('Отзывы: карточка организации в Яндекс Картах', links.reviews.length === 1 && links.reviews[0].includes('/org/deteyling_1147/181605289694/reviews'), links.reviews[0]);
    check('Все якорные ссылки ведут на существующие блоки', links.anchors.length === 0, links.anchors.join(', '));
    check('Внешние ссылки с rel=noopener', links.blank === 0);

    // ── 3. Сценарий: «Полировка кузова» → «Что входит» → запись → панель ──
    await p.eval('localStorage.clear()');
    await p.click('[data-details="polish"]');
    const det = await p.eval(`({ open: document.getElementById('details-dialog').open, title: document.querySelector('#details-dialog h2').textContent, focusIn: document.getElementById('details-dialog').contains(document.activeElement) })`);
    check('«Что входит» открывается для полировки', det.open && det.title === 'Полировка кузова' && det.focusIn);
    await p.shot('details-390.png');
    await p.click('#details-dialog .dialog-foot [data-book]');
    let bk = await p.eval(`(() => { const d = document.getElementById('booking'); return { open: d.open, detailsOpen: document.getElementById('details-dialog').open, group: d.querySelector('input[name=bk-group]:checked')?.value, service: d.querySelector('input[name=bk-service]:checked')?.value, bar: getComputedStyle(document.getElementById('mobile-bar')).visibility, h: Math.round(d.getBoundingClientRect().height), vh: innerHeight }; })()`);
    check('Запись открыта с предвыбранной услугой «Экспресс-полировка»', bk.open && !bk.detailsOpen && bk.group === 'body' && bk.service === 'polish-express', JSON.stringify(bk));
    check('Нижняя панель скрыта, пока открыта запись', bk.bar === 'hidden');
    check('Запись на телефоне — во весь экран', bk.h >= bk.vh - 2, `${bk.h}/${bk.vh}`);
    await p.click('#booking input[name=bk-class][value=c3]');
    const tomorrow = await p.eval(`document.querySelectorAll('#booking input[name=bk-day]')[2].value`);
    await p.click('#booking label.chip:has(input[name=bk-day])', { index: 2 });
    await p.click('#booking label.chip:has(input[name=bk-time][value="15:00"])');
    const pinned = await p.eval(`(() => { const d = document.getElementById('booking'); const head = d.querySelector('.dialog-head').getBoundingClientRect(); const foot = d.querySelector('.dialog-foot').getBoundingClientRect(); return { dTop: d.scrollTop, head: Math.round(head.top), footBottom: Math.round(foot.bottom), vh: innerHeight }; })()`);
    check('Шапка и кнопка окна записи закреплены, прокручивается только содержимое', pinned.dTop === 0 && pinned.head === 0 && pinned.footBottom === pinned.vh, JSON.stringify(pinned));
    await p.shot('booking-step1-390.png');
    await p.click('#booking .dialog-foot .btn-primary');
    const s2 = await p.eval(`(() => { const d = document.getElementById('booking'); return { step: d.querySelector('.dialog-step')?.textContent, summary: [...d.querySelectorAll('.summary > div')].map(x => x.querySelector('dt').textContent + ': ' + x.querySelector('dd').textContent), note: d.querySelector('.demo-note')?.textContent, ro: d.querySelector('#tp-phone')?.readOnly }; })()`);
    const sumText = s2.summary.join(' | ').replace(/[  ]/g, ' ');
    check('Шаг 2: услуга, класс, цена 3 класса, длительность и время', s2.step === 'Шаг 2 из 2' && sumText.includes('Экспресс-полировка') && sumText.includes('3 класс') && sumText.includes('20 000') && sumText.includes('от 3 ч') && sumText.includes('15:00'), sumText);
    check('Подпись «Демо · заявка сохранится в этом браузере» и телефон только для чтения', s2.note === 'Демо · заявка сохранится в этом браузере' && s2.ro === true);
    await p.shot('booking-step2-390.png');
    // двойное нажатие
    await p.eval(`(() => { const b = document.getElementById('bk-submit'); b.click(); b.click(); })()`);
    await sleep(300);
    const done = await p.eval(`(() => { const d = document.getElementById('booking'); const list = JSON.parse(localStorage.getItem('d1147.requests.v1') || '[]'); return { title: d.querySelector('.success h3')?.textContent, id: d.querySelector('.success-id')?.textContent, count: list.length, mine: list.filter(r => r.source === 'site').length, rec: list.find(r => r.source === 'site'), adminHref: d.querySelector('a[href^="admin/"]')?.getAttribute('href') }; })()`);
    check('Успех: «Тестовая заявка сохранена»', done.title === 'Тестовая заявка сохранена', done.id);
    check('Двойное нажатие не создаёт дубль', done.mine === 1, `заявок с сайта: ${done.mine}, всего ${done.count}`);
    check('В хранилище: услуга, класс, дата/время МСК, тестовый профиль, статус', done.rec && done.rec.serviceId === 'polish-express' && done.rec.classId === 'c3' && done.rec.visit.date === tomorrow && done.rec.visit.time === '15:00' && done.rec.visit.iso === `${tomorrow}T15:00:00+03:00` && done.rec.profile.test === true && done.rec.status === 'new' && !!done.rec.createdAt, JSON.stringify(done.rec?.visit));
    await p.shot('booking-success-390.png');
    const newId = done.rec.id;
    await p.click('#booking a[href^="admin/"]');
    await p.once('Page.loadEventFired').catch(() => {});
    await sleep(800);
    const adm = await p.eval(`(() => { const row = document.getElementById('req-${newId}'); return { url: location.pathname + location.search, h1: document.querySelector('h1').textContent, hl: row?.classList.contains('is-highlight'), text: row?.textContent, first: document.querySelector('.admin-card, .admin-table tbody tr')?.id, focus: document.activeElement?.id }; })()`);
    check('Панель открыта по ID, заявка выделена и стоит первой', adm.h1 === 'Демо-панель менеджера' && adm.hl && adm.first === `req-${newId}`, `${adm.url} first=${adm.first}`);
    check('Панель: услуга, класс и время совпадают', adm.text.includes('Экспресс-полировка') && adm.text.includes('3 класс') && adm.text.includes('15:00'), adm.text.slice(0, 160));
    await p.shot('admin-390.png');
    await p.eval(`(() => { const s = document.getElementById('st-${newId}'); s.value = 'contacted'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await p.goto(`${BASE}/admin/`, 700);
    const persisted = await p.eval(`document.getElementById('st-${newId}')?.value`);
    check('Статус «Связались» сохраняется после перезагрузки', persisted === 'contacted', persisted);

    // ── 4. Без услуги, «Нужна консультация», «Уточнить время», назад без потери ──
    await p.goto(`${BASE}/`, 600);
    await p.click('.hero [data-book]');
    await p.click('#booking .dialog-foot .btn-primary');
    const errs = await p.eval(`({ g: document.getElementById('bk-group')?.getAttribute('aria-invalid'), c: document.getElementById('bk-class')?.getAttribute('aria-invalid'), msg: document.getElementById('bk-group-err')?.textContent, desc: document.getElementById('bk-group')?.getAttribute('aria-describedby'), focusIn: document.getElementById('bk-group').contains(document.activeElement) })`);
    check('Без выбора: ошибки у полей и фокус на первом', errs.g === 'true' && errs.c === 'true' && !!errs.msg && errs.desc === 'bk-group-err' && errs.focusIn, errs.msg);
    await p.click('#booking label.chip:has(input[name=bk-group][value=consult])');
    await p.click('#booking input[name=bk-class][value=unknown]');
    await p.click('#booking .dialog-foot .btn-primary');
    let s3 = await p.eval(`[...document.querySelectorAll('#booking .summary dd')].map(x => x.textContent).join(' | ')`);
    check('Консультация: «Уточнить стоимость» и «Время уточнить»', s3.includes('Нужна консультация') && s3.includes('Уточнить стоимость') && s3.includes('Время уточнить'), s3);
    await p.click('#booking .dialog-foot .btn-ghost', { text: 'Назад' });
    const kept = await p.eval(`({ g: document.querySelector('#booking input[name=bk-group]:checked')?.value, c: document.querySelector('#booking input[name=bk-class]:checked')?.value, d: document.querySelector('#booking input[name=bk-day]:checked')?.value })`);
    check('«Назад» ничего не сбрасывает', kept.g === 'consult' && kept.c === 'unknown' && kept.d === '', JSON.stringify(kept));
    await p.click('#booking .dialog-foot .btn-primary');
    await p.click('#bk-submit');
    const consultOk = await p.eval(`document.querySelector('#booking .success h3')?.textContent`);
    check('Заявка «Нужна консультация» сохраняется', consultOk === 'Тестовая заявка сохранена');
    await p.click('#booking .success-actions .btn-ghost', { text: 'Вернуться к услугам' });
    const back = await p.eval(`({ open: document.getElementById('booking').open, focus: document.activeElement?.id })`);
    check('«Вернуться к услугам» закрывает окно и ведёт к услугам', !back.open && back.focus === 'services-title', back.focus);

    // ── 5. Прайс: класс, запись из строки, пустой фильтр и сброс ──
    await p.eval(`(() => { const s = document.getElementById('pc-class'); s.value = 'c2'; s.dispatchEvent(new Event('change')); })()`);
    const v2 = await p.eval(`document.querySelector('#price-wash-detail .price-value').textContent`);
    check('Прайс: 2 класс показывает цену из данных (детейлинг-мойка 3 100 ₽)', v2.replace(/\s/g, ' ') === '3 100 ₽', v2);
    await p.click('#price-wash-detail [data-book]');
    const fromRow = await p.eval(`({ s: document.querySelector('#booking input[name=bk-service]:checked')?.value, c: document.querySelector('#booking input[name=bk-class]:checked')?.value, price: document.querySelector('#booking [data-price-of="wash-detail"]')?.textContent })`);
    check('Запись из строки прайса переносит услугу и класс', fromRow.s === 'wash-detail' && fromRow.c === 'c2' && fromRow.price.replace(/[  ]/g, ' ').includes('3 100'), JSON.stringify(fromRow));
    await p.key('Escape');
    const esc = await p.eval(`({ open: document.getElementById('booking').open, focus: document.activeElement?.closest('#price-wash-detail') !== null })`);
    check('Escape закрывает запись, фокус возвращается на кнопку строки', !esc.open && esc.focus);
    await p.eval(`(() => { const i = document.getElementById('pc-q'); i.value = 'вертолёт'; i.dispatchEvent(new Event('input')); })()`);
    await sleep(400);
    const empty = await p.eval(`({ msg: document.querySelector('.price-empty p')?.textContent, rows: document.querySelectorAll('#price-list .price-row').length })`);
    check('Пустая выдача: сообщение и кнопка сброса', empty.rows === 0 && /Ничего не нашлось/.test(empty.msg || ''), empty.msg);
    await p.click('.price-empty .btn');
    const reset = await p.eval(`({ all: document.querySelectorAll('#price-list .price-row').length, shown: document.querySelectorAll('#price-list .price-row:not([hidden])').length, more: document.querySelectorAll('.price-more').length })`);
    check('«Сбросить фильтры» возвращает позиции (по 4 в разделе + «Ещё»)', reset.all > 20 && reset.shown === 16 && reset.more === 4, JSON.stringify(reset));
    await p.click('.price-more', { text: 'Кузов' });
    const moreOpen = await p.eval(`({ shown: document.querySelectorAll('#pr-body .price-row:not([hidden])').length, exp: document.querySelector('#price-list .price-group:nth-of-type(2) .price-more')?.getAttribute('aria-expanded') })`);
    check('«Ещё N позиций» раскрывает раздел', moreOpen.shown > 4 && moreOpen.exp === 'true', JSON.stringify(moreOpen));
    await p.click('#price-controls .chip', { text: 'Шины' });
    const tires = await p.eval(`[...document.querySelectorAll('#price-list .price-row')].map(r => r.id)`);
    check('Категория «Шины» фильтрует прайс', tires.length > 0 && tires.every((id) => ['price-tire-set', 'price-balancing', 'price-tire-repair', 'price-disc-polish', 'price-disc-protect'].includes(id)), tires.join(','));
    await p.eval(`(() => { const s = document.getElementById('pc-class'); s.value = 'all'; s.dispatchEvent(new Event('change')); })()`);
    await p.click('#service-filters .chip', { text: 'Салон' });
    const svc = await p.eval(`[...document.querySelectorAll('#service-cards .card')].filter(c => !c.hidden).map(c => c.dataset.featured)`);
    check('Фильтр услуг «Салон» меняет выдачу', svc.length === 1 && svc[0] === 'interior', svc.join(','));
    await p.click('#service-filters .chip', { text: 'Все услуги' });

    // ── 6. Клавиатура: фокус в модальном окне ──
    await p.viewport(1440, 900, false);
    await p.goto(`${BASE}/`, 600);
    await p.click('.header-cta');
    let trapped = true;
    for (let i = 0; i < 25; i += 1) {
      await p.key('Tab');
      const inside = await p.eval(`document.getElementById('booking').contains(document.activeElement)`);
      if (!inside) { trapped = false; break; }
    }
    let trappedBack = true;
    for (let i = 0; i < 25; i += 1) {
      await p.key('Tab', { shift: true });
      if (!(await p.eval(`document.getElementById('booking').contains(document.activeElement)`))) { trappedBack = false; break; }
    }
    check('Tab и Shift+Tab не выводят фокус из окна записи', trapped && trappedBack, `Tab ${trapped}, Shift+Tab ${trappedBack}`);
    await p.key('Escape');
    const focusBack = await p.eval(`document.activeElement?.classList.contains('header-cta')`);
    check('После Escape фокус на кнопке «Записаться» в шапке', focusBack);

    // ── 7. Галерея и «до/после» ──
    await p.click('#gallery a[data-lightbox]');
    const lb1 = await p.eval(`({ open: document.getElementById('lightbox').open, count: document.querySelector('.lb-count')?.textContent, src: document.querySelector('.lb-stage img')?.getAttribute('src') })`);
    await p.key('ArrowRight');
    const lb2 = await p.eval(`document.querySelector('.lb-count')?.textContent`);
    await p.key('Escape');
    const lb3 = await p.eval(`({ open: document.getElementById('lightbox').open, focus: document.activeElement?.hasAttribute('data-lightbox') })`);
    check('Галерея: открытие, стрелки, Escape и возврат фокуса', lb1.open && lb1.count === '1 из 6' && lb2 === '2 из 6' && !lb3.open && lb3.focus, `${lb1.src}`);
    await p.click('#gallery a[data-lightbox]', { index: 1 });
    await p.click('#lightbox .dialog-close');
    const lb4 = await p.eval(`document.getElementById('lightbox').open`);
    check('Галерея закрывается кнопкой', lb4 === false);
    await p.eval(`document.getElementById('ba-range').focus()`);
    await p.key('ArrowRight', { times: 5 });
    const ba = await p.eval(`({ v: document.getElementById('ba-range').value, pos: document.getElementById('ba-frame').style.getPropertyValue('--pos'), vt: document.getElementById('ba-range').getAttribute('aria-valuetext') })`);
    check('«До/после»: клавиатура двигает границу', ba.v === '55' && ba.pos === '55%', ba.vt);
    const pt = await p.eval(`(() => { const f = document.getElementById('ba-frame'); f.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = f.getBoundingClientRect(); return { x: r.left + r.width * 0.2, y: r.top + r.height / 2 }; })()`);
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    const ba2 = await p.eval(`+document.getElementById('ba-range').value`);
    check('«До/после»: касание/клик переносит границу без перетаскивания', Math.abs(ba2 - 20) <= 2, `${ba2}%`);
    await p.goto(`${BASE}/`, 1200);
    await p.shot('home-1440-first-screen.png');
    await p.shot('home-1440-full.jpg', { full: true });
    await p.eval(`location.hash = '#prices'`);
    await sleep(500);
    const sm = await p.eval(`(() => { const h = document.querySelector('.site-header').getBoundingClientRect().bottom; const t = document.getElementById('prices-title').getBoundingClientRect().top; return { h, t }; })()`);
    check('Якорь не уходит под липкую шапку (scroll-margin)', sm.t >= sm.h, JSON.stringify(sm));
    await p.goto(`${BASE}/?direct=1#contacts`, 900);
    const direct = await p.eval(`(() => { const t = document.getElementById('contacts-title').getBoundingClientRect().top; return { t: Math.round(t), ih: innerHeight }; })()`);
    check('Прямая ссылка /#contacts открывает блок контактов', direct.t >= 0 && direct.t < direct.ih / 2, JSON.stringify(direct));

    // ── 8. Меню на телефоне ──
    await p.viewport(360, 740, true);
    await p.goto(`${BASE}/`, 600);
    await p.click('#menu summary');
    const m1 = await p.eval(`({ open: document.getElementById('menu').open, exp: document.querySelector('#menu summary').getAttribute('aria-expanded') })`);
    await p.key('Escape');
    const m2 = await p.eval(`({ open: document.getElementById('menu').open, focus: document.activeElement?.tagName })`);
    check('Меню: открывается, Escape закрывает, фокус на кнопке', m1.open && m1.exp === 'true' && !m2.open && m2.focus === 'SUMMARY');
    await p.click('#menu summary');
    await p.click('#menu-panel a', { text: 'Цены' });
    const m3 = await p.eval(`({ open: document.getElementById('menu').open, hash: location.hash })`);
    check('Меню: переход по пункту закрывает меню', !m3.open && m3.hash === '#prices');

    // ── 9. Альбомная ориентация: окно записи помещается и прокручивается ──
    await p.viewport(844, 390, true);
    await p.goto(`${BASE}/`, 500);
    await p.eval(`document.querySelector('.hero [data-book]').click()`);
    await sleep(300);
    const land = await p.eval(`(() => { const d = document.getElementById('booking'); const b = d.querySelector('.dialog-body'); const f = d.querySelector('.dialog-foot').getBoundingClientRect(); return { h: Math.round(d.getBoundingClientRect().height), vh: innerHeight, scroll: b.scrollHeight > b.clientHeight, footVisible: f.bottom <= innerHeight + 1 }; })()`);
    check('Landscape: запись во весь экран, тело прокручивается, кнопка видна', land.h <= land.vh && land.scroll && land.footVisible, JSON.stringify(land));
    await p.key('Escape');
    await p.eval(`document.getElementById('menu').open = true`);
    const landMenu = await p.eval(`(() => { const r = document.getElementById('menu-panel').getBoundingClientRect(); const el = document.getElementById('menu-panel'); return { bottom: Math.round(r.bottom), vh: innerHeight, scrollable: el.scrollHeight > el.clientHeight }; })()`);
    check('Landscape: меню помещается или прокручивается', landMenu.bottom <= landMenu.vh + 1, JSON.stringify(landMenu));

    // ── 10. Ширины: нет горизонтальной прокрутки ──
    for (const [w, hgt, mob] of [[320, 640, true], [360, 740, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1280, 800, false], [1440, 900, false]]) {
      await p.viewport(w, hgt, mob);
      for (const url of ['/', '/admin/']) {
        await p.goto(`${BASE}${url}`, 400);
        const o = await p.eval(overflowExpr);
        check(`${w} px ${url}: без горизонтальной прокрутки`, o.sw <= o.iw, o.sw > o.iw ? `${o.sw}>${o.iw} ${o.wide.join(' ')}` : '');
      }
    }

    // ── 11. Зоны нажатия ≥ 44×44 на 390 px ──
    await p.viewport(390, 844, true);
    await p.goto(`${BASE}/`, 600);
    const small = await p.eval(`[...document.querySelectorAll('a.btn, button, .chip, summary, select, input:not([type=radio]), .main-nav a, .menu-toggle, .contact-extra a, .map-link, .price-table summary')]
      .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('dialog'))
      .map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(x => x.w < 44 || x.h < 44)`);
    check('Основные зоны нажатия не меньше 44×44', small.length === 0, small.map((s) => `${s.t} ${s.w}×${s.h}`).join('; '));
    const fontMin = await p.eval(`Math.min(...[...document.querySelectorAll('input, select, textarea')].map(e => parseFloat(getComputedStyle(e).fontSize)))`);
    check('Поля ввода на телефоне от 16 px', fontMin >= 16, `${fontMin}px`);
    check('Консоль и сеть без ошибок (главная и панель)', p.errors.length === 0 && p.failed.length === 0, [...p.errors, ...p.failed].slice(0, 5).join(' | '));
    await closePage(p);

    // ── 12. Панель: событие storage из другой вкладки, восстановление демо-данных ──
    const a = await newPage();
    await a.viewport(1440, 900, false);
    await a.goto(`${BASE}/admin/`, 600);
    await a.shot('admin-1440.png');
    const before = await a.eval(`document.querySelectorAll('.admin-table tbody tr').length`);
    const b = await newPage();
    await b.goto(`${BASE}/`, 400);
    const created = await b.eval(`import('./js/requests.js').then(m => m.createRequest({ serviceId: 'ozone', classId: 'c1', date: null, time: null, token: 'other-tab' }).request.id)`);
    await sleep(600);
    const after = await a.eval(`({ n: document.querySelectorAll('.admin-table tbody tr').length, has: !!document.getElementById('req-${created}'), first: document.querySelector('.admin-table tbody tr')?.id })`);
    check('Панель обновляется по событию storage из другой вкладки', after.n === before + 1 && after.has && after.first === `req-${created}`, `${before} → ${after.n}`);
    await closePage(b);
    await a.click('.status-chip', { text: 'Завершена' });
    await a.eval(`(() => { const i = document.getElementById('adm-q'); i.value = 'нет такой услуги'; i.dispatchEvent(new Event('input')); })()`);
    await sleep(400);
    const admEmpty = await a.eval(`document.querySelector('.admin-empty p')?.textContent`);
    check('Панель: пустое состояние с фильтрами', admEmpty === 'Нет заявок по выбранным условиям.');
    await a.click('.admin-empty .btn');
    const admAll = await a.eval(`({ n: document.querySelectorAll('.admin-table tbody tr').length, q: document.getElementById('adm-q').value })`);
    check('Панель: «Сбросить фильтры» возвращает список', admAll.n === after.n && admAll.q === '');
    await a.eval(`(() => { const i = document.getElementById('adm-q'); i.value = '1001'; i.dispatchEvent(new Event('input')); })()`);
    await sleep(400);
    const byId = await a.eval(`[...document.querySelectorAll('.admin-table tbody tr')].map(r => r.id)`);
    check('Панель: поиск по номеру заявки', byId.length === 1 && byId[0] === 'req-1001', byId.join(','));
    await a.eval(`localStorage.setItem('other-project-key', 'keep')`);
    await a.click('#adm-restore');
    await a.shot('admin-restore-confirm-1440.png');
    await a.click('#reset-confirm');
    const restored = await a.eval(`({ n: document.querySelectorAll('.admin-table tbody tr').length, other: localStorage.getItem('other-project-key') })`);
    check('«Восстановить демо-данные»: 4 заявки, чужие ключи не тронуты', restored.n === 4 && restored.other === 'keep', JSON.stringify(restored));
    check('Панель без ошибок в консоли', a.errors.length === 0 && a.failed.length === 0, [...a.errors, ...a.failed].slice(0, 5).join(' | '));
    await closePage(a);

    // ── 13. Недоступный localStorage ──
    const n = await newPage();
    await n.send('Page.addScriptToEvaluateOnNewDocument', { source: `Storage.prototype.setItem = function () { throw new DOMException('Denied', 'SecurityError'); };` });
    await n.viewport(390, 844, true);
    await n.goto(`${BASE}/`, 500);
    await n.click('[data-book][data-service="wash-detail"]');
    await n.click('#booking input[name=bk-class][value=c1]');
    await n.click('#booking .dialog-foot .btn-primary');
    await n.click('#bk-submit');
    const ns = await n.eval(`({ alert: document.getElementById('bk-alert')?.textContent, success: !!document.querySelector('#booking .success'), btn: document.getElementById('bk-submit')?.disabled })`);
    check('Без localStorage: понятное сообщение, успех не показан', /Не удалось сохранить/.test(ns.alert || '') && !ns.success && ns.btn === false, ns.alert?.slice(0, 90));
    await n.shot('booking-storage-error-390.png');
    await n.goto(`${BASE}/admin/`, 500);
    const na = await n.eval(`document.querySelector('.admin-alert')?.textContent || ''`);
    check('Без localStorage: панель показывает сообщение', /недоступно/.test(na));
    await closePage(n);

    // ── 14. Без JavaScript: адрес, телефон, услуги и базовый прайс читаются ──
    const nj = await newPage();
    await nj.send('Emulation.setScriptExecutionDisabled', { value: true });
    await nj.viewport(390, 844, true);
    await nj.goto(`${BASE}/`, 500);
    const noJs = await nj.send('Runtime.evaluate', { expression: '1' }).then(() => null).catch(() => null);
    void noJs;
    const dom = await nj.send('DOM.getDocument', { depth: -1 });
    const { outerHTML } = await nj.send('DOM.getOuterHTML', { nodeId: dom.root.nodeId });
    const text = outerHTML.replace(/<[^>]+>/g, ' ').replace(/[  ]/g, ' ').replace(/&nbsp;/g, ' ');
    check('Без JS: адрес, телефон, услуги и цены в HTML', text.includes('Маломосковская ул., 14') && text.includes('+7 (936) 777-11-47') && text.includes('Полировка кузова') && text.includes('2 800–3 800 ₽') && !text.includes('5 класс') && text.includes('Мойка кузова и ковриков') && outerHTML.includes('tel:+79367771147'));
    await nj.shot('home-390-no-js.png');
    await closePage(nj);
  } catch (e) {
    check('Скрипт проверки завершился без исключений', false, e.stack?.split('\n').slice(0, 3).join(' '));
  } finally {
    proc.kill();
    await sleep(500);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  const failed = results.filter((r) => !r.ok);
  report.summary = { total: results.length, passed: results.length - failed.length, failed: failed.length };
  await writeFile(process.env.REPORT || path.join(ROOT, 'docs', 'check-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nИтого: ${report.summary.passed}/${report.summary.total} пройдено${failed.length ? `, не пройдено: ${failed.length}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main();
