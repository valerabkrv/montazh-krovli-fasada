/* Калькулятор стоимости работ. Считает по тем же ценам, что и прайс
   (MN_PRICES -> PRICE_INDEX в site.js), поэтому правка цены в одном месте
   меняет и плитки, и расчёт. Что складывается — MN_CALC в assets/data.js. */

var CALC = null;       // контейнер калькулятора
var CALC_CFG = null;
var CALC_MODE = 'roof';

/* Переход «Посчитать стоимость» из окна карточки: что выбрать заранее */
var CALC_PRESET = {
  'metallocherepica':    { mode: 'roof', pick: ['mn-roof-cover', 'metall'] },
  'gibkaya-cherepica':   { mode: 'roof', pick: ['mn-roof-cover', 'gibkaya'] },
  'falcevaya':           { mode: 'roof', pick: ['mn-roof-cover', 'falc'] },
  'ventilyaciya':        { mode: 'roof', extra: 'Монтаж вентвыхода' },
  'mansardnye-okna':     { mode: 'roof', extra: 'Установка мансардного окна' },
  'sayding':             { mode: 'facade', pick: ['mn-fac-clad', 'vinil'] },
  'paneli-plitka':       { mode: 'facade', pick: ['mn-fac-clad', 'paneli'] },
  'uteplenie-fasada':    { mode: 'facade', pick: ['mn-fac-ins', 'b50'] },
  'podsistema-lesa':     { mode: 'facade', check: '[data-scaffold]' }
};

function calcChip(name, value, label, checked, sub) {
  return '<label class="calc-chip"><input type="radio" name="' + name + '" value="' + value + '"' +
    (checked ? ' checked' : '') + '><span>' + esc(label) + '<small>' + esc(sub || '') + '</small></span></label>';
}

function calcQty(x) {
  var n = keyPrice(x.key);
  return '<label class="calc-extra"><span class="calc-extra-name">' + esc(x.label) +
      '<small>' + (n !== null ? fmt(n) + ' ' + esc(unitText(x.unit)) : 'цена по запросу') + '</small></span>' +
    '<span class="calc-qty"><input type="number" inputmode="numeric" min="0" max="9999" step="1" value="0"' +
      ' data-extra="' + esc(x.key) + '" data-unit="' + esc(x.unit) + '" data-label="' + esc(x.label) + '"' +
      ' aria-label="' + esc(x.label) + ', ' + esc(x.unit) + '"><em>' + esc(x.unit) + '</em></span></label>';
}

function calcArea(id, label, value, max) {
  return '<div class="calc-field"><label class="calc-label" for="' + id + '">' + label + '</label>' +
    '<div class="calc-area">' +
      '<input type="range" min="10" max="' + max + '" step="5" value="' + value + '" data-area-range="' + id + '" aria-label="' + label + '">' +
      '<span class="calc-qty calc-qty-lg"><input type="number" inputmode="numeric" id="' + id + '" min="1" max="9999" value="' + value + '"><em>м²</em></span>' +
    '</div></div>';
}

