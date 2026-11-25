// Обновляет статичные блоки site/index.html из единого источника site/js/data.js.
// Это не сборка сайта: результат уже лежит в репозитории, скрипт нужен только после правки данных.
//
//   node tools/render-static.mjs          — перезаписать блоки
//   node tools/render-static.mjs --check  — проверить, что HTML совпадает с данными (код выхода 1, если нет)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'site', 'index.html');
const data = await import(pathToFileURL(path.join(root, 'site', 'js', 'data.js')).href);
const { CONTACTS, CAR_CLASSES, GROUPS, SERVICES, FEATURED, getService, priceFor, cardPrice, rub } = data;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

function cardsHtml() {
  return FEATURED.map((f) => {
    const s = getService(f.primary);
    const group = GROUPS.find((g) => g.id === f.group);
    const priceNote = s.pricing.type === 'class' ? 'зависит от класса авто' : (s.pricing.basis || '');
    return `<li class="card" data-group="${f.group}" data-featured="${f.id}">
  <article class="card-inner" aria-labelledby="card-${f.id}">
    <div class="card-media">
      <img src="assets/img/${f.image}-480.webp" srcset="assets/img/${f.image}-480.webp 480w, assets/img/${f.image}-800.webp 800w" sizes="(min-width: 1100px) 380px, (min-width: 700px) 46vw, 100vw" width="800" height="600" loading="lazy" decoding="async" alt="${esc(f.alt)}">
      <span class="photo-note">Иллюстрация</span>
    </div>
    <div class="card-body">
      <p class="card-group">${esc(group.label)}</p>
      <h3 class="card-title" id="card-${f.id}">${esc(f.title)}</h3>
      <p class="card-result">${esc(f.result)}</p>
      <p class="card-price"><span class="price-tag" data-card-price="${f.id}">${esc(cardPrice(f))}</span><span class="card-price-note">${esc(priceNote)}</span></p>
      <div class="card-actions">
        <a class="btn btn-ghost" href="#price-${s.id}" data-details="${f.id}">Что входит</a>
        <a class="btn btn-primary" href="#contacts" data-book data-service="${s.id}">Записаться</a>
      </div>
    </div>
  </article>
</li>`;
  }).join('\n');
}

function bandHtml() {
  const f = FEATURED.find((x) => x.id === 'complex');
  const s = getService(f.primary);
  return `<p class="eyebrow">Полный комплекс</p>
<h2 id="band-title">${esc(f.title)}</h2>
<p class="band-text">${esc(s.includes.map((t, i) => (i ? t.charAt(0).toLowerCase() + t.slice(1) : t)).join(', '))}. Работа занимает ${esc(s.duration)}.</p>
<p class="band-price"><span class="price-tag" data-card-price="${f.id}">${esc(cardPrice(f))}</span><span class="card-price-note">зависит от класса авто</span></p>
<div class="band-actions">
  <a class="btn btn-primary" href="#contacts" data-book data-service="${s.id}">Записаться</a>
  <a class="btn btn-ghost" href="#price-${s.id}" data-details="${f.id}">Что входит</a>
</div>`;
}

function classesHtml() {
  const items = CAR_CLASSES.map((c) => `  <li><strong>${esc(c.label)}</strong> — ${esc(c.hint.toLowerCase())}</li>`).join('\n');
  return `<details class="class-legend" open>
<summary>Классы автомобилей</summary>
<ul>
${items}
</ul>
</details>`;
}

function priceValueStatic(s) {
  const p = s.pricing;
  if (p.type === 'class') return priceFor(s, 'all').text + (s.from ? ' (цена «от»)' : '');
  if (p.type === 'variants') return p.variants.map((v) => `${v.label}: ${rub(v.price)}`).join(' · ');
  return priceFor(s, 'all').text;
}

function pricesHtml() {
  return GROUPS.map((g) => {
    const rows = SERVICES.filter((s) => s.group === g.id).map((s) => {
      let extra = '';
      if (s.pricing.type === 'table') {
        const head = s.pricing.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('');
        const body = s.pricing.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.price.map((v) => `<td>${rub(v)}</td>`).join('')}</tr>`).join('');
        extra = `\n    <details class="price-table"><summary>Цены по радиусу</summary><table><thead><tr><th scope="col">Радиус</th>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
      }
      return `  <li class="price-row" id="price-${s.id}">
    <div class="price-main"><h4 class="price-name">${esc(s.name)}</h4><p class="price-short">${esc(s.short)}</p></div>
    <p class="price-value">${esc(priceValueStatic(s))}</p>${extra}
  </li>`;
    }).join('\n');
    return `<section class="price-group" aria-labelledby="pg-${g.id}">
<h3 class="price-group-title" id="pg-${g.id}">${esc(g.label)}</h3>
<ul class="price-rows">
${rows}
</ul>
</section>`;
  }).join('\n');
}

function replaceBlock(html, name, content, pad) {
  const re = new RegExp(`(<!-- data:${name}:start -->)[\\s\\S]*?(\\n\\s*<!-- data:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`Нет маркеров блока ${name}`);
  return html.replace(re, (_, a, b) => `${a}\n${indent(content, pad)}${b}`);
}

function applyBindings(html) {
  // текст: <tag ... data-bind="key" ...>ТЕКСТ</tag> (без вложенных тегов)
  html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-bind="([a-zA-Z]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, text, close) => {
    if (!(key in CONTACTS)) throw new Error(`Неизвестный ключ data-bind="${key}"`);
    return `${open}${esc(CONTACTS[key])}${close}`;
  });
  // ссылки: href="..." в теге с data-bind-href="key"
  html = html.replace(/<a\b[^>]*\bdata-bind-href="([a-zA-Z]+)"[^>]*>/g, (tag, key) => {
    if (!(key in CONTACTS)) throw new Error(`Неизвестный ключ data-bind-href="${key}"`);
    return tag.replace(/href="[^"]*"/, `href="${esc(CONTACTS[key])}"`);
  });
  return html;
}

const before = await readFile(htmlPath, 'utf8');
let html = before;
html = replaceBlock(html, 'cards', cardsHtml(), 10);
html = replaceBlock(html, 'band', bandHtml(), 8);
html = replaceBlock(html, 'classes', classesHtml(), 10);
html = replaceBlock(html, 'prices', pricesHtml(), 12);
html = applyBindings(html);

if (process.argv.includes('--check')) {
  if (html !== before) {
    console.error('site/index.html расходится с site/js/data.js — запустите: node tools/render-static.mjs');
    process.exit(1);
  }
  console.log('OK: статичный HTML совпадает с данными');
} else {
  await writeFile(htmlPath, html, 'utf8');
  console.log(html === before ? 'Без изменений' : 'site/index.html обновлён из data.js');
}
