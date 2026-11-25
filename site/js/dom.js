// Небольшие DOM-помощники. Текст всегда выводится через textContent — без innerHTML для данных.

/**
 * h('button', { class: 'btn', type: 'button', onclick: fn, dataset: { id: 1 } }, 'Текст', child)
 * Атрибуты со значением false/null/undefined пропускаются.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Иконка из SVG-спрайта на странице */
export function icon(name, cls = 'icon') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Русская множественная форма: plural(5, ['позиция', 'позиции', 'позиций']) */
export function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** Объявление для скринридера без дублирования: одна живая область, текст обновляется */
export function createAnnouncer(region) {
  let timer;
  return (text) => {
    if (!region) return;
    clearTimeout(timer);
    region.textContent = '';
    timer = setTimeout(() => { region.textContent = text; }, 60);
  };
}

/**
 * Модальный диалог на <dialog>: фокус остаётся внутри, Escape закрывает,
 * после закрытия фокус возвращается на кнопку, которая его открыла.
 */
export function setupDialog(dialog, { closeOnBackdrop = true, onClose } = {}) {
  let opener = null;
  dialog.addEventListener('close', () => {
    // другое окно могло открыться раньше, чем пришло событие закрытия этого
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('dialog-open');
    onClose?.();
    const back = opener;
    opener = null;
    if (back && back.isConnected && typeof back.focus === 'function') {
      // фокус после того, как браузер закончит закрытие
      requestAnimationFrame(() => back.focus({ preventScroll: true }));
    }
  });
  // Tab и Shift+Tab по кругу внутри окна — фокус не уходит в адресную строку и на страницу
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    // у группы радиокнопок в порядке Tab участвует только выбранная (или первая)
    const tabbable = items.filter((el) => {
      if (el.type !== 'radio') return true;
      const group = items.filter((x) => x.type === 'radio' && x.name === el.name);
      const checked = group.find((x) => x.checked);
      return checked ? el === checked : el === group[0];
    });
    if (!tabbable.length) return;
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    const active = document.activeElement;
    const inside = dialog.contains(active);
    if (e.shiftKey && (active === first || !inside || active === dialog || active?.id === dialog.getAttribute('aria-labelledby'))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  });
  if (closeOnBackdrop) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
  return {
    open(from) {
      opener = from || document.activeElement;
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('dialog-open');
    },
    close() { if (dialog.open) dialog.close(); },
    get opener() { return opener; },
    set opener(v) { opener = v; },
  };
}

export function closeButton(label = 'Закрыть') {
  return h('button', { class: 'dialog-close', type: 'button', 'aria-label': label, value: 'close', dataset: { close: '' } }, icon('i-close'));
}
