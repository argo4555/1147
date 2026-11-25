// Публичная страница: привязка контактов, витрина, прайс, «Что входит», галерея, «до/после», карта, меню.

import { CONTACTS, CAR_CLASSES, GROUPS, SERVICES, FEATURED, getService, priceFor, cardPrice, rub } from './data.js';
import { initBooking } from './booking.js';
import { h, icon, clear, plural, createAnnouncer, setupDialog, closeButton } from './dom.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const announce = createAnnouncer($('#live'));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const priceState = { cls: 'all', group: 'all', q: '', open: new Set() };
const PRICE_LIMIT = 4;
let booking;
let details;

function safe(name, fn) {
  try { fn(); return true; } catch (e) { console.error(`[1147] ${name}:`, e); return false; }
}

// ── Контакты из единого источника ──
function applyBindings() {
  $$('[data-bind]').forEach((el) => {
    const v = CONTACTS[el.dataset.bind];
    if (typeof v === 'string' && el.children.length === 0) el.textContent = v;
  });
  $$('[data-bind-href]').forEach((el) => {
    const v = CONTACTS[el.dataset.bindHref];
    if (typeof v === 'string') el.setAttribute('href', v);
  });
  $$('[data-card-price]').forEach((el) => {
    const f = FEATURED.find((x) => x.id === el.dataset.cardPrice);
    if (f) el.textContent = cardPrice(f);
  });
}

// ── Меню на телефоне (details/summary + доработки) ──
function initMenu() {
  const menu = $('#menu');
  if (!menu) return;
  const summary = menu.querySelector('summary');
  summary.setAttribute('aria-controls', 'menu-panel');
  const sync = () => {
    summary.setAttribute('aria-expanded', String(menu.open));
    document.documentElement.classList.toggle('menu-open', menu.open);
  };
  sync();
  menu.addEventListener('toggle', sync);
  const close = (focus) => { if (menu.open) { menu.open = false; if (focus) summary.focus(); } };
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } });
  menu.addEventListener('click', (e) => { if (e.target.closest('.menu-panel a')) close(false); });
  menu.addEventListener('focusout', (e) => { if (menu.open && e.relatedTarget && !menu.contains(e.relatedTarget)) close(false); });
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) close(false); });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) close(false); });
}

// ── Витрина услуг ──
function initServiceFilters() {
  const box = $('#service-filters');
  const list = $('#service-cards');
  if (!box || !list) return;
  const cards = $$('.card', list);
  const counts = Object.fromEntries(GROUPS.map((g) => [g.id, cards.filter((c) => c.dataset.group === g.id).length]));
  const opts = [{ id: 'all', label: 'Все услуги', n: cards.length }, ...GROUPS.map((g) => ({ id: g.id, label: g.label, n: counts[g.id] }))];
  let empty = null;

  const apply = (id, { speak = true } = {}) => {
    let shown = 0;
    cards.forEach((c) => {
      const on = id === 'all' || c.dataset.group === id;
      c.hidden = !on;
      if (on) shown += 1;
    });
    list.classList.toggle('is-all', id === 'all');
    $$('.chip', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === id)));
    if (empty) { empty.remove(); empty = null; }
    if (!shown) {
      empty = h('li', { class: 'cards-empty' }, 'В этой категории пока нет карточек. ',
        h('button', { class: 'btn-link', type: 'button', onclick: () => apply('all') }, 'Показать все услуги'));
      list.append(empty);
    }
    if (speak) {
      const label = opts.find((o) => o.id === id)?.label;
      announce(`${label}: ${shown} ${plural(shown, ['услуга', 'услуги', 'услуг'])}`);
    }
  };

  opts.forEach((o) => {
    box.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(o.id === 'all'), dataset: { filter: o.id }, onclick: () => apply(o.id) },
      o.label, h('span', { class: 'count' }, ` ${o.n}`)));
  });
  apply('all', { speak: false });
}

// ── Прайс ──
function classOptionLabel(c) { return `${c.label} — ${c.hint.toLowerCase()}`; }

