// Единый источник данных: контакты, классы авто, услуги, цены, витрина.
// Цены перенесены из прайса на 1147detailing.ru (страница «Прайс», проверено 25.11.2026).
// После правки запустите `node tools/render-static.mjs`, чтобы обновить HTML для работы без JavaScript.

export const CONTACTS = {
  brand: '1147 Detailing',
  phone: '+7 (936) 777-11-47',
  phoneHref: 'tel:+79367771147',
  telegram: 'https://t.me/+79367771147',
  telegramLabel: 'Telegram',
  city: 'Москва',
  street: 'Маломосковская ул., 14',
  address: 'Москва, Маломосковская ул., 14',
  floor: 'паркинг, −1 этаж',
  hours: 'Круглосуточно',
  hoursNote: 'Каждый день, 24 часа',
  coords: [55.812381, 37.648965],
  orgUrl: 'https://yandex.ru/maps/org/deteyling_1147/181605289694/',
  reviewsUrl: 'https://yandex.ru/maps/org/deteyling_1147/181605289694/reviews/',
  routeUrl: 'https://yandex.ru/maps/?rtext=~55.812381%2C37.648965&rtt=auto&ruri=~ymapsbm1%3A%2F%2Forg%3Foid%3D181605289694',
  mapWidgetUrl: 'https://yandex.ru/map-widget/v1/?ll=37.648965%2C55.812381&z=16&oid=181605289694&ol=biz',
  site: 'https://1147detailing.ru/',
};

export const SOURCES = [
  { label: 'Сайт 1147 Detailing', url: 'https://1147detailing.ru/' },
  { label: 'Прайс 1147 Detailing', url: 'https://1147detailing.ru/page146428676.html' },
  { label: 'Карточка в Яндекс Картах', url: 'https://yandex.ru/maps/org/deteyling_1147/181605289694/' },
];

// Классы автомобилей — по прайсу 1147. 5 класс (крупные внедорожники, микроавтобусы) центр не обслуживает — убран по решению заказчика.
export const CAR_CLASSES = [
  { id: 'c1', label: '1 класс', hint: 'Малые легковые' },
  { id: 'c2', label: '2 класс', hint: 'Седаны и хэтчбеки среднего класса' },
  { id: 'c3', label: '3 класс', hint: 'Универсалы, компактные кроссоверы' },
  { id: 'c4', label: '4 класс', hint: 'Крупные кроссоверы, внедорожники' },
];
export const UNKNOWN_CLASS = { id: 'unknown', label: 'Не знаю класс', hint: 'Подскажем при подтверждении' };

export const GROUPS = [
  { id: 'wash', label: 'Мойка' },
  { id: 'body', label: 'Кузов' },
  { id: 'interior', label: 'Салон' },
  { id: 'tires', label: 'Шины' },
];

export const CONSULTATION = {
  id: 'consult',
  group: null,
  name: 'Нужна консультация',
  short: 'Поможем выбрать услугу и назовём стоимость для вашего автомобиля.',
  pricing: { type: 'ask' },
};

