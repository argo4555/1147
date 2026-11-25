// Демо-панель менеджера: список тестовых заявок, фильтры, поиск, смена статуса.

import {
  STATUSES, listRequests, updateStatus, resetDemo, subscribe, isStorageAvailable,
  formatVisit, formatCreated, statusLabel,
} from './requests.js';
import { h, clear, plural, createAnnouncer, setupDialog, closeButton } from './dom.js';

const app = document.getElementById('admin-app');
const announce = createAnnouncer(document.getElementById('live'));
const wide = window.matchMedia('(min-width: 900px)');
const params = new URLSearchParams(location.search);
const highlightId = (params.get('id') || '').replace(/[^0-9]/g, '') || null;

const ui = { status: 'all', q: '' };
let requests = [];
let els = {};
let highlightDone = false;

function load() {
  requests = listRequests();
}

function filtered() {
  const q = ui.q.trim().toLowerCase().replace(/^№\s*/, '').replace(/ё/g, 'е');
  return requests.filter((r) => {
    if (ui.status !== 'all' && r.status !== ui.status) return false;
    if (!q) return true;
    const hay = `${r.id} ${r.serviceName} ${r.className}`.toLowerCase().replace(/ё/g, 'е');
    return hay.includes(q);
  });
}

function counts() {
  const c = { all: requests.length };
  STATUSES.forEach((s) => { c[s.id] = requests.filter((r) => r.status === s.id).length; });
  return c;
}

// ── Каркас ──
function buildShell() {
  clear(app);
  const notice = h('div', { class: 'admin-notice', id: 'admin-notice', role: 'status' });
  const counters = h('div', { class: 'status-filters', role: 'group', 'aria-label': 'Фильтр по статусу' });
  const search = h('input', { class: 'input', id: 'adm-q', type: 'search', placeholder: 'Например, 1005 или полировка', autocomplete: 'off', enterkeyhint: 'search' });
  search.value = ui.q;
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { ui.q = search.value; renderList(true); }, 200);
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  const resetFilters = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'adm-reset-filters', onclick: clearFilters }, 'Сбросить фильтры');
  const restore = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', id: 'adm-restore', onclick: (e) => confirmRestore(e.currentTarget) }, 'Восстановить демо-данные');
  const summary = h('p', { class: 'admin-summary', id: 'adm-summary' });
  const list = h('div', { class: 'admin-list', id: 'adm-list' });

  app.append(
    notice,
    h('section', { class: 'admin-toolbar', 'aria-label': 'Фильтры заявок' },
      counters,
      h('div', { class: 'admin-search' },
        h('label', { class: 'field-label', for: 'adm-q' }, 'Поиск по номеру заявки или услуге'),
        h('div', { class: 'admin-search-row' }, search, resetFilters))),
    h('div', { class: 'admin-listhead' }, summary, restore),
    list,
  );
  els = { notice, counters, search, resetFilters, summary, list };
}

function renderCounters() {
  const c = counts();
  clear(els.counters);
  [{ id: 'all', label: 'Все' }, ...STATUSES].forEach((s) => {
    els.counters.append(h('button', {
      class: `chip status-chip status-${s.id}`, type: 'button', 'aria-pressed': String(ui.status === s.id), dataset: { status: s.id },
      onclick: () => { ui.status = s.id; renderCounters(); renderList(true); },
    }, s.label, h('span', { class: 'count' }, ` ${c[s.id]}`)));
  });
}

function statusSelect(r) {
  const id = `st-${r.id}`;
  const sel = h('select', { class: 'select status-select', id, dataset: { id: r.id, status: r.status } },
    STATUSES.map((s) => h('option', { value: s.id, selected: s.id === r.status }, s.label)));
  sel.addEventListener('change', () => changeStatus(r.id, sel.value));
  return [h('label', { class: 'visually-hidden', for: id }, `Статус заявки № ${r.id}`), sel];
}