function renderCalc(hostId, cfg) {
  CALC = document.getElementById(hostId);
  if (!CALC || !cfg) return;
  CALC_CFG = cfg;
  var r = cfg.roof, f = cfg.facade;

  CALC.innerHTML =
    '<div class="calc">' +
      '<div class="calc-form">' +
        '<div class="calc-modes" role="tablist" aria-label="Что считаем">' +
          '<button type="button" class="calc-mode is-active" data-mode="roof" role="tab" aria-selected="true">Кровля</button>' +
          '<button type="button" class="calc-mode" data-mode="facade" role="tab" aria-selected="false">Фасад</button>' +
        '</div>' +

        '<div class="calc-pane is-active" data-pane="roof">' +
          '<div class="calc-field"><span class="calc-label">Что делаем</span><div class="calc-chips calc-chips-2">' +
            calcChip('mn-roof-scope', 'full', 'Кровля под ключ', true, 'стропила, обрешётка, пирог, покрытие') +
            calcChip('mn-roof-scope', 'cover', 'Только покрытие', false, 'на готовую обрешётку') +
          '</div></div>' +
          '<div class="calc-field"><span class="calc-label">Покрытие</span><div class="calc-chips">' +
            r.coverings.map(function (c, i) { return calcChip('mn-roof-cover', c.id, c.label, !i); }).join('') +
          '</div></div>' +
          calcArea('mn-roof-area', 'Площадь кровли', 150, 500) +
          '<div class="calc-field"><span class="calc-label">Дополнительно</span><div class="calc-extras">' +
            r.extras.map(calcQty).join('') +
          '</div></div>' +
        '</div>' +

        '<div class="calc-pane" data-pane="facade">' +
          '<div class="calc-field"><span class="calc-label">Облицовка</span><div class="calc-chips">' +
            f.claddings.map(function (c, i) { return calcChip('mn-fac-clad', c.id, c.label, !i); }).join('') +
          '</div></div>' +
          calcArea('mn-fac-area', 'Площадь фасада', 150, 600) +
          '<div class="calc-field"><span class="calc-label">Утепление</span><div class="calc-chips">' +
            f.insulation.map(function (o, i) { return calcChip('mn-fac-ins', o.id, o.label, !i); }).join('') +
          '</div><p class="calc-hint" data-ins-hint hidden>Термопанели уже с утеплителем — отдельное утепление под них не нужно.</p></div>' +
          '<div class="calc-field"><span class="calc-label">Подсистема и леса</span><div class="calc-checks">' +
            '<label class="calc-check"><input type="checkbox" data-frame checked><span data-frame-label>Подсистема под облицовку</span></label>' +
            '<label class="calc-check"><input type="checkbox" data-scaffold><span>Леса на всю площадь фасада</span></label>' +
          '</div></div>' +
          '<div class="calc-field"><span class="calc-label">Дополнительно</span><div class="calc-extras">' +
            f.extras.map(calcQty).join('') +
          '</div></div>' +
        '</div>' +
      '</div>' +

      '<aside class="calc-result" aria-live="polite">' +
        '<p class="calc-result-label">Стоимость работ</p>' +
        '<p class="calc-total"><b data-total>0</b> ' + esc(MN_UNIT) + '</p>' +
        '<ul class="calc-lines" data-lines></ul>' +
        '<p class="calc-note">Расчёт по ценам прайса, без материалов. Точную смету посчитаем после замера.</p>' +
        '<a class="btn calc-cta" href="tel:' + MN_TEL + '">Записаться на замер</a>' +
        '<a class="btn-outline calc-cta" href="#contacts">Адреса и телефоны</a>' +
      '</aside>' +
    '</div>';

  CALC.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-mode]') : null;
    if (b) calcMode(b.getAttribute('data-mode'));
  });
  CALC.addEventListener('input', function (e) {
    var t = e.target, pair;
    if (t.hasAttribute('data-area-range')) {
      CALC.querySelector('#' + t.getAttribute('data-area-range')).value = t.value;
    } else if (t.id && (pair = CALC.querySelector('[data-area-range="' + t.id + '"]'))) {
      pair.value = t.value;
    }
    calcUpdate();
  });
  CALC.addEventListener('change', calcUpdate);
  calcUpdate();
}