// pricing.type:
//   class    — цены по классам 1–4 (prices[0] = 1 класс)
//   variants — цена зависит не от класса, а от другого признака (basis)
//   table    — таблица по радиусу (шиномонтаж)
//   flat     — одна цена для всех
//   ask      — стоимость уточняется
// from: true — в прайсе указана цена «от»
export const SERVICES = [
  // ── Мойка ──────────────────────────────────────────────
  {
    id: 'wash-express', group: 'wash', name: 'Экспресс-мойка',
    short: 'Техническая мойка кузова без сушки.',
    includes: ['Мойка кузова', 'Без сушки'],
    duration: null,
    pricing: { type: 'class', prices: [850, 950, 1100, 1300] },
  },
  {
    id: 'wash-body', group: 'wash', name: 'Мойка кузова и ковриков',
    short: 'Двухфазная мойка, коврики, чернение резины.',
    includes: ['Двухфазная мойка кузова', 'Мойка ковриков', 'Чернение резины'],
    duration: '~45 мин',
    pricing: { type: 'class', prices: [1500, 1600, 1800, 2200] },
  },
  {
    id: 'wash-complex', group: 'wash', name: 'Комплексная мойка',
    short: 'Двухфазная мойка, чернение резины, уборка салона, чистка стёкол.',
    includes: ['Двухфазная мойка кузова', 'Чернение резины', 'Уборка салона', 'Чистка стёкол'],
    note: 'Багажник — плюс 600 ₽.',
    duration: '~60 мин',
    pricing: { type: 'class', prices: [2300, 2700, 3200, 3600] },
  },
  {
    id: 'wash-detail', group: 'wash', name: 'Детейлинг-мойка кузова',
    short: 'Три фазы, проёмы и труднодоступные места кистями, диски, воск.',
    includes: [
      'Мойка кузова в три фазы',
      'Дверные проёмы и труднодоступные места экстерьера — кистями',
      'Колёсные диски с лицевой стороны',
      'Насадки выхлопных труб',
      'Чернение резины',
      'Воск',
    ],
    duration: '~60–75 мин',
    pricing: { type: 'class', prices: [2800, 3100, 3400, 3800] },
  },
  {
    id: 'wash-detail-complex', group: 'wash', name: 'Детейлинг-комплекс мойки',
    short: 'Детейлинг-мойка кузова плюс проработка салона и багажника.',
    includes: [
      'Всё из детейлинг-мойки кузова',
      'Проработка салона и багажника',
      'Труднодоступные зоны — кистями',
    ],
    duration: '~70–85 мин',
    pricing: { type: 'class', prices: [3900, 4150, 4500, 5000] },
  },
  {
    id: 'complex-1147', group: 'wash', name: 'Комплекс «1147»',
    short: 'Полный комплекс: кузов, салон, кожа, двигатель и днище за один визит.',
    includes: [
      'Глубокая очистка',
      'Кварцевое покрытие',
      'Антидождь',
      'Чистка кожи с консервацией',
      'Мойка двигателя с консервацией',
      'Озонация',
      'Мойка днища',
    ],
    duration: '3–5 ч',
    pricing: { type: 'class', prices: [28000, 30000, 35000, 40000] },
  },
  {
    id: 'reagent', group: 'wash', name: 'Очистка кузова от реагента',
    short: 'Цена зависит от загрязнения.',
    includes: ['Очистка кузова от реагента'],
    duration: null, from: true,
    pricing: { type: 'class', prices: [1800, 2200, 2600, 3000] },
  },
  {
    id: 'engine-wash', group: 'wash', name: 'Мойка двигателя и подкапотного пространства',
    short: 'С консервацией и проработкой труднодоступных мест кистями.',
    includes: ['Мойка двигателя и подкапотного пространства', 'Кисти для труднодоступных мест', 'Консервация'],
    duration: null,
    pricing: { type: 'class', prices: [6000, 6000, 7000, 7000] },
  },
  {
    id: 'moto-wash', group: 'wash', name: 'Комплексная мойка мотоцикла',
    short: 'Мойка, чистка и сушка мотоцикла.',
    includes: ['Мойка мотоцикла', 'Чистка', 'Сушка'],
    duration: null,
    pricing: { type: 'variants', basis: 'по типу мотоцикла', variants: [
      { label: 'Спортивный', price: 1900 },
      { label: 'Крупный', price: 2400 },
    ] },
  },

  // ── Кузов ──────────────────────────────────────────────
  {
    id: 'polish-express', group: 'body', name: 'Экспресс-полировка',
    short: 'Удаление водного камня и мелких дефектов, с мойкой.',
    includes: ['Мойка автомобиля', 'Удаление водного камня', 'Удаление мелких дефектов лака'],
    duration: 'от 3 ч',
    pricing: { type: 'class', prices: [13000, 16000, 20000, 25000] },
  },
  {
    id: 'polish-deep', group: 'body', name: 'Глубокая полировка',
    short: 'Удаление сильных повреждений лака, с мойкой.',
    includes: ['Мойка автомобиля', 'Удаление сильных повреждений лакокрасочного покрытия'],
    duration: 'от 6 ч',
    pricing: { type: 'class', prices: [18000, 25000, 30000, 35000] },
  },
  {
    id: 'polish-local', group: 'body', name: 'Локальная полировка детали',
    short: 'Одна деталь экстерьера целиком.',
    includes: ['Полировка одной детали экстерьера'],
    duration: null, unit: 'за деталь',
    pricing: { type: 'flat', price: 4200 },
  },
  {
    id: 'ceramic-1', group: 'body', name: 'Керамическое покрытие, 1 слой',
    short: 'Защитный слой керамики на кузов.',
    includes: ['Нанесение керамики, 1 слой'],
    duration: null,
    pricing: { type: 'class', prices: [15000, 16000, 18000, 22000] },
  },
  {
    id: 'ceramic-2', group: 'body', name: 'Керамическое покрытие, 2 слоя',
    short: 'Два слоя керамики на кузов.',
    includes: ['Нанесение керамики, 2 слоя'],
    duration: null,
    pricing: { type: 'class', prices: [21000, 24000, 26000, 32000] },
  },
  {
    id: 'ceramic-extra', group: 'body', name: 'Дополнительный слой керамики',
    short: 'Ещё один слой поверх керамического покрытия.',
    includes: ['Дополнительный слой керамики'],
    duration: null,
    pricing: { type: 'class', prices: [9000, 10000, 12000, 15000] },
  },
  {
    id: 'ceramic-ppf', group: 'body', name: 'Керамика для винила и PPF',
    short: 'Покрытие для оклеенного плёнкой кузова.',
    includes: ['Керамика для винила и полиуретановой плёнки'],
    duration: null,
    pricing: { type: 'class', prices: [15000, 16000, 18000, 22000] },
  },
  {
    id: 'liquid-glass', group: 'body', name: 'Жидкое стекло',
    short: 'Защитное покрытие кузова.',
    includes: ['Нанесение жидкого стекла'],
    duration: null,
    pricing: { type: 'class', prices: [7000, 10000, 13500, 16500] },
  },
  {
    id: 'quartz', group: 'body', name: 'Кварцевое покрытие',
    short: 'Включает очистку кузова от реагента.',
    includes: ['Очистка кузова от реагента', 'Кварцевое покрытие'],
    duration: null,
    pricing: { type: 'class', prices: [3000, 3400, 4000, 4800] },
  },
  {
    id: 'antirain-full', group: 'body', name: 'Антидождь на все стёкла',
    short: 'Обработка стёкол водоотталкивающим составом.',
    includes: ['Подготовка стёкол', 'Антидождь на все стёкла'],
    duration: null,
    pricing: { type: 'class', prices: [6000, 6500, 8000, 9000] },
  },
  {
    id: 'chips', group: 'body', name: 'Ремонт сколов',
    short: 'Цена зависит от степени повреждения.',
    includes: ['Ремонт сколов ЛКП'],
    duration: null, from: true,
    pricing: { type: 'flat', price: 5000 },
  },

  // ── Салон ──────────────────────────────────────────────
  {
    id: 'dryclean-full', group: 'interior', name: 'Полная химчистка салона',
    short: 'Весь салон, вместе с мойкой автомобиля.',
    includes: ['Химчистка всего салона: от потолка до напольного покрытия', 'Мойка автомобиля'],
    duration: 'от 6 ч',
    pricing: { type: 'class', prices: [25000, 25000, 30000, 35000] },
  },
  {
    id: 'dryclean-parts', group: 'interior', name: 'Химчистка отдельных элементов',
    short: 'Сиденье, потолок, багажник, коврики — по сложности работ.',
    includes: ['Отдельные элементы салона на выбор', 'Стоимость зависит от элемента и сложности'],
    duration: 'от 10 мин', from: true, unit: 'за элемент',
    pricing: { type: 'flat', price: 550 },
  },
  {
    id: 'ozone', group: 'interior', name: 'Озонирование салона',
    short: 'Устраняет неприятные запахи в салоне.',
    includes: ['Обработка салона озонатором'],
    duration: '~40 мин',
    pricing: { type: 'class', prices: [3000, 3100, 3200, 3300] },
  },
  {
    id: 'dry-fog', group: 'interior', name: 'Сухой туман',
    short: 'Против запахов табака, сырости, животных и еды.',
    includes: ['Обработка салона сухим туманом'],
    duration: '~60–70 мин',
    pricing: { type: 'class', prices: [3000, 3100, 3200, 3300] },
  },
  {
    id: 'leather-full', group: 'interior', name: 'Чистка и обработка кожаного салона',
    short: 'Комплексная чистка и обработка кожи всего салона (LeTech).',
    includes: ['Чистка кожи всего салона', 'Обработка составами LeTech'],
    duration: null,
    pricing: { type: 'class', prices: [12000, 12000, 14000, 16000] },
  },
  {
    id: 'vacuum', group: 'interior', name: 'Уборка салона пылесосом',
    short: 'Сухая уборка салона.',
    includes: ['Уборка салона пылесосом'],
    duration: null,
    pricing: { type: 'class', prices: [550, 650, 750, 850] },
  },
  {
    id: 'glass-inside', group: 'interior', name: 'Чистка стёкол изнутри',
    short: 'Все стёкла салона.',
    includes: ['Чистка всех стёкол изнутри'],
    duration: null,
    pricing: { type: 'class', prices: [550, 650, 750, 850] },
  },

  // ── Шины ───────────────────────────────────────────────
  {
    id: 'tire-set', group: 'tires', name: 'Шиномонтаж, комплекс на 1 колесо',
    short: 'Цена по радиусу и типу автомобиля, есть RunFlat.',
    includes: ['Комплекс работ на одно колесо по прайсу', 'Радиусы R13–R23', 'Стандартные шины и RunFlat'],
    duration: null, unit: 'за колесо',
    pricing: {
      type: 'table', basis: 'по радиусу и типу автомобиля', columns: ['Легковой', 'Внедорожник'],
      rows: [
        { label: 'R13', price: [700, 820] },
        { label: 'R14', price: [960, 1080] },
        { label: 'R15', price: [960, 1080] },
        { label: 'R16', price: [1110, 1440] },
        { label: 'R16 RunFlat', price: [1370, 1800] },
        { label: 'R17', price: [1350, 1470] },
        { label: 'R17 RunFlat', price: [1730, 2160] },
        { label: 'R18', price: [1540, 1660] },
        { label: 'R18 RunFlat', price: [1970, 2090] },
        { label: 'R19', price: [1780, 1900] },
        { label: 'R19 RunFlat', price: [2380, 2500] },
        { label: 'R20', price: [2070, 2190] },
        { label: 'R20 RunFlat', price: [2670, 2790] },
        { label: 'R21', price: [2400, 2520] },
        { label: 'R21 RunFlat', price: [3030, 3150] },
        { label: 'R22', price: [2740, 2860] },
        { label: 'R22 RunFlat', price: [3600, 3720] },
        { label: 'R23', price: [3080, 3200] },
        { label: 'R23 RunFlat', price: [4180, 4300] },
      ],
    },
  },
  {
    id: 'balancing', group: 'tires', name: 'Балансировка, 1 колесо',
    short: 'Цена по радиусу и типу автомобиля.',
    includes: ['Балансировка одного колеса'],
    duration: null, unit: 'за колесо',
    pricing: {
      type: 'table', basis: 'по радиусу и типу автомобиля', columns: ['Легковой', 'Внедорожник'],
      rows: [
        { label: 'R13', price: [210, 360] }, { label: 'R14', price: [240, 360] },
        { label: 'R15', price: [240, 400] }, { label: 'R16', price: [250, 350] },
        { label: 'R17', price: [300, 400] }, { label: 'R18', price: [350, 450] },
        { label: 'R19', price: [400, 500] }, { label: 'R20', price: [450, 550] },
        { label: 'R21', price: [550, 700] }, { label: 'R22', price: [600, 750] },
        { label: 'R23', price: [650, 800] },
      ],
    },
  },
  {
    id: 'tire-repair', group: 'tires', name: 'Ремонт шины жгутом',
    short: 'Одно колесо.',
    includes: ['Ремонт прокола жгутом'],
    duration: null, unit: 'за колесо',
    pricing: { type: 'variants', basis: 'по типу автомобиля', variants: [
      { label: 'Легковой', price: 1600 },
      { label: 'Внедорожник', price: 2200 },
    ] },
  },
  {
    id: 'disc-polish', group: 'tires', name: 'Полировка диска',
    short: 'Лицевая часть, без снятия.',
    includes: ['Полировка лицевой части диска', 'Без снятия колеса'],
    duration: 'от 30 мин', unit: 'за диск',
    pricing: { type: 'variants', basis: 'по размеру диска', variants: [
      { label: 'R15–R19', price: 4000 },
      { label: 'R20–R21', price: 5200 },
      { label: 'R22 и больше', price: 6150 },
      { label: 'R22, хром', price: 8350 },
    ] },
  },
  {
    id: 'disc-protect', group: 'tires', name: 'Защитное покрытие дисков',
    short: 'Лицевая часть, комплект из 4 дисков.',
    includes: ['Защитное покрытие лицевой части', 'Комплект 4 шт.'],
    duration: null, unit: 'за комплект',
    pricing: { type: 'variants', basis: 'по размеру диска', variants: [
      { label: 'R15–R19', price: 14000 },
      { label: 'R20–R21', price: 16000 },
      { label: 'R22 и больше', price: 18000 },
      { label: 'R22, хром', price: 20000 },
    ] },
  },
];