function initPrices() {
  const controls = $('#price-controls');
  const listBox = $('#price-list');
  if (!controls || !listBox) return;

  const select = h('select', { class: 'select', id: 'pc-class' },
    h('option', { value: 'all' }, 'Все классы — диапазон цен'),
    CAR_CLASSES.map((c) => h('option', { value: c.id }, classOptionLabel(c))));
  select.addEventListener('change', () => { priceState.cls = select.value; renderPriceList(true); });

  const chips = h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'pc-cat-label' },
    [{ id: 'all', label: 'Все' }, ...GROUPS].map((g) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(g.id === 'all'), dataset: { group: g.id },
      onclick: () => { priceState.group = g.id; syncChips(); renderPriceList(true); },
    }, g.label)));

  const search = h('input', { class: 'input', id: 'pc-q', type: 'search', placeholder: 'Например, керамика', autocomplete: 'off', enterkeyhint: 'search' });
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { priceState.q = search.value.trim(); renderPriceList(true); }, 220);
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search.blur(); } });

  controls.append(
    h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'pc-class' }, 'Класс автомобиля'), select),
    h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'pc-cat-label' }, 'Категория'), chips),
    h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'pc-q' }, 'Поиск по услугам'), search),
  );

  function syncChips() {
    $$('.chip', chips).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.group === priceState.group)));
  }

  function resetFilters() {
    priceState.group = 'all';
    priceState.q = '';
    search.value = '';
    syncChips();
    renderPriceList(true);
    search.focus();
  }

  function rowFor(s) {
    const p = s.pricing;
    const side = h('div', { class: 'price-side' });
    let extra = null;
    let note = null;
    if (p.type === 'variants') {
      side.append(h('div', { class: 'price-variants' }, p.variants.map((v) => h('span', {}, `${v.label}: `, h('b', {}, rub(v.price)), s.unit ? ` ${s.unit}` : ''))));
      if (priceState.cls !== 'all') note = `Цена не зависит от класса: ${p.basis}.`;
    } else if (p.type === 'table') {
      side.append(h('p', { class: 'price-value' }, priceFor(s, priceState.cls).text));
      note = `Цена ${p.basis}${priceState.cls !== 'all' ? ', а не по классу' : ''}.`;
      extra = h('details', { class: 'price-table' }, h('summary', {}, 'Цены по радиусу'),
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Радиус'), p.columns.map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, p.rows.map((r) => h('tr', {}, h('th', { scope: 'row' }, r.label), r.price.map((v) => h('td', {}, rub(v))))))));
    } else {
      const pr = priceFor(s, priceState.cls);
      side.append(h('p', { class: `price-value${pr.kind === 'ask' ? ' is-ask' : ''}` }, pr.text));
    }
    const clsLabel = CAR_CLASSES.find((c) => c.id === priceState.cls)?.label;
    side.append(h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      dataset: { book: '', service: s.id, class: priceState.cls !== 'all' ? priceState.cls : '' },
      'aria-label': `Записаться: ${s.name}${clsLabel ? `, ${clsLabel}` : ''}`,
    }, 'Записаться'));
    return h('li', { class: 'price-row', id: `price-${s.id}` },
      h('div', { class: 'price-main' },
        h('h4', { class: 'price-name' }, s.name),
        h('p', { class: 'price-short' }, s.short + (s.note ? ` ${s.note}` : '')),
        note ? h('p', { class: 'price-note' }, note) : null),
      side, extra);
  }

  function matches(s) {
    if (priceState.group !== 'all' && s.group !== priceState.group) return false;
    if (!priceState.q) return true;
    const q = priceState.q.toLowerCase().replace(/ё/g, 'е');
    const hay = `${s.name} ${s.short} ${(s.includes || []).join(' ')}`.toLowerCase().replace(/ё/g, 'е');
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function renderPriceList(speak) {
    const items = SERVICES.filter(matches);
    clear(listBox);
    const clsObj = CAR_CLASSES.find((c) => c.id === priceState.cls);
    const summary = h('p', { class: 'price-summary' },
      `${items.length} ${plural(items.length, ['позиция', 'позиции', 'позиций'])}`,
      clsObj ? ` · ${clsObj.label}: ${clsObj.hint.toLowerCase()}` : ` · все классы, диапазон от 1 до ${CAR_CLASSES.length} класса`);
    listBox.append(summary);
    if (!items.length) {
      const group = GROUPS.find((g) => g.id === priceState.group);
      listBox.append(h('div', { class: 'price-empty' },
        h('p', {}, `Ничего не нашлось${priceState.q ? ` по запросу «${priceState.q}»` : ''}${group ? ` в категории «${group.label}»` : ''}.`),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: resetFilters }, 'Сбросить фильтры')));
      if (speak) announce('Ничего не нашлось. Есть кнопка «Сбросить фильтры».');
      return;
    }
    // В режиме «Все» без поиска — по 4 позиции в разделе, остальное по кнопке (страница на телефоне короче)
    const compact = priceState.group === 'all' && !priceState.q;
    GROUPS.forEach((g) => {
      const rows = items.filter((s) => s.group === g.id);
      if (!rows.length) return;
      const lis = rows.map(rowFor);
      const ul = h('ul', { class: 'price-rows', id: `pr-${g.id}` }, lis);
      let more = null;
      const extra = lis.slice(PRICE_LIMIT);
      if (compact && extra.length) {
        const open = priceState.open.has(g.id);
        extra.forEach((li) => { li.hidden = !open; });
        const label = (isOpen) => (isOpen ? `Свернуть раздел «${g.label}»` : `Ещё ${extra.length} ${plural(extra.length, ['позиция', 'позиции', 'позиций'])} в разделе «${g.label}»`);
        more = h('button', { class: 'btn btn-ghost btn-sm price-more', type: 'button', 'aria-expanded': String(open), 'aria-controls': `pr-${g.id}` }, label(open));
        more.addEventListener('click', () => {
          const willOpen = !priceState.open.has(g.id);
          if (willOpen) priceState.open.add(g.id); else priceState.open.delete(g.id);
          extra.forEach((li) => { li.hidden = !willOpen; });
          more.setAttribute('aria-expanded', String(willOpen));
          more.textContent = label(willOpen);
          if (willOpen) extra[0].querySelector('button')?.focus();
        });
      }
      listBox.append(h('section', { class: 'price-group', 'aria-labelledby': `pg-${g.id}` },
        h('h3', { class: 'price-group-title', id: `pg-${g.id}` }, g.label), ul, more));
    });
    if (speak) announce(`Показано ${items.length} ${plural(items.length, ['позиция', 'позиции', 'позиций'])}${clsObj ? `, ${clsObj.label}` : ''}.`);
  }

  renderPriceList(false);
}

