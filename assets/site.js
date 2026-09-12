/* Монтаж кровли и фасада — прайс плитками, окно с ценами, «весь прайс».
   Данные — assets/data.js (MN_TABS, MN_ITEMS), цены — блок MN_PRICES
   в index.html: он же целиком уезжает в код блока T123 для Тильды.
   Калькулятор — assets/calc.js, считает по тем же ценам. */

/* На GitHub Pages пути относительные. В блоке T123 страницу отдаёт Тильда,
   а картинки и скрипты остаются на Pages — блок заранее кладёт адрес Pages
   в window.MN_ASSET_BASE, и все относительные пути склеиваются с ним. */
var MN_BASE = (typeof window !== 'undefined' && typeof window.MN_ASSET_BASE === 'string')
  ? window.MN_ASSET_BASE : '';
var MN_UNIT = '₽';
var MN_PHONE = '+7 912 479-52-23';
var MN_TEL = '+79124795223';
var MN_NOTE = 'Цены — за работу, без материалов. Итоговая сумма зависит от сложности ' +
  'кровли или фасада и считается по смете после замера.';

var PRICE_INDEX = {};   // ключ работы -> строка прайса (label, unit, price)
var MODEL_INDEX = {};   // slug -> карточка
var TAB_INDEX = {};     // id вкладки -> вкладка
var ITEMS = [];         // карточки по порядку
var CATALOG = null;     // контейнер прайса
var ACTIVE_TAB = null;
var CURRENT = null;     // карточка, открытая в окне

function asset(p) {
  if (!p || !MN_BASE || p.indexOf('http') === 0 || p.indexOf('//') === 0) return p;
  return MN_BASE + p;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* «1 250» -> 1250. Пустая строка и любой текст («по запросу») -> null. */
function priceNum(s) {
  var t = String(s == null ? '' : s).replace(/\s+/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}

/* 276000 -> «276 000» с неразрывным пробелом, чтобы цена не рвалась */
function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function plural(n, one, few, many) {
  var a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function indexRows(items) {
  (items || []).forEach(function (m) {
    (m.rows || []).forEach(function (r) { PRICE_INDEX[r.key] = r; });
  });
}

/* Цены из блока MN_PRICES. Ключ — точное название работы. Неизвестный
   ключ пишет предупреждение в консоль, иначе опечатку в названии не заметить. */
function applyPrices(map, unit, items) {
  if (unit) MN_UNIT = unit;
  indexRows(items);
  if (!map) return;
  Object.keys(PRICE_INDEX).forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(map, k)) PRICE_INDEX[k].price = String(map[k]).trim();
  });
  Object.keys(map).forEach(function (k) {
    if (!PRICE_INDEX[k]) console.warn('MN_PRICES: работа «' + k + '» не найдена — проверьте название');
  });
}

function keyPrice(key) {
  var r = PRICE_INDEX[key];
  return r ? priceNum(r.price) : null;
}

/* Самая низкая цена карточки среди строк с её единицей — её показываем на плитке */
function minPrice(m) {
  var best = null;
  (m.rows || []).forEach(function (r) {
    var n = priceNum(r.price);
    if (n !== null && r.unit === m.unit && (best === null || n < best)) best = n;
  });
  return best;
}

function unitText(u) { return MN_UNIT + '/' + u; }

function priceHtml(m) {
  var p = minPrice(m);
  if (p === null) return '<span class="price price-ask">Цена по запросу</span>';
  return '<span class="price">' + fmt(p) + ' <small>' + esc(unitText(m.unit)) + '</small></span>';
}

/* Подпись под ценой: вторая цена («под ключ — 2 300 ₽/м²»), своя подпись
   или число видов работ в карточке. Цена с единицей не переносится:
   иначе на телефоне «₽/» остаётся на строке, а «м²» уезжает на следующую. */
function metaHtml(m) {
  if (m.sub) {
    var n = keyPrice(m.sub.key);
    if (n !== null) return esc(m.sub.label) + ' — <span class="mn-nw">' + fmt(n) + ' ' +
      esc(unitText(PRICE_INDEX[m.sub.key].unit)) + '</span>';
  }
  if (m.meta) return esc(m.meta);
  var c = (m.rows || []).length;
  return c > 1 ? c + ' ' + plural(c, 'вид работ', 'вида работ', 'видов работ') : '';
}