// Витрина: карточки с фото. primary — услуга, которая выбирается при «Записаться» с карточки.
export const FEATURED = [
  {
    id: 'detail-wash', group: 'wash', title: 'Детейлинг-мойка', primary: 'wash-detail',
    result: 'Кузов, проёмы и диски отмываются кистями там, куда не добирается обычная мойка.',
    related: ['wash-detail', 'wash-detail-complex', 'wash-complex', 'wash-body'],
    image: 'card-wash', alt: 'Чёрный автомобиль в активной пене во время мойки',
  },
  {
    id: 'complex', group: 'wash', title: 'Комплекс «1147»', primary: 'complex-1147',
    result: 'Кузов, салон, кожа, двигатель и днище — за один визит.',
    related: ['complex-1147'],
    image: 'card-complex', alt: 'Колёсный диск в пене на тёмном фоне',
  },
  {
    id: 'polish', group: 'body', title: 'Полировка кузова', primary: 'polish-express',
    result: 'Снимает водный камень и мелкие дефекты лака, возвращает чистый блеск.',
    related: ['polish-express', 'polish-deep', 'polish-local'],
    image: 'card-polish', alt: 'Мастер полирует кузов чёрного автомобиля машинкой',
  },
  {
    id: 'protect', group: 'body', title: 'Защита кузова', primary: 'ceramic-2',
    result: 'Керамика, жидкое стекло или кварц поверх чистого лака.',
    related: ['ceramic-1', 'ceramic-2', 'ceramic-extra', 'liquid-glass', 'quartz', 'ceramic-ppf', 'antirain-full'],
    image: 'card-protect', alt: 'Микрофибра на глянцевом капоте рядом с фарой',
  },
  {
    id: 'interior', group: 'interior', title: 'Химчистка салона', primary: 'dryclean-full',
    result: 'Весь салон от потолка до напольного покрытия, вместе с мойкой автомобиля.',
    related: ['dryclean-full', 'dryclean-parts', 'leather-full', 'ozone', 'dry-fog'],
    image: 'card-interior', alt: 'Мастер очищает панель салона кисточкой',
  },
  {
    id: 'tires', group: 'tires', title: 'Шиномонтаж', primary: 'tire-set',
    result: 'Колёса R13–R23, включая RunFlat; цена по радиусу и типу автомобиля.',
    related: ['tire-set', 'balancing', 'tire-repair', 'disc-polish'],
    image: 'card-tires', alt: 'Мастер снимает колесо с автомобиля',
  },
];

