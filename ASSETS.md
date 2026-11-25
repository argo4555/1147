# ASSETS — источники и лицензии

Все изображения и шрифты хранятся локально в `site/assets/`. Внешних загрузок на старте страницы нет (карта Яндекса подключается только по кнопке «Показать карту»).

## Логотип

| Файл | Источник | Примечание |
|---|---|---|
| `brand/logo-1147-original.png` (не публикуется) | https://static.tildacdn.com/tild3064-3635-4065-a637-616163623264/__.png | Тот же файл стоит в шапке 1147detailing.ru (`data-original` логотипа, проверено 25.11.2026). PNG 1024×1024 с прозрачностью. |
| `site/assets/brand/logo-1147-{96,192,384}.webp`, `logo-1147-192.png` | производные от оригинала | Обрезаны пустые поля, пропорции, цвет и начертание не менялись. |
| `site/favicon-32.png`, `site/apple-touch-icon.png`, `site/icon-512.png` | производные | Логотип на фоне #0A0A0A. |

Фирменный жёлтый взят из пикселей логотипа: `rgb(253, 228, 0)` = **#FDE400**.

Логотип принадлежит 1147 Detailing и используется только в демо для этого центра.

## Шрифты

| Шрифт | Начертания | Подмножества | Лицензия |
|---|---|---|---|
| Oswald | 600 | cyrillic, latin, latin-ext (только знак ₽) | SIL Open Font License 1.1 — `site/assets/fonts/licenses/Oswald-OFL.txt` |
| Golos Text | 400, 600 | cyrillic, latin, latin-ext (только знак ₽) | SIL Open Font License 1.1 — `site/assets/fonts/licenses/GolosText-OFL.txt` |

Файлы WOFF2 взяты из пакета Fontsource (cdn.jsdelivr.net/fontsource), тексты лицензий — из репозитория google/fonts. OFL разрешает встраивание на сайт и распространение вместе с сайтом.

## Фотографии