function calcMode(mode) {
  if (!CALC || (mode !== 'roof' && mode !== 'facade')) return;
  CALC_MODE = mode;
  Array.prototype.forEach.call(CALC.querySelectorAll('.calc-mode'), function (b) {
    var on = b.getAttribute('data-mode') === mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  Array.prototype.forEach.call(CALC.querySelectorAll('.calc-pane'), function (p) {
    p.classList.toggle('is-active', p.getAttribute('data-pane') === mode);
  });
  calcUpdate();
}

function calcPick(name) {
  var el = CALC.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

function calcFind(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
}

function calcNum(el) {
  var n = parseFloat(String(el && el.value || '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
}

/* строки расчёта для текущего режима: { label, qty, unit, price, sum } */
function calcLines() {
  var lines = [];
  function add(key, label, qty, unit) {
    if (!qty || !key) return;
    var p = keyPrice(key);
    lines.push({ label: label, qty: qty, unit: unit, price: p, sum: p === null ? null : p * qty });
  }
  function rowLabel(key) { return (PRICE_INDEX[key] || {}).label || key; }

  if (CALC_MODE === 'roof') {
    var c = calcFind(CALC_CFG.roof.coverings, calcPick('mn-roof-cover'));
    var full = calcPick('mn-roof-scope') === 'full';
    add(full ? c.full : c.cover, (full ? 'Кровля под ключ: ' : 'Монтаж покрытия: ') + c.label.toLowerCase(),
      calcNum(CALC.querySelector('#mn-roof-area')), 'м²');
  } else {
    var f = CALC_CFG.facade;
    var cl = calcFind(f.claddings, calcPick('mn-fac-clad'));
    var ins = calcFind(f.insulation, calcPick('mn-fac-ins'));
    var a = calcNum(CALC.querySelector('#mn-fac-area'));
    add(cl.key, cl.label, a, 'м²');
    if (cl.frame && CALC.querySelector('[data-frame]').checked) add(cl.frame, rowLabel(cl.frame), a, 'м²');
    ins.keys.forEach(function (k) { add(k, rowLabel(k), a, 'м²'); });
    if (CALC.querySelector('[data-scaffold]').checked) add(f.scaffold, rowLabel(f.scaffold), a, 'м²');
  }

  var pane = CALC.querySelector('.calc-pane[data-pane="' + CALC_MODE + '"]');
  Array.prototype.forEach.call(pane.querySelectorAll('[data-extra]'), function (el) {
    add(el.getAttribute('data-extra'), el.getAttribute('data-label'), calcNum(el), el.getAttribute('data-unit'));
  });
  return lines;
}

function calcQtyText(n) {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

function calcUpdate() {
  if (!CALC) return;
  var full = calcPick('mn-roof-scope') === 'full';

  /* цены на кнопках покрытий и облицовки */
  function chipPrice(name, id, key) {
    var s = CALC.querySelector('input[name="' + name + '"][value="' + id + '"] + span small');
    var n = keyPrice(key);
    if (s) s.textContent = n !== null ? fmt(n) + ' ' + unitText('м²') : '';
  }
  CALC_CFG.roof.coverings.forEach(function (c) { chipPrice('mn-roof-cover', c.id, full ? c.full : c.cover); });
  CALC_CFG.facade.claddings.forEach(function (c) { chipPrice('mn-fac-clad', c.id, c.key); });

  /* подсистема есть не у всякой облицовки: термопанели клеятся на стену */
  var cl = calcFind(CALC_CFG.facade.claddings, calcPick('mn-fac-clad'));
  var fr = CALC.querySelector('[data-frame]');
  fr.disabled = !cl.frame;
  CALC.querySelector('[data-frame-label]').textContent = cl.frame
    ? (PRICE_INDEX[cl.frame] || {}).label || 'Подсистема под облицовку'
    : 'Основание под эту облицовку посчитаем на замере';

  /* термопанели — сами утеплитель: отдельное утепление не предлагаем */
  Array.prototype.forEach.call(CALC.querySelectorAll('input[name="mn-fac-ins"]'), function (el) {
    el.disabled = !!cl.noIns && el.value !== 'none';
    if (cl.noIns && el.value === 'none') el.checked = true;
  });
  CALC.querySelector('[data-ins-hint]').hidden = !cl.noIns;

  var lines = calcLines(), total = 0;
  lines.forEach(function (l) { if (l.sum !== null) total += l.sum; });
  CALC.querySelector('[data-total]').textContent = fmt(total);
  CALC.querySelector('[data-lines]').innerHTML = lines.map(function (l) {
    return '<li><span>' + esc(l.label) + '<small>' + calcQtyText(l.qty) + ' ' + esc(l.unit) +
        (l.price !== null ? ' × ' + fmt(l.price) + ' ' + esc(MN_UNIT) : '') + '</small></span>' +
      '<b>' + (l.sum !== null ? fmt(l.sum) + ' ' + esc(MN_UNIT) : 'по запросу') + '</b></li>';
  }).join('');
}

/* Вызывается из окна карточки перед прокруткой к калькулятору */
function calcPreset(slug, tabId) {
  if (!CALC) return;
  var p = CALC_PRESET[slug] || { mode: tabId === 'fasad' ? 'facade' : 'roof' };
  calcMode(p.mode);
  if (p.pick) {
    var el = CALC.querySelector('input[name="' + p.pick[0] + '"][value="' + p.pick[1] + '"]');
    if (el) el.checked = true;
  }
  if (p.extra) {
    var q = CALC.querySelector('.calc-pane.is-active [data-extra="' + p.extra + '"]');
    if (q && !calcNum(q)) q.value = 1;
  }
  if (p.check) {
    var ch = CALC.querySelector(p.check);
    if (ch) ch.checked = true;
  }
  calcUpdate();
}