// ── Вспомогательные функции (общие для сайта, формы и панели) ──

const nf = new Intl.NumberFormat('ru-RU');
export const rub = (n) => `${nf.format(n)} ₽`;

export function getService(id) {
  if (id === CONSULTATION.id) return CONSULTATION;
  return SERVICES.find((s) => s.id === id) || null;
}

export function getClass(id) {
  if (id === UNKNOWN_CLASS.id) return UNKNOWN_CLASS;
  return CAR_CLASSES.find((c) => c.id === id) || null;
}

/** Минимальная цена услуги — для «от …» на карточках */
export function minPrice(service) {
  const p = service.pricing;
  if (p.type === 'class') return Math.min(...p.prices);
  if (p.type === 'flat') return p.price;
  if (p.type === 'variants') return Math.min(...p.variants.map((v) => v.price));
  if (p.type === 'table') return Math.min(...p.rows.flatMap((r) => r.price));
  return null;
}

export function maxPrice(service) {
  const p = service.pricing;
  if (p.type === 'class') return Math.max(...p.prices);
  if (p.type === 'flat') return p.price;
  if (p.type === 'variants') return Math.max(...p.variants.map((v) => v.price));
  if (p.type === 'table') return Math.max(...p.rows.flatMap((r) => r.price));
  return null;
}