Фотографий центра 1147 с разрешением на использование не было, поэтому все кадры — **иллюстрации** со стока Unsplash ([лицензия Unsplash](https://unsplash.com/license): бесплатное коммерческое использование, атрибуция не обязательна, но указана ниже). На сайте каждое фото подписано «Иллюстрация», ни одно не выдаётся за работу 1147. Все фото проверены визуально: без сломанных инструментов и бессмысленных надписей; надпись производителя на перчатке (фото шиномонтажа) заретуширована, ведро с наклейкой на фото первого экрана ушло в затемнение (ПК) и за край кадра (телефон). Марки автомобилей на кузовах — часть самих автомобилей.

| Где на сайте | Файлы `site/assets/img/` | Фото на Unsplash | Автор |
|---|---|---|---|
| Первый экран | `hero-desktop-*`, `hero-mobile-*`, `og-1147.jpg` | [sports-car-washing-in-garage-pRppMPh4Zho](https://unsplash.com/photos/sports-car-washing-in-garage-pRppMPh4Zho) | Andre Tan |
| Полоса «Комплекс 1147» | `band-complex-*` | [parked-black-car-HNCSCpWrVJA](https://unsplash.com/photos/parked-black-car-HNCSCpWrVJA) | Ville Kaisla |
| Карточка «Детейлинг-мойка» | `card-wash-*` | [black-car-covered-in-soap-suds-during-wash-bCQSrcYghJI](https://unsplash.com/photos/black-car-covered-in-soap-suds-during-wash-bCQSrcYghJI) | Willian Cittadin |
| Карточка «Комплекс 1147» | `card-complex-*` | [a-close-up-of-a-car-tire-on-a-wet-surface-m5g2IFRouCs](https://unsplash.com/photos/a-close-up-of-a-car-tire-on-a-wet-surface-m5g2IFRouCs) | Zac Nielson |
| Карточка «Полировка кузова» | `card-polish-*` | [a-man-waxing-a-car-in-a-garage-CsZjHjFN3N8](https://unsplash.com/photos/a-man-waxing-a-car-in-a-garage-CsZjHjFN3N8) | Zac Nielson |
| Карточка «Защита кузова» | `card-protect-*` | [gray-microfiber-cloth-on-a-black-car-hood-Df9XCGX9Y2U](https://unsplash.com/photos/gray-microfiber-cloth-on-a-black-car-hood-Df9XCGX9Y2U) | GoGoNano |
| Карточка «Химчистка салона» | `card-interior-*` | [detailer-cleaning-the-dashboard-of-a-classic-car-5SmPnmCjwcU](https://unsplash.com/photos/detailer-cleaning-the-dashboard-of-a-classic-car-5SmPnmCjwcU) | Luay Barani |
| Карточка «Шиномонтаж» | `card-tires-*` | [a-man-working-on-a-tire-in-a-garage-9uHal2Dd9aE](https://unsplash.com/photos/a-man-working-on-a-tire-in-a-garage-9uHal2Dd9aE) | Jimmy Nilsson Masth (логотип на перчатке заретуширован) |
| Галерея: оптика | `gal-optics-*` | [red-sports-car-tmAynVA_ihE](https://unsplash.com/photos/red-sports-car-tmAynVA_ihE) | Yuvraj Singh |
| Галерея: оптика в темноте | `gal-optics-night-*` | [a-close-up-of-a-cars-headlight-in-the-dark-oqw8zg1wC78](https://unsplash.com/photos/a-close-up-of-a-cars-headlight-in-the-dark-oqw8zg1wC78) | Mathew Antony |
| Галерея: салон | `gal-interior-*` | [black-and-gray-car-interior-U4IaoKF5aj4](https://unsplash.com/photos/black-and-gray-car-interior-U4IaoKF5aj4) | Ján Vlačuha |
| Галерея: кожа | `gal-leather-*` | [the-interior-of-a-modern-car-with-leather-seats-jBL6jiMgwlM](https://unsplash.com/photos/the-interior-of-a-modern-car-with-leather-seats-jBL6jiMgwlM) | igor constantino |
| Галерея: ЛКП | `gal-paint-*` | [close-up-of-a-shiny-blue-car-body-with-reflections-6_Rv_qzog90](https://unsplash.com/photos/close-up-of-a-shiny-blue-car-body-with-reflections-6_Rv_qzog90) | Sobolev Maksim |
| Галерея: крыло | `gal-fender-*` | [close-up-of-a-classic-cars-shiny-black-fender-8ZW-P92HnnE](https://unsplash.com/photos/close-up-of-a-classic-cars-shiny-black-fender-8ZW-P92HnnE) | Anshul Gurjar |
| «До и после» | `ba-after-*`, `ba-before-*` | [close-up-of-a-shiny-brown-car-hood-lFDWY0SbTSA](https://unsplash.com/photos/close-up-of-a-shiny-brown-car-hood-lFDWY0SbTSA) | atelierbyvineeth |

### Пара «до/после»

Настоящей пары «до/после» одного автомобиля нет. Для демонстрации интерактива кадр «после» — исходное фото, кадр «до» получен обработкой **этого же снимка** (матовость, паутинка царапин вокруг бликов, следы капель) — один автомобиль, один ракурс, совпадающие детали. На сайте пара подписана как иллюстрация, а не работа 1147. Код обработки — `tools/images.py`, функция `make_before`.

## Как пересобрать изображения

Исходники лежат в `_src/` (в `.gitignore`, не публикуются). Скачать оригинал можно по ссылке из таблицы (кнопка Download на Unsplash), сохранить как `_src/u<номер>.jpg` по соответствию в `tools/images.py` (словарь `SOURCES`), затем:

```
python tools/images.py
```

Нужны Python 3.11+ с Pillow и NumPy. В публичную сборку скрипт не входит.

## Чек-лист контента от 1147

- [ ] Фото центра: бокс, въезд в паркинг на −1 этаже, команда за работой — с письменным разрешением на публикацию.
- [ ] 3–6 реальных пар «до/после» (один автомобиль, один ракурс) — заменят иллюстративную пару и галерею.
- [ ] Логотип в векторе (SVG/PDF) — сейчас используется PNG с сайта.
- [ ] Схема или фото въезда для блока «Как заехать».