/* ---------- плитка ---------- */
function modelTile(m) {
  return '<a href="#' + m.slug + '" class="model-tile" data-key="' + m.slug + '">' +
    '<span class="model-tile-media">' +
      '<img src="' + asset(m.hero) + '" alt="' + esc(m.name) + '" loading="lazy">' +
      '<span class="model-tile-hint">Смотреть цены</span>' +
    '</span>' +
    '<span class="model-tile-body">' +
      '<span class="model-tile-name">' + esc(m.name) + '</span>' +
      '<span class="model-tile-short">' + esc(m.short) + '</span>' +
      '<span class="model-tile-meta">' + priceHtml(m) +
        '<span class="width">' + metaHtml(m) + '</span>' +
      '</span>' +
    '</span>' +
  '</a>';
}

/* ---------- прайс: вкладки + по сетке плиток на каждую ---------- */
function renderCatalog(hostId, tabs, items) {
  CATALOG = document.getElementById(hostId);
  if (!CATALOG || !tabs || !items) return;
  indexRows(items);
  ITEMS = items;

  var byTab = {};
  items.forEach(function (m) {
    MODEL_INDEX[m.slug] = m;
    (byTab[m.tab] = byTab[m.tab] || []).push(m);
  });
  tabs.forEach(function (t) { TAB_INDEX[t.id] = t; });
  ACTIVE_TAB = tabs[0].id;

  function works(t) {
    return (byTab[t.id] || []).reduce(function (s, m) { return s + (m.rows || []).length; }, 0);
  }

  CATALOG.innerHTML =
    '<div class="aq-tabs" role="tablist" aria-label="Виды работ">' +
      tabs.map(function (t, i) {
        return '<button type="button" class="aq-tab' + (i ? '' : ' is-active') + '" role="tab"' +
          ' id="tabbtn-' + t.id + '" aria-controls="tab-' + t.id + '"' +
          ' aria-selected="' + (i ? 'false' : 'true') + '" tabindex="' + (i ? '-1' : '0') + '"' +
          ' data-tab="' + t.id + '">' + esc(t.title) +
          '<span class="aq-tab-count">' + works(t) + '</span></button>';
      }).join('') +
    '</div>' +
    tabs.map(function (t, i) {
      return '<div class="aq-panel' + (i ? '' : ' is-active') + '" role="tabpanel"' +
          ' id="tab-' + t.id + '" aria-labelledby="tabbtn-' + t.id + '">' +
        '<div class="aq-panel-head mn-panel-head">' +
          '<div>' +
            '<h3 class="aq-panel-title">' + esc(t.heading || t.title) + '</h3>' +
            (t.lead ? '<p class="aq-panel-lead">' + esc(t.lead) + '</p>' : '') +
          '</div>' +
          '<a href="#prajs-' + t.id + '" class="btn-outline mn-full-btn" data-full="' + t.id + '">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>' +
            'Весь прайс таблицей</a>' +
        '</div>' +
        '<div class="model-grid">' + (byTab[t.id] || []).map(modelTile).join('') + '</div>' +
      '</div>';
    }).join('');
}

function showTab(id, focus) {
  if (!CATALOG || !TAB_INDEX[id]) return;
  ACTIVE_TAB = id;
  Array.prototype.forEach.call(CATALOG.querySelectorAll('.aq-tab'), function (b) {
    var on = b.getAttribute('data-tab') === id;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.setAttribute('tabindex', on ? '0' : '-1');
    if (on && focus) b.focus();
  });
  Array.prototype.forEach.call(CATALOG.querySelectorAll('.aq-panel'), function (p) {
    p.classList.toggle('is-active', p.id === 'tab-' + id);
  });
}