function sourceTag(r) {
  return r.source === 'site'
    ? h('span', { class: 'tag tag-site' }, 'с сайта')
    : h('span', { class: 'tag' }, 'демо');
}

function renderTable(items) {
  return h('table', { class: 'admin-table' },
    h('caption', { class: 'visually-hidden' }, 'Тестовые заявки'),
    h('thead', {}, h('tr', {},
      ['№', 'Создана (МСК)', 'Услуга', 'Класс авто', 'Желаемый визит', 'Клиент', 'Статус'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, items.map((r) => h('tr', { id: `req-${r.id}`, class: r.id === highlightId ? 'is-highlight' : false, dataset: { status: r.status } },
      h('th', { scope: 'row' }, h('span', { class: 'req-id' }, `№ ${r.id}`), sourceTag(r)),
      h('td', {}, formatCreated(r.createdAt)),
      h('td', { class: 'req-service' }, r.serviceName),
      h('td', {}, r.className),
      h('td', {}, formatVisit(r.visit)),
      h('td', { class: 'req-client' }, r.profile?.name || '—', h('br'), h('span', { class: 'muted' }, r.profile?.phone || '')),
      h('td', {}, statusSelect(r))))));
}

function renderCards(items) {
  return h('ul', { class: 'admin-cards' }, items.map((r) => h('li', { id: `req-${r.id}`, class: `admin-card${r.id === highlightId ? ' is-highlight' : ''}`, dataset: { status: r.status } },
    h('article', { 'aria-labelledby': `rq-${r.id}` },
      h('div', { class: 'admin-card-head' },
        h('h2', { class: 'req-id', id: `rq-${r.id}` }, `№ ${r.id}`), sourceTag(r),
        h('span', { class: `status-dot status-${r.status}` }, statusLabel(r.status))),
      h('p', { class: 'req-service' }, r.serviceName),
      h('dl', { class: 'admin-dl' },
        h('div', {}, h('dt', {}, 'Класс авто'), h('dd', {}, r.className)),
        h('div', {}, h('dt', {}, 'Желаемый визит'), h('dd', {}, formatVisit(r.visit))),
        h('div', {}, h('dt', {}, 'Создана'), h('dd', {}, formatCreated(r.createdAt))),
        h('div', {}, h('dt', {}, 'Клиент'), h('dd', {}, `${r.profile?.name || '—'}, ${r.profile?.phone || ''}`))),
      h('div', { class: 'admin-card-status' }, h('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Статус'), statusSelect(r))))));
}

function renderList(speak = false) {
  const items = filtered();
  const active = ui.status !== 'all' || ui.q.trim() !== '';
  els.resetFilters.hidden = !active;
  els.summary.textContent = `${items.length} ${plural(items.length, ['заявка', 'заявки', 'заявок'])}${active ? ' по фильтру' : ''} · всего ${requests.length}`;
  clear(els.list);
  if (!items.length) {
    els.list.append(h('div', { class: 'admin-empty' },
      h('p', {}, requests.length ? 'Нет заявок по выбранным условиям.' : 'Заявок пока нет.'),
      requests.length
        ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: clearFilters }, 'Сбросить фильтры')
        : h('a', { class: 'btn btn-primary', href: '../#services' }, 'Создать заявку на сайте')));
    if (speak) announce(requests.length ? 'Нет заявок по выбранным условиям' : 'Заявок пока нет');
    return;
  }
  els.list.append(wide.matches ? renderTable(items) : renderCards(items));
  if (speak) announce(`Показано ${items.length} ${plural(items.length, ['заявка', 'заявки', 'заявок'])}`);
}

function clearFilters() {
  ui.status = 'all';
  ui.q = '';
  els.search.value = '';
  renderCounters();
  renderList(true);
  els.search.focus();
}