// ── «Что входит» ──
function initDetails() {
  const dialog = $('#details-dialog');
  if (!dialog) return;
  const ctl = setupDialog(dialog);

  function open(featuredId, opener) {
    const f = FEATURED.find((x) => x.id === featuredId);
    if (!f) return;
    const primary = getService(f.primary);
    const cls = priceState.cls;
    const clsObj = CAR_CLASSES.find((c) => c.id === cls);
    clear(dialog);
    const close = closeButton('Закрыть «Что входит»');
    close.addEventListener('click', () => ctl.close());
    const variants = f.related.map(getService).filter(Boolean).map((s) => {
      const pr = priceFor(s, cls);
      return h('div', { class: 'variant' },
        h('span', { class: 'variant-name' }, s.name),
        h('span', { class: 'variant-price' }, pr.text),
        h('span', { class: 'variant-short' }, s.short + (s.duration ? ` Длительность: ${s.duration}.` : '')),
        f.related.length > 1 ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', dataset: { book: '', service: s.id, class: clsObj ? cls : '' } }, 'Записаться') : null);
    });
    dialog.append(
      h('div', { class: 'dialog-head' }, h('h2', { id: 'details-title', tabindex: '-1' }, f.title), close),
      h('div', { class: 'dialog-body' },
        h('p', {}, f.result),
        h('h3', { class: 'details-sub' }, `Что входит: ${primary.name.toLowerCase()}`),
        h('ul', { class: 'details-list' }, primary.includes.map((t) => h('li', {}, t))),
        h('p', { class: 'details-meta' },
          primary.duration ? h('span', {}, 'Длительность: ', h('b', {}, primary.duration)) : null,
          h('span', {}, 'Цены: ', h('b', {}, clsObj ? clsObj.label : 'все классы, диапазон'))),
        primary.note ? h('p', { class: 'details-note' }, primary.note) : null,
        h('h3', { class: 'details-sub' }, f.related.length > 1 ? 'Варианты и цены' : 'Цена'),
        h('div', { class: 'variant-list' }, variants),
        h('p', { class: 'details-note' }, 'Цены по прайсу 1147. Итог подтверждается после осмотра автомобиля.')),
      h('div', { class: 'dialog-foot' },
        h('button', { class: 'btn btn-primary', type: 'button', dataset: { book: '', service: primary.id, class: clsObj ? cls : '' } }, `Записаться: ${f.title}`)),
    );
    ctl.open(opener);
    $('#details-title', dialog).focus({ preventScroll: true });
  }

  details = { open, ctl };
}

// ── Делегирование: «Записаться» и «Что входит» ──
function initActions() {
  document.addEventListener('click', (e) => {
    const bookEl = e.target.closest('[data-book]');
    if (bookEl && booking && details) {
      e.preventDefault();
      let opener = bookEl;
      const inDialog = bookEl.closest('dialog');
      if (inDialog && inDialog.id === 'details-dialog') {
        opener = details.ctl.opener || bookEl;
        details.ctl.opener = null;
        details.ctl.close();
      }
      booking.open({ serviceId: bookEl.dataset.service || null, classId: bookEl.dataset.class || null }, opener);
      return;
    }
    const detEl = e.target.closest('[data-details]');
    if (detEl && details) {
      e.preventDefault();
      details.open(detEl.dataset.details, detEl);
    }
  });
}

// ── До / после ──
function initBeforeAfter() {
  const frame = $('#ba-frame');
  const range = $('#ba-range');
  if (!frame || !range) return;
  const set = (v) => {
    const pos = Math.max(0, Math.min(100, Math.round(v)));
    frame.style.setProperty('--pos', `${pos}%`);
    range.value = String(pos);
    range.setAttribute('aria-valuetext', pos <= 2 ? 'Показано только «после»' : pos >= 98 ? 'Показано только «до»' : `«До» слева — ${pos}%, «после» справа — ${100 - pos}%`);
  };
  range.addEventListener('input', () => set(+range.value));
  let dragging = false;
  const fromEvent = (e) => {
    const r = frame.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  frame.addEventListener('pointerdown', (e) => {
    dragging = true;
    set(fromEvent(e));
    if (e.pointerType === 'mouse') frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', (e) => { if (dragging && (e.pointerType === 'mouse' || e.buttons)) set(fromEvent(e)); });
  const stop = () => { dragging = false; };
  frame.addEventListener('pointerup', stop);
  frame.addEventListener('pointercancel', stop);
  frame.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') stop(); });
  set(50);
}

// ── Галерея ──
function initLightbox() {
  const dialog = $('#lightbox');
  const links = $$('a[data-lightbox]');
  if (!dialog || !links.length) return;
  const ctl = setupDialog(dialog, { closeOnBackdrop: false });
  let index = 0;

  const close = closeButton('Закрыть просмотр');
  close.addEventListener('click', () => ctl.close());
  const img = h('img', { alt: '' });
  const cap = h('p', { class: 'lb-cap', id: 'lb-cap' });
  const count = h('p', { class: 'lb-count' });
  const prev = h('button', { class: 'lb-nav prev', type: 'button', 'aria-label': 'Предыдущее фото', onclick: () => show(index - 1) }, icon('i-arrow'));
  const next = h('button', { class: 'lb-nav next', type: 'button', 'aria-label': 'Следующее фото', onclick: () => show(index + 1) }, icon('i-arrow'));
  const stage = h('div', { class: 'lb-stage' }, img);
  stage.addEventListener('click', (e) => { if (e.target === stage) ctl.close(); });
  dialog.setAttribute('aria-describedby', 'lb-cap');
  dialog.append(h('div', { class: 'lb-top' }, close), stage, h('div', { class: 'lb-bar' }, prev, cap, count, next));

  function show(i) {
    index = (i + links.length) % links.length;
    const a = links[index];
    const thumb = a.querySelector('img');
    img.src = a.getAttribute('href');
    img.alt = thumb?.alt || '';
    cap.textContent = a.dataset.caption || '';
    count.textContent = `${index + 1} из ${links.length}`;
  }

  links.forEach((a, i) => a.addEventListener('click', (e) => {
    e.preventDefault();
    show(i);
    ctl.open(a);
    close.focus();
  }));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
  });
  let x0 = null;
  stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}

// ── Карта по запросу ──
function initMap() {
  const btn = $('#map-load');
  const box = $('#map-box');
  if (!btn || !box) return;
  btn.addEventListener('click', () => {
    const frame = h('iframe', {
      src: CONTACTS.mapWidgetUrl, title: `Карта: ${CONTACTS.brand}, ${CONTACTS.street}`,
      loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin', allow: 'geolocation',
    });
    clear(box).append(frame);
    announce('Карта загружается');
  });
}

function init() {
  const ok = [
    safe('bindings', applyBindings),
    safe('menu', initMenu),
    safe('booking', () => { booking = initBooking($('#booking')); }),
    safe('details', initDetails),
    safe('actions', initActions),
    safe('filters', initServiceFilters),
    safe('prices', initPrices),
    safe('before-after', initBeforeAfter),
    safe('lightbox', initLightbox),
    safe('map', initMap),
  ];
  if (ok.every(Boolean)) document.documentElement.classList.add('app-ready');
  if (location.hash && location.hash.length > 1) {
    // прямая ссылка с якорем: после перестройки прайса прокручиваем заново, без анимации
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target?.hidden) target.closest('.price-group')?.querySelector('.price-more')?.click();
    requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  }
}

init();