function scrollToId(id) {
  var c = document.getElementById(id);
  if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Вкладка пишется в адрес без новой записи в истории: «Назад» не должен
   перелистывать вкладки, а ссылкой #fasad можно поделиться. */
function setHash(h) {
  try { history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (err) {}
}

/* ---------- таблица цен ---------- */
function priceRowsHtml(rows) {
  return rows.map(function (r) {
    var n = priceNum(r.price);
    return '<tr><td class="mod-name">' + esc(r.label) + '</td>' +
      '<td class="mn-unit">' + esc(r.unit) + '</td>' +
      '<td class="mod-price">' + (n !== null ? fmt(n) + ' ' + esc(MN_UNIT) : 'по запросу') + '</td></tr>';
  }).join('');
}

function priceTableHtml(body) {
  return '<div class="table-scroll"><table class="mod-table mn-price-table"><thead><tr>' +
    '<th>Работа</th><th>Ед.</th><th>Цена</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}

function ctaHtml() {
  return '<div class="mn-modal-cta">' +
    '<a href="tel:' + MN_TEL + '" class="btn">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>' +
      esc(MN_PHONE) + '</a>' +
    '<a href="#calc" class="btn-outline">Посчитать стоимость</a>' +
  '</div>';
}

/* ---------- содержимое окна: одна карточка ---------- */
function modelDetailHtml(key) {
  var m = MODEL_INDEX[key];
  if (!m) return '';
  var tab = TAB_INDEX[m.tab] || {};
  var p = minPrice(m);
  return '<div class="collection-head">' +
      '<div class="collection-hero-col">' +
        '<div class="collection-hero">' +
          '<img class="model-modal-photo" src="' + asset(m.hero) + '" alt="' + esc(m.name) + '">' +
        '</div>' +
        '<a href="#contacts" class="btn">Вызвать замерщика</a>' +
      '</div>' +
      '<div class="collection-head-text">' +
        '<span class="collection-tag">' + esc(tab.heading || tab.title || '') + '</span>' +
        '<div class="collection-title-row">' +
          '<h3 class="section-title collection-title" style="font-size:22px">' + esc(m.name) + '</h3>' +
          (p !== null
            ? '<div class="collection-price"><span>' + fmt(p) + '</span> ' + esc(unitText(m.unit)) + '</div>'
            : '') +
        '</div>' +
        '<p class="section-sub">' + esc(m.desc) + '</p>' +
        '<div class="mod-block"><p class="mod-title">Прайс</p>' + priceTableHtml(priceRowsHtml(m.rows || [])) + '</div>' +
        (m.note ? '<p class="model-note">' + esc(m.note) + '</p>' : '') +
        '<p class="mn-fine">' + esc(MN_NOTE) + '</p>' +
        ctaHtml() +
      '</div>' +
    '</div>';
}

/* ---------- содержимое окна: весь прайс вкладки ---------- */
function fullPriceHtml(tabId) {
  var t = TAB_INDEX[tabId];
  if (!t) return '';
  var body = ITEMS.filter(function (m) { return m.tab === tabId; }).map(function (m) {
    return '<tr class="mn-group"><td colspan="3"><a href="#' + m.slug + '" data-key="' + m.slug + '">' +
      esc(m.name) + '</a></td></tr>' + priceRowsHtml(m.rows || []);
  }).join('');
  return '<div class="mn-full">' +
    '<span class="collection-tag">Прайс</span>' +
    '<h3 class="section-title mn-full-title">' + esc(t.heading || t.title) + ' — все цены</h3>' +
    '<p class="mn-fine">' + esc(MN_NOTE) + '</p>' +
    priceTableHtml(body) +
    ctaHtml() +
  '</div>';
}

/* ---------- окно ---------- */
var MODAL = null;          // корневой элемент окна
var MODAL_PUSHED = false;  // добавляли ли мы запись в историю
var MODAL_SCROLL = null;   // сохранённые inline-стили overflow

function modalRoot() {
  if (MODAL) return MODAL;
  MODAL = document.createElement('div');
  MODAL.className = 'model-modal';
  MODAL.setAttribute('role', 'dialog');
  MODAL.setAttribute('aria-modal', 'true');
  MODAL.innerHTML =
    '<div class="model-modal-backdrop" data-close="1"></div>' +
    '<div class="model-modal-dialog">' +
      '<button type="button" class="model-modal-close" data-close="1" aria-label="Закрыть">&times;</button>' +
      '<div class="model-modal-body"></div>' +
    '</div>';
  /* Внутрь блока, а не в body: в Тильде весь CSS ограничен областью
     видимости .mn, и окно, висящее в body, осталось бы без стилей. */
  (document.querySelector('.mn') || document.body).appendChild(MODAL);

  MODAL.addEventListener('click', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-close')) { e.preventDefault(); closeModal(); return; }
    if (!t.closest) return;

    /* строка группы во «всём прайсе» — открываем карточку в том же окне */
    var k = t.closest('[data-key]');
    if (k && MODEL_INDEX[k.getAttribute('data-key')]) {
      e.preventDefault();
      CURRENT = k.getAttribute('data-key');
      showTab(MODEL_INDEX[CURRENT].tab);
      fillModal(modelDetailHtml(CURRENT));
      try { history.replaceState(MODAL_PUSHED ? { mnModal: CURRENT } : null, '', '#' + CURRENT); } catch (err) {}
      return;
    }

    /* ссылка на секцию страницы (контакты, калькулятор): закрыть и доехать */
    var a = t.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    var from = CURRENT;
    /* историю правим сами: history.back() вернул бы прокрутку
       на прежнее место и отменил переход */
    MODAL_PUSHED = false;
    setHash('');
    closeModal(true);
    if (id === 'calc' && typeof calcPreset === 'function') calcPreset(from, ACTIVE_TAB);
    scrollToId(id);
  });

  return MODAL;
}

function fillModal(html) {
  MODAL.querySelector('.model-modal-body').innerHTML = html;
  MODAL.scrollTop = 0;
}

function openModal(html, hash, push) {
  var el = modalRoot();
  fillModal(html);
  el.classList.add('is-open');
  if (MODAL_SCROLL === null) {
    MODAL_SCROLL = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  if (push) {
    try { history.pushState({ mnModal: hash }, '', '#' + hash); MODAL_PUSHED = true; } catch (err) {}
  }
  var close = el.querySelector('.model-modal-close');
  if (close) close.focus();
}

function openModel(key, push) {
  if (!MODEL_INDEX[key]) return;
  CURRENT = key;
  openModal(modelDetailHtml(key), key, push);
}

function openFull(tabId, push) {
  if (!TAB_INDEX[tabId]) return;
  CURRENT = null;
  openModal(fullPriceHtml(tabId), 'prajs-' + tabId, push);
}

function closeModal(fromHistory) {
  if (!MODAL || !MODAL.classList.contains('is-open')) return;
  MODAL.classList.remove('is-open');
  MODAL.querySelector('.model-modal-body').innerHTML = '';
  CURRENT = null;
  if (MODAL_SCROLL) {
    document.documentElement.style.overflow = MODAL_SCROLL[0];
    document.body.style.overflow = MODAL_SCROLL[1];
    MODAL_SCROLL = null;
  }
  if (!fromHistory) {
    if (MODAL_PUSHED) { MODAL_PUSHED = false; history.back(); }
    else setHash('');
  }
}

/* #<карточка> — окно карточки, #prajs-<вкладка> — весь прайс, #<вкладка> — раздел */
function routeHash(h, scroll) {
  if (MODEL_INDEX[h]) { showTab(MODEL_INDEX[h].tab); openModel(h, false); return true; }
  if (h.indexOf('prajs-') === 0 && TAB_INDEX[h.slice(6)]) { showTab(h.slice(6)); openFull(h.slice(6), false); return true; }
  closeModal(true);
  if (TAB_INDEX[h]) { showTab(h); if (scroll) scrollToId('prices'); return true; }
  return false;
}

/* Цены в тексте страницы (первый экран): <b data-from="<карточка>"> получает
   её минимальную цену — правка в MN_PRICES меняет и плитки, и шапку. */
function fillFromPrices() {
  var root = document.querySelector('.mn') || document;
  Array.prototype.forEach.call(root.querySelectorAll('[data-from]'), function (el) {
    var m = MODEL_INDEX[el.getAttribute('data-from')];
    var p = m ? minPrice(m) : null;
    if (p !== null) el.textContent = fmt(p);
  });
}

/* ---------- обработчики ---------- */
function initCatalog() {
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || t.closest('.model-modal')) return;   // окно обрабатывает свои клики само

    var full = t.closest('[data-full]');
    if (full && TAB_INDEX[full.getAttribute('data-full')]) {
      e.preventDefault();
      showTab(full.getAttribute('data-full'));
      openFull(full.getAttribute('data-full'), true);
      return;
    }

    /* вкладка прайса или ссылка на неё */
    var tabEl = t.closest('[data-tab]');
    if (tabEl && TAB_INDEX[tabEl.getAttribute('data-tab')]) {
      e.preventDefault();
      var id = tabEl.getAttribute('data-tab');
      showTab(id);
      setHash(id);
      if (!tabEl.classList.contains('aq-tab')) scrollToId('prices');
      return;
    }

    /* плитка или ссылка на карточку */
    var src = t.closest('[data-key]');
    if (!src || !MODEL_INDEX[src.getAttribute('data-key')]) return;
    e.preventDefault();
    showTab(MODEL_INDEX[src.getAttribute('data-key')].tab);
    openModel(src.getAttribute('data-key'), true);
  });

  /* стрелки на вкладках — как в обычном переключателе */
  if (CATALOG) CATALOG.addEventListener('keydown', function (e) {
    var b = e.target.closest ? e.target.closest('.aq-tab') : null;
    if (!b) return;
    var list = Array.prototype.slice.call(CATALOG.querySelectorAll('.aq-tab'));
    var i = list.indexOf(b), j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = list.length - 1;
    if (j < 0) return;
    e.preventDefault();
    showTab(list[j].getAttribute('data-tab'), true);
    setHash(list[j].getAttribute('data-tab'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeModal();
  });

  window.addEventListener('popstate', function () {
    MODAL_PUSHED = false;
    routeHash((location.hash || '').replace(/^#/, ''), false);
  });

  routeHash((location.hash || '').replace(/^#/, ''), true);
}
