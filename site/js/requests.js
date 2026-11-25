// Общий модуль хранения тестовых заявок (localStorage этого же origin).
// Используется формой записи на сайте и демо-панелью менеджера.
// Никаких сетевых запросов и персональных данных: профиль клиента всегда тестовый.

import { getService, getClass } from './data.js';

const PREFIX = 'd1147.';
const KEY = `${PREFIX}requests.v1`;
const SEEDED = `${PREFIX}seeded.v1`;
const TOKENS = `${PREFIX}tokens.v1`;

export const STATUSES = [
  { id: 'new', label: 'Новая' },
  { id: 'contacted', label: 'Связались' },
  { id: 'done', label: 'Завершена' },
];

export const TEST_PROFILE = Object.freeze({
  name: 'Тестовый клиент',
  phone: '+7 (900) 000-00-00',
  test: true,
});

export const MSK_TZ = 'Europe/Moscow';

export class StorageUnavailableError extends Error {
  constructor(cause) {
    super('Хранилище браузера недоступно');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

function storage() {
  try {
    const s = window.localStorage;
    const probe = `${PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (e) {
    throw new StorageUnavailableError(e);
  }
}

export function isStorageAvailable() {
  try {
    storage();
    return true;
  } catch {
    return false;
  }
}

// ── Дата и время по Москве ──

/** Части текущей даты/времени в Москве: { y, m, d, hh, mm, iso: 'YYYY-MM-DD' } */
export function moscowNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MSK_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = +get('year');
  const m = +get('month');
  const d = +get('day');
  return { y, m, d, hh: +get('hour'), mm: +get('minute'), iso: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Прибавить дни к дате 'YYYY-MM-DD' (календарная арифметика без часовых поясов) */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «25 ноября, ср» — по календарной дате, без перевода часовых поясов */
export function formatDay(iso, { weekday = true } = {}) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d} ${MONTHS[m - 1]}${weekday ? `, ${WEEKDAYS[wd]}` : ''}`;
}

/** Текст желаемого визита. visit: { date: 'YYYY-MM-DD'|null, time: 'HH:MM'|null } */
export function formatVisit(visit) {
  if (!visit || !visit.date) return 'Время уточнить';
  const day = formatDay(visit.date);
  return visit.time ? `${day}, ${visit.time} (МСК)` : `${day}, время уточнить`;
}

/** Время создания заявки по Москве */
export function formatCreated(isoUtc) {
  const dt = new Date(isoUtc);
  if (Number.isNaN(dt.getTime())) return '—';
  const n = moscowNow(dt);
  return `${n.d} ${MONTHS[n.m - 1]}, ${String(n.hh).padStart(2, '0')}:${String(n.mm).padStart(2, '0')}`;
}

// ── Чтение и запись ──

function readRaw(s) {
  try {
    const list = JSON.parse(s.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(isValid) : [];
  } catch {
    return [];
  }
}

function isValid(r) {
  return r && typeof r === 'object' && typeof r.id === 'string' && typeof r.serviceId === 'string'
    && STATUSES.some((st) => st.id === r.status);
}

function write(s, list) {
  s.setItem(KEY, JSON.stringify(list));
}

function nextId(list) {
  const max = list.reduce((acc, r) => Math.max(acc, parseInt(r.id, 10) || 0), 1000);
  return String(max + 1);
}

function makeVisit(date, time) {
  if (!date) return { date: null, time: null, tz: MSK_TZ, iso: null };
  return { date, time: time || null, tz: MSK_TZ, iso: time ? `${date}T${time}:00+03:00` : null };
}

function buildSeeds() {
  const today = moscowNow().iso;
  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString();
  const seed = (id, serviceId, classId, visit, status, createdAt) => ({
    id, serviceId,
    serviceName: getService(serviceId)?.name || serviceId,
    classId,
    className: getClass(classId)?.label || '—',
    visit, status, createdAt,
    updatedAt: createdAt,
    profile: { ...TEST_PROFILE },
    source: 'demo-seed',
    demo: true,
  });
  return [
    seed('1001', 'dryclean-full', 'c3', makeVisit(addDays(today, 2), '10:00'), 'new', hoursAgo(5)),
    seed('1002', 'wash-detail-complex', 'c2', makeVisit(addDays(today, 1), null), 'contacted', hoursAgo(20)),
    seed('1003', 'ceramic-2', 'c4', makeVisit(addDays(today, 4), '12:00'), 'new', hoursAgo(28)),
    seed('1004', 'tire-set', 'unknown', makeVisit(null, null), 'done', hoursAgo(52)),
  ];
}

/** Демо-заявки создаются один раз на браузер. Новые заявки сайта сохраняются. */
function ensureSeeded(s) {
  if (s.getItem(SEEDED)) return;
  const existing = readRaw(s);
  const seeds = buildSeeds().filter((sd) => !existing.some((r) => r.id === sd.id));
  write(s, [...existing, ...seeds]);
  s.setItem(SEEDED, new Date().toISOString());
}

/** Все заявки, новые сверху */
export function listRequests() {
  const s = storage();
  ensureSeeded(s);
  return readRaw(s).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || (+b.id - +a.id));
}

export function getRequest(id) {
  return listRequests().find((r) => r.id === String(id)) || null;
}

/**
 * Сохраняет тестовую заявку. token защищает от повторного сохранения одной и той же формы.
 * input: { serviceId, classId, date, time, token }
 */
export function createRequest(input) {
  const s = storage();
  ensureSeeded(s);
  const service = getService(input.serviceId);
  const cls = getClass(input.classId);
  if (!service) throw new Error('Не выбрана услуга');
  if (!cls) throw new Error('Не выбран класс автомобиля');

  let tokens = {};
  try { tokens = JSON.parse(s.getItem(TOKENS) || '{}') || {}; } catch { tokens = {}; }
  const list = readRaw(s);
  if (input.token && tokens[input.token]) {
    const already = list.find((r) => r.id === tokens[input.token]);
    if (already) return { request: already, duplicate: true };
  }

  const createdAt = new Date().toISOString();
  const request = {
    id: nextId(list),
    serviceId: service.id,
    serviceName: service.name,
    classId: cls.id,
    className: cls.label,
    visit: makeVisit(input.date || null, input.date ? input.time || null : null),
    status: 'new',
    createdAt,
    updatedAt: createdAt,
    profile: { ...TEST_PROFILE },
    source: 'site',
    demo: true,
  };
  write(s, [...list, request]);
  if (input.token) {
    tokens[input.token] = request.id;
    s.setItem(TOKENS, JSON.stringify(tokens));
  }
  // проверяем, что запись действительно легла в хранилище
  if (!readRaw(s).some((r) => r.id === request.id)) throw new StorageUnavailableError(new Error('verify failed'));
  return { request, duplicate: false };
}

export function updateStatus(id, status) {
  if (!STATUSES.some((st) => st.id === status)) throw new Error('Неизвестный статус');
  const s = storage();
  const list = readRaw(s);
  const r = list.find((x) => x.id === String(id));
  if (!r) throw new Error('Заявка не найдена');
  r.status = status;
  r.updatedAt = new Date().toISOString();
  write(s, list);
  return r;
}

/** Сбрасывает только ключи этого проекта (префикс d1147.) и заново создаёт демо-заявки */
export function resetDemo() {
  const s = storage();
  const keys = [];
  for (let i = 0; i < s.length; i += 1) {
    const k = s.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => s.removeItem(k));
  ensureSeeded(s);
}

/** Подписка на изменения из других вкладок и при возвращении на вкладку */
export function subscribe(onChange) {
  const onStorage = (e) => {
    if (e.key === null || (e.key && e.key.startsWith(PREFIX))) onChange('storage');
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange('visible');
  };
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', (e) => { if (e.persisted) onChange('pageshow'); });
  return () => {
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label || id;
}
