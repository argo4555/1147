// Быстрая запись: два шага и итог. Сохраняет только тестовую заявку в localStorage.

import { CAR_CLASSES, UNKNOWN_CLASS, GROUPS, SERVICES, CONSULTATION, CONTACTS, getService, getClass, priceFor } from './data.js';
import { createRequest, StorageUnavailableError, TEST_PROFILE, moscowNow, addDays, formatVisit } from './requests.js';
import { h, clear, closeButton, setupDialog, createAnnouncer } from './dom.js';

const TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function dayLabel(iso, i) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const date = `${d} ${MONTHS_SHORT[m - 1]}`;
  if (i === 0) return `Сегодня, ${date}`;
  if (i === 1) return `Завтра, ${date}`;
  return `${wd}, ${date}`;
}

function newToken() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function initBooking(dialog) {
  const state = {
    step: 1, group: null, serviceId: null, classId: null, date: null, time: null,
    token: null, saving: false, done: null, errors: {}, expanded: false,
  };
  const ctl = setupDialog(dialog, { closeOnBackdrop: true });
  let live;
  let announce = () => {};

  function reset() {
    Object.assign(state, { step: 1, group: null, serviceId: null, classId: null, date: null, time: null, token: null, saving: false, done: null, errors: {}, expanded: false });
  }

  function open(prefill = {}, opener) {
    if (state.done) reset();
    if (prefill.serviceId) {
      const s = getService(prefill.serviceId);
      if (s) {
        state.serviceId = s.id;
        state.group = s.id === CONSULTATION.id ? 'consult' : s.group;
        state.expanded = false;
      }
    }
    if (prefill.classId && getClass(prefill.classId)) state.classId = prefill.classId;
    state.step = 1;
    state.errors = {};
    render();
    ctl.open(opener);
    focusTitle();
  }

  function focusTitle() {
    const t = dialog.querySelector('#booking-title');
    if (t) t.focus({ preventScroll: true });
  }

  // ── каркас окна ──
  function frame(title, stepText, body, foot) {
    clear(dialog);
    live = h('div', { class: 'visually-hidden', 'aria-live': 'polite', 'aria-atomic': 'true' });
    announce = createAnnouncer(live);
    const close = closeButton('Закрыть запись');
    close.addEventListener('click', () => ctl.close());
    dialog.append(
      h('div', { class: 'dialog-head' },
        h('div', {},
          h('h2', { id: 'booking-title', tabindex: '-1' }, title),
          stepText ? h('p', { class: 'dialog-step' }, stepText) : null),
        close),
      h('div', { class: 'dialog-body' }, body),
      foot ? h('div', { class: 'dialog-foot' }, foot) : null,
      live,
    );
  }

  function render() {
    if (state.done) return renderSuccess();
    if (state.step === 2) return renderStep2();
    return renderStep1();
  }

  // ── Шаг 1: услуга, класс, время ──
  function renderStep1() {
    const body = h('div', {},
      h('p', { class: 'dialog-mode' }, 'Демо-режим: заявка сохранится только в этом браузере.'),
      groupField(),
      serviceField(),
      classField(),
      whenField(),
    );
    const next = h('button', { class: 'btn btn-primary', type: 'button', onclick: goStep2 }, 'Далее');
    frame('Запись', 'Шаг 1 из 2', body, [next]);
  }

  function fieldset(id, legend, content, { optional = false } = {}) {
    const err = state.errors[id];
    return h('fieldset', { class: 'bk-section', id: `bk-${id}`, 'aria-invalid': err ? 'true' : false, 'aria-describedby': err ? `bk-${id}-err` : false },
      h('legend', {}, legend, optional ? h('span', { class: 'opt' }, ' — необязательно') : null),
      content,
      h('p', { class: 'bk-error', id: `bk-${id}-err` }, err || ''));
  }

  function radioChip(name, value, label, checked, { disabled = false, onchange } = {}) {
    return h('label', { class: 'chip' },
      h('input', { type: 'radio', name, value, checked, disabled, onchange }),
      label);
  }

  function groupField() {
    const opts = [...GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: 'consult', label: CONSULTATION.name }];
    const chips = h('div', { class: 'chips' }, opts.map((o) => radioChip('bk-group', o.id, o.label, state.group === o.id, {
      onchange: () => {
        state.group = o.id;
        state.expanded = true;
        if (o.id === 'consult') state.serviceId = CONSULTATION.id;
        else if (getService(state.serviceId)?.group !== o.id) state.serviceId = null;
        delete state.errors.group;
        refreshSection('service', serviceField);
        refreshSection('group', groupField, `input[value="${o.id}"]`);
      },
    })));
    return fieldset('group', 'Что нужно', chips);
  }

  function serviceOption(s) {
    const pr = priceFor(s, state.classId && state.classId !== UNKNOWN_CLASS.id ? state.classId : (state.classId ? 'unknown' : 'all'));
    return h('label', { class: 'option' },
      h('input', { type: 'radio', name: 'bk-service', value: s.id, checked: state.serviceId === s.id,
        onchange: () => { state.serviceId = s.id; delete state.errors.service; clearError('service'); } }),
      h('span', { class: 'option-main' }, h('span', { class: 'option-title' }, s.name), h('span', { class: 'option-sub' }, s.short)),
      h('span', { class: `option-price${pr.kind === 'ask' ? ' is-ask' : ''}`, dataset: { priceOf: s.id } }, pr.text));
  }

  function serviceField() {
    if (!state.group) {
      return h('div', { class: 'bk-section', id: 'bk-service' }, h('p', { class: 'bk-hint' }, 'Выберите направление — появится список услуг с ценами.'));
    }
    if (state.group === 'consult') {
      return h('div', { class: 'bk-section', id: 'bk-service' },
        h('p', { class: 'bk-hint' }, 'Подберём услугу и назовём стоимость после разговора. Стоимость: уточнить.'));
    }
    const chosen = getService(state.serviceId);
    if (chosen && chosen.group === state.group && !state.expanded) {
      // услуга пришла с карточки или из прайса — показываем только её, список по кнопке
      const more = h('button', { class: 'btn-link', type: 'button', onclick: () => {
        state.expanded = true;
        refreshSection('service', serviceField, 'input[name="bk-service"]:checked');
      } }, 'Выбрать другую услугу');
      return fieldset('service', 'Услуга', h('div', { class: 'option-list' }, serviceOption(chosen), more));
    }
    const list = SERVICES.filter((s) => s.group === state.group);
    return fieldset('service', 'Услуга', h('div', { class: 'option-list' }, list.map(serviceOption)));
  }

  function classField() {
    const all = [...CAR_CLASSES, UNKNOWN_CLASS];
    const grid = h('div', { class: 'option-grid' }, all.map((c) => h('label', { class: 'option' },
      h('input', { type: 'radio', name: 'bk-class', value: c.id, checked: state.classId === c.id,
        onchange: () => { state.classId = c.id; delete state.errors.class; clearError('class'); updatePrices(); } }),
      h('span', { class: 'option-main' }, h('span', { class: 'option-title' }, c.label), h('span', { class: 'option-sub' }, c.hint)),
      h('span'))));
    return fieldset('class', 'Класс автомобиля', grid);
  }

  function whenField() {
    const today = moscowNow();
    const days = Array.from({ length: 7 }, (_, i) => addDays(today.iso, i));
    const dayChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': 'bk-day-label' },
      radioChip('bk-day', '', 'Уточнить время', !state.date, { onchange: () => { state.date = null; state.time = null; updateTimes(); } }),
      days.map((iso, i) => radioChip('bk-day', iso, dayLabel(iso, i), state.date === iso, {
        onchange: () => { state.date = iso; updateTimes(); },
      })));
    const content = h('div', {},
      h('p', { class: 'field-label', id: 'bk-day-label' }, 'День (по Москве)'),
      dayChips,
      h('p', { class: 'field-label field-label-gap', id: 'bk-time-label' }, 'Желаемое время'),
      h('div', { role: 'radiogroup', 'aria-labelledby': 'bk-time-label', id: 'bk-times' }, timeChips()),
      h('p', { class: 'bk-hint', id: 'bk-when-hint' }, 'Это пожелание, а не бронирование. Свободное время подтверждается отдельно.'));
    return fieldset('when', 'Когда удобно', content, { optional: true });
  }

  function timeChips() {
    const now = moscowNow();
    const isToday = state.date === now.iso;
    const wrap = h('div', { class: 'chips' });
    wrap.append(radioChip('bk-time', '', state.date ? 'Время уточнить' : 'Сначала выберите день', !state.time, {
      disabled: !state.date, onchange: () => { state.time = null; },
    }));
    TIMES.forEach((t) => {
      const hh = parseInt(t, 10);
      const past = isToday && hh <= now.hh;
      wrap.append(radioChip('bk-time', t, t, state.time === t, { disabled: !state.date || past, onchange: () => { state.time = t; } }));
    });
    return wrap;
  }

  function updateTimes() {
    const now = moscowNow();
    if (state.date === now.iso && state.time && parseInt(state.time, 10) <= now.hh) state.time = null;
    if (!state.date) state.time = null;
    const box = dialog.querySelector('#bk-times');
    if (box) { clear(box); box.append(timeChips()); }
  }

  function updatePrices() {
    dialog.querySelectorAll('[data-price-of]').forEach((el) => {
      const s = getService(el.dataset.priceOf);
      const cls = state.classId && state.classId !== UNKNOWN_CLASS.id ? state.classId : (state.classId ? 'unknown' : 'all');
      const pr = priceFor(s, cls);
      el.textContent = pr.text;
      el.classList.toggle('is-ask', pr.kind === 'ask');
    });
  }

  function refreshSection(id, builder, focusSelector) {
    const old = dialog.querySelector(`#bk-${id}`);
    if (!old) return;
    const fresh = builder();
    old.replaceWith(fresh);
    if (focusSelector) fresh.querySelector(focusSelector)?.focus();
  }

  function clearError(id) {
    const fs = dialog.querySelector(`#bk-${id}`);
    if (!fs) return;
    fs.removeAttribute('aria-invalid');
    fs.removeAttribute('aria-describedby');
    const e = fs.querySelector('.bk-error');
    if (e) e.textContent = '';
  }

  function validate() {
    const errors = {};
    if (!state.group) errors.group = 'Выберите направление или «Нужна консультация».';
    else if (state.group !== 'consult' && !state.serviceId) errors.service = 'Выберите услугу.';
    if (!state.classId) errors.class = 'Выберите класс автомобиля или «Не знаю класс».';
    return errors;
  }

  function goStep2() {
    state.errors = validate();
    const keys = Object.keys(state.errors);
    if (keys.length) {
      const scroll = dialog.querySelector('.dialog-body')?.scrollTop || 0;
      renderStep1();
      const body = dialog.querySelector('.dialog-body');
      if (body) body.scrollTop = scroll;
      const first = dialog.querySelector(`#bk-${keys[0]}`);
      first?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      first?.querySelector('input:not([disabled])')?.focus({ preventScroll: true });
      announce(`Проверьте форму: ${Object.values(state.errors).join(' ')}`);
      return;
    }
    state.step = 2;
    state.token = newToken();
    render();
    focusTitle();
  }

  // ── Шаг 2: проверка и тестовый профиль ──
  function summaryList(service, cls, { withPrice = true, withDuration = true } = {}) {
    const clsId = cls?.id === UNKNOWN_CLASS.id ? 'unknown' : cls?.id;
    const pr = priceFor(service, clsId);
    const rows = [
      ['Услуга', service.name],
      ['Класс автомобиля', cls ? `${cls.label}${cls.id !== UNKNOWN_CLASS.id ? ` · ${cls.hint.toLowerCase()}` : ''}` : '—'],
    ];
    if (withPrice) rows.push(['Стоимость по прайсу', pr.text + (pr.note ? `, ${pr.note}` : '')]);
    if (withDuration) rows.push(['Длительность', service.duration ? `${service.duration}, ориентировочно` : 'Уточняется при подтверждении']);
    rows.push(['Желаемый визит', formatVisit({ date: state.date, time: state.time })]);
    return h('dl', { class: 'summary' }, rows.map(([k, v]) => h('div', {},
      h('dt', {}, k), h('dd', { class: k === 'Стоимость по прайсу' && pr.kind !== 'ask' ? 'price' : false }, v))));
  }

  function renderStep2() {
    const service = getService(state.serviceId) || CONSULTATION;
    const cls = getClass(state.classId);
    const alert = h('div', { class: 'bk-alert', id: 'bk-alert' });
    const body = h('div', {},
      summaryList(service, cls),
      h('section', { class: 'test-profile', 'aria-labelledby': 'tp-title' },
        h('h3', { id: 'tp-title' }, 'Контакт для демо'),
        h('p', { class: 'muted' }, 'Ваш телефон не нужен: в демо используется тестовый профиль.'),
        h('div', { class: 'field' },
          h('label', { class: 'field-label', for: 'tp-name' }, 'Имя (тестовое)'),
          h('input', { class: 'input', id: 'tp-name', type: 'text', value: TEST_PROFILE.name, readonly: true })),
        h('div', { class: 'field' },
          h('label', { class: 'field-label', for: 'tp-phone' }, 'Телефон — пример ввода, только для чтения'),
          h('input', { class: 'input', id: 'tp-phone', type: 'tel', value: TEST_PROFILE.phone, readonly: true, inputmode: 'tel' }))),
      h('p', { class: 'demo-note' }, 'Демо · заявка сохранится в этом браузере'),
      alert,
    );
    const back = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { state.step = 1; render(); focusTitle(); } }, 'Назад');
    const submit = h('button', { class: 'btn btn-primary', type: 'button', id: 'bk-submit', onclick: () => submitRequest(submit, alert) }, 'Создать тестовую заявку');
    frame('Проверьте заявку', 'Шаг 2 из 2', body, [back, submit]);
  }

  function submitRequest(btn, alertBox) {
    if (state.saving || state.done) return;
    state.saving = true;
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    clear(alertBox);
    try {
      const { request } = createRequest({
        serviceId: state.serviceId, classId: state.classId, date: state.date, time: state.time, token: state.token,
      });
      state.done = request;
      state.saving = false;
      renderSuccess();
      focusTitle();
      announce(`Тестовая заявка номер ${request.id} сохранена в этом браузере.`);
    } catch (e) {
      state.saving = false;
      btn.disabled = false;
      btn.textContent = 'Создать тестовую заявку';
      const tel = h('a', { href: CONTACTS.phoneHref }, CONTACTS.phone);
      if (e instanceof StorageUnavailableError) {
        alertBox.append('Не удалось сохранить тестовую заявку: браузер запрещает хранение данных (например, в приватном режиме или при блокировке cookies). Откройте сайт в обычном режиме или позвоните: ', tel, '.');
      } else {
        alertBox.append('Не удалось сохранить тестовую заявку. Попробуйте ещё раз или позвоните: ', tel, '.');
      }
      announce(alertBox.textContent);
      console.error(e);
    }
  }

  // ── Итог ──
  function renderSuccess() {
    const r = state.done;
    const service = getService(r.serviceId) || CONSULTATION;
    const cls = getClass(r.classId);
    const body = h('div', { class: 'success' },
      h('span', { class: 'success-mark', 'aria-hidden': 'true' }),
      h('h3', {}, 'Тестовая заявка сохранена'),
      h('p', { class: 'success-id' }, `№ ${r.id}`),
      summaryList(service, cls, { withPrice: false, withDuration: false }),
      h('p', { class: 'muted' }, 'Это демонстрация: время не забронировано, заявка никуда не отправлена. Её можно открыть в демо-панели менеджера в этом же браузере.'),
    );
    const toAdmin = h('a', { class: 'btn btn-primary', href: `admin/?id=${encodeURIComponent(r.id)}` }, 'Открыть в демо-панели');
    const toServices = h('button', { class: 'btn btn-ghost', type: 'button', onclick: backToServices }, 'Вернуться к услугам');
    frame('Готово', null, body, [h('div', { class: 'success-actions' }, toAdmin, toServices)]);
  }

  function backToServices() {
    const target = document.getElementById('services');
    const heading = document.getElementById('services-title');
    ctl.opener = null;
    ctl.close();
    if (target) {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    }
  }

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[type="radio"]') && state.step === 1 && !state.done) {
      e.preventDefault();
      goStep2();
    }
  });

  return { open, state };
}