function changeStatus(id, status) {
  try {
    updateStatus(id, status);
  } catch (e) {
    showNotice(`Не удалось сохранить статус: ${e.message}`, 'error');
    return;
  }
  load();
  renderCounters();
  renderList(false);
  const sel = document.getElementById(`st-${id}`);
  if (sel) {
    sel.focus();
    announce(`Статус заявки № ${id}: ${statusLabel(status)}`);
  } else {
    els.summary.setAttribute('tabindex', '-1');
    els.summary.focus();
    announce(`Статус заявки № ${id}: ${statusLabel(status)}. Заявка скрыта текущим фильтром.`);
  }
}

function showNotice(text, kind = 'info') {
  clear(els.notice);
  els.notice.className = `admin-notice is-${kind}`;
  if (text) els.notice.append(text);
}

// ── Восстановление демо-данных ──
function confirmRestore(opener) {
  const dialog = document.getElementById('reset-dialog');
  const ctl = dialog._ctl || (dialog._ctl = setupDialog(dialog));
  clear(dialog);
  const close = closeButton('Отмена');
  close.addEventListener('click', () => ctl.close());
  const cancel = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => ctl.close() }, 'Отмена');
  const ok = h('button', { class: 'btn btn-primary', type: 'button', id: 'reset-confirm', onclick: () => {
    try {
      resetDemo();
    } catch (e) {
      ctl.close();
      showNotice('Хранилище браузера недоступно — восстановить данные не получилось.', 'error');
      return;
    }
    load();
    ui.status = 'all'; ui.q = ''; els.search.value = '';
    renderCounters();
    renderList(false);
    ctl.close();
    showNotice('Демо-данные восстановлены: 4 демонстрационные заявки, тестовые заявки с сайта удалены.', 'info');
    announce('Демо-данные восстановлены');
  } }, 'Восстановить');
  dialog.append(
    h('div', { class: 'dialog-head' }, h('h2', { id: 'reset-title', tabindex: '-1' }, 'Восстановить демо-данные?'), close),
    h('div', { class: 'dialog-body' },
      h('p', { id: 'reset-desc' }, 'Тестовые заявки, созданные на сайте в этом браузере, и все изменения статусов будут удалены. Вернутся 4 исходные демонстрационные заявки.'),
      h('p', { class: 'muted', style: false }, 'Затрагиваются только данные этого демо (ключи d1147.* в localStorage). Другие сайты и данные браузера не меняются.')),
    h('div', { class: 'dialog-foot' }, cancel, ok),
  );
  ctl.open(opener);
  cancel.focus();
}

function focusHighlight() {
  if (highlightDone || !highlightId) return;
  highlightDone = true;
  const r = requests.find((x) => x.id === highlightId);
  if (!r) {
    showNotice(`Заявка № ${highlightId} не найдена в этом браузере. Возможно, она создана на другом устройстве или данные были сброшены.`, 'error');
    return;
  }
  showNotice(`Открыта заявка № ${r.id}: ${r.serviceName}. Она выделена в списке.`, 'info');
  const row = document.getElementById(`req-${r.id}`);
  if (row) {
    row.scrollIntoView({ block: 'center', behavior: 'auto' });
    document.getElementById(`st-${r.id}`)?.focus({ preventScroll: true });
  }
}

function start() {
  if (!isStorageAvailable()) {
    clear(app).append(h('div', { class: 'admin-alert', role: 'alert' },
      'Хранилище браузера недоступно (например, приватный режим или запрет cookies), поэтому демо-заявки показать нельзя. Откройте панель в обычном режиме браузера.'));
    return;
  }
  load();
  buildShell();
  renderCounters();
  renderList(false);
  focusHighlight();

  wide.addEventListener('change', () => renderList(false));
  subscribe((why) => {
    const before = requests.length;
    const focusedId = document.activeElement?.id;
    load();
    renderCounters();
    renderList(false);
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
    if (why === 'storage' && requests.length > before) {
      announce(`Новая заявка: № ${requests[0].id}`);
      showNotice(`Появилась новая заявка № ${requests[0].id} — она наверху списка.`, 'info');
    }
  });
}

start();