/**
 * Цена для услуги и класса.
 * Возвращает { kind: 'exact'|'from'|'range'|'ask', text, value? }
 * classId: 'c1'..'c4' | 'all' | 'unknown' | null
 */
export function priceFor(service, classId) {
  const p = service.pricing;
  const unit = service.unit ? ` ${service.unit}` : '';
  if (p.type === 'ask') return { kind: 'ask', text: 'Уточнить стоимость' };
  if (p.type === 'flat') {
    return { kind: service.from ? 'from' : 'exact', value: p.price, text: `${service.from ? 'от ' : ''}${rub(p.price)}${unit}` };
  }
  if (p.type === 'variants' || p.type === 'table') {
    return { kind: 'from', value: minPrice(service), text: `от ${rub(minPrice(service))}${unit}`, note: p.basis };
  }
  // class
  const idx = CAR_CLASSES.findIndex((c) => c.id === classId);
  if (idx >= 0) {
    const v = p.prices[idx];
    if (typeof v !== 'number') return { kind: 'ask', text: 'Уточнить стоимость' };
    return { kind: service.from ? 'from' : 'exact', value: v, text: `${service.from ? 'от ' : ''}${rub(v)}` };
  }
  if (classId === 'all') {
    const lo = minPrice(service);
    const hi = maxPrice(service);
    return { kind: 'range', value: lo, text: lo === hi ? rub(lo) : `${nf.format(lo)}–${rub(hi)}` };
  }
  return { kind: 'ask', text: 'Уточнить стоимость' };
}

/** «от 2 800 ₽» для карточки витрины */
export function cardPrice(featured) {
  const s = getService(featured.primary);
  const v = minPrice(s);
  if (v == null) return 'Стоимость уточняется';
  return `от ${rub(v)}${s.unit ? ` ${s.unit}` : ''}`;
}
