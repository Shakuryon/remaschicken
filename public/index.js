/* =========================================================
   Remas's Famous Chicken  ·  index.js
   1. Mobile nav
   2. Order builder (reads the mains straight from the menu markup)
   3. Scroll reveal + footer year
   ========================================================= */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (cents) { return '$' + (cents / 100).toFixed(2); };
  var el = function (tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ---------------- 1. Mobile nav ---------------- */
  var navToggle = $('.nav-toggle');
  var nav = $('#site-nav');
  function closeNav() {
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  navToggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', closeNav); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  /* ---------------- 2. Order builder ---------------- */

  // EDIT ME: sides, wing flavors and extras.
  // Mains and their prices are NOT listed here. They come from the menu
  // section in index.html (any <li> with data-main), so there is one place to edit.
  var SIDES = ['Mac & Cheese', 'Collard Greens', 'Candied Yams', 'Green Beans', 'Mashed Potatoes', 'Seasoned Rice', 'Okra'];
  var FLAVORS = ['Buffalo Hot', 'BBQ', 'Honey Hot', 'Honey Gold', 'Lemon Pepper', 'Garlic'];
  var EXTRAS = [
    { id: 'pudding', name: 'Banana Pudding', cents: 666 },
    { id: 'gizzards', name: 'Chicken Gizzards (small)', cents: 777 },
    { id: 'side', name: 'Extra Side', cents: 399 } // TODO: placeholder price, confirm with owner
  ];

  var MAINS = $$('[data-main]').map(function (li) {
    var card = li.closest('[data-cat]');
    return {
      id: li.dataset.main,
      name: li.dataset.name,
      cents: Math.round(parseFloat(li.dataset.price) * 100),
      sides: parseInt(li.dataset.sides || '0', 10),
      flavors: li.dataset.flavors === 'true',
      cat: card ? card.dataset.cat : 'Menu'
    };
  });
  var CATS = MAINS.reduce(function (list, m) {
    if (list.indexOf(m.cat) === -1) list.push(m.cat);
    return list;
  }, []);

  var state = { cat: CATS[0], main: null, sides: [], flavor: null, extras: [], qty: 1 };
  var order = [];

  var catChips = $('#cat-chips');
  var mainOpts = $('#main-opts');
  var sidesBox = $('#sides-box');
  var sidesNote = $('#sides-note');
  var sidesOpts = $('#sides-opts');
  var flavorBox = $('#flavor-box');
  var flavorOpts = $('#flavor-opts');
  var plainNote = $('#plain-note');
  var idleNote = $('#step2-idle');
  var extrasOpts = $('#extras-opts');
  var qtyNum = $('#qty-num');
  var addBtn = $('#add-btn');
  var hint = $('#hint');
  var ticketCount = $('#ticket-count');
  var ticketLines = $('#ticket-lines');
  var ticketEmpty = $('#ticket-empty');
  var subtotalEl = $('#subtotal');
  var copyBtn = $('#copy-btn');

  function optButton(cls, label, value, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.dataset.value = value;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () { onClick(value); });
    return b;
  }

  function buildCats() {
    CATS.forEach(function (cat) {
      catChips.appendChild(optButton('opt opt--cat', cat, cat, function (value) {
        state.cat = value;
        buildMains();
        sync();
      }));
    });
  }

  function buildMains() {
    mainOpts.innerHTML = '';
    MAINS.filter(function (m) { return m.cat === state.cat; }).forEach(function (m) {
      var b = el('button', 'main-opt');
      b.type = 'button';
      b.dataset.value = m.id;
      b.setAttribute('aria-pressed', 'false');
      b.appendChild(el('span', 'main-opt-name', m.name));
      var meta = m.sides ? 'Pick ' + m.sides + ' sides' : (m.flavors ? 'Pick a flavor' : '');
      if (meta) b.appendChild(el('span', 'main-opt-meta', meta));
      b.appendChild(el('span', 'main-opt-price', money(m.cents)));
      b.addEventListener('click', function () { selectMain(m.id); });
      mainOpts.appendChild(b);
    });
  }

  function buildStatic() {
    SIDES.forEach(function (name) {
      sidesOpts.appendChild(optButton('opt', name, name, toggleSide));
    });
    FLAVORS.forEach(function (name) {
      flavorOpts.appendChild(optButton('opt', name, name, function (value) {
        state.flavor = state.flavor === value ? null : value;
        sync();
      }));
    });
    EXTRAS.forEach(function (x) {
      extrasOpts.appendChild(optButton('opt', '+ ' + x.name + ' ' + money(x.cents), x.id, function (value) {
        var i = state.extras.indexOf(value);
        if (i === -1) state.extras.push(value); else state.extras.splice(i, 1);
        sync();
      }));
    });
  }

  function selectMain(id) {
    var picked = MAINS.filter(function (m) { return m.id === id; })[0];
    if (!picked) return;
    state.main = state.main && state.main.id === id ? null : picked;
    state.sides = [];
    state.flavor = null;
    sync();
  }

  function toggleSide(name) {
    var i = state.sides.indexOf(name);
    if (i !== -1) state.sides.splice(i, 1);
    else if (state.main && state.sides.length < state.main.sides) state.sides.push(name);
    sync();
  }

  function unitCents() {
    if (!state.main) return 0;
    return state.extras.reduce(function (sum, id) {
      var x = EXTRAS.filter(function (e) { return e.id === id; })[0];
      return sum + (x ? x.cents : 0);
    }, state.main.cents);
  }

  function press(container, isOn) {
    $$('button', container).forEach(function (b) {
      b.setAttribute('aria-pressed', String(isOn(b.dataset.value)));
    });
  }

  function sync() {
    var main = state.main;

    press(catChips, function (v) { return v === state.cat; });
    press(mainOpts, function (v) { return !!main && v === main.id; });
    press(sidesOpts, function (v) { return state.sides.indexOf(v) !== -1; });
    press(flavorOpts, function (v) { return v === state.flavor; });
    press(extrasOpts, function (v) { return state.extras.indexOf(v) !== -1; });

    var needsSides = !!main && main.sides > 0;
    var needsFlavor = !!main && main.flavors;
    idleNote.hidden = !!main;
    sidesBox.hidden = !needsSides;
    flavorBox.hidden = !needsFlavor;
    plainNote.hidden = !main || needsSides || needsFlavor;

    if (needsSides) {
      var full = state.sides.length >= main.sides;
      sidesNote.textContent = 'Comes with ' + main.sides + ' sides. ' + state.sides.length + ' of ' + main.sides + ' picked.';
      $$('button', sidesOpts).forEach(function (b) {
        b.disabled = full && state.sides.indexOf(b.dataset.value) === -1;
      });
    }

    qtyNum.textContent = String(state.qty);
    addBtn.disabled = !main;

    if (!main) {
      hint.textContent = 'Pick a main to start.';
    } else {
      var msg = state.qty + ' x ' + main.name + ' comes to ' + money(unitCents() * state.qty) + '.';
      if (needsSides && state.sides.length < main.sides) {
        var left = main.sides - state.sides.length;
        msg += ' Pick ' + left + ' more side' + (left === 1 ? '' : 's') + ', or tell us on the phone.';
      }
      if (needsFlavor && !state.flavor) msg += ' Pick a flavor, or tell us on the phone.';
      hint.textContent = msg;
    }
  }

  function addLine() {
    if (!state.main) return;
    var detail = state.main.flavors ? (state.flavor || '') : state.sides.join(', ');
    var extras = state.extras.map(function (id) {
      return EXTRAS.filter(function (e) { return e.id === id; })[0].name;
    }).join(', ');

    order.push({
      name: state.main.name,
      detail: detail,
      extras: extras,
      qty: state.qty,
      cents: unitCents() * state.qty
    });

    state.main = null;
    state.sides = [];
    state.flavor = null;
    state.extras = [];
    state.qty = 1;
    sync();
    renderTicket();
  }

  function renderTicket() {
    ticketLines.innerHTML = '';

    order.forEach(function (item, index) {
      var row = el('div', 'line');
      var info = el('div', 'line-info');
      info.appendChild(el('span', 'line-name', (item.qty > 1 ? item.qty + ' x ' : '') + item.name));
      if (item.detail) info.appendChild(el('span', 'line-detail', item.detail));
      if (item.extras) info.appendChild(el('span', 'line-extras', 'Add: ' + item.extras));

      var side = el('div', 'line-side');
      side.appendChild(el('span', 'line-price', money(item.cents)));
      var remove = el('button', 'line-remove', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + item.name);
      remove.addEventListener('click', function () {
        order.splice(index, 1);
        renderTicket();
      });
      side.appendChild(remove);

      row.appendChild(info);
      row.appendChild(side);
      ticketLines.appendChild(row);
    });

    var count = order.reduce(function (n, item) { return n + item.qty; }, 0);
    var total = order.reduce(function (n, item) { return n + item.cents; }, 0);
    ticketCount.textContent = count + (count === 1 ? ' item' : ' items');
    subtotalEl.textContent = money(total);
    ticketEmpty.hidden = order.length > 0;
    copyBtn.disabled = order.length === 0;
  }

  function orderText() {
    var lines = ["Order for Remas's Famous Chicken", ''];
    order.forEach(function (item) {
      var line = item.qty + ' x ' + item.name;
      if (item.detail) line += ' (' + item.detail + ')';
      if (item.extras) line += ' + ' + item.extras;
      lines.push(line + ' - ' + money(item.cents));
    });
    var total = order.reduce(function (n, item) { return n + item.cents; }, 0);
    lines.push('', 'Subtotal before tax: ' + money(total));
    return lines.join('\n');
  }

  function copyOrder() {
    if (!order.length) return;
    var text = orderText();
    var done = function (ok) {
      copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(function () { copyBtn.textContent = 'Copy order'; }, 2000);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }

  $('#qty-down').addEventListener('click', function () { state.qty = Math.max(1, state.qty - 1); sync(); });
  $('#qty-up').addEventListener('click', function () { state.qty = Math.min(20, state.qty + 1); sync(); });
  addBtn.addEventListener('click', addLine);
  copyBtn.addEventListener('click', copyOrder);

  // "Add to order" buttons on the favorites cards jump into the builder
  $$('[data-pick]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var picked = MAINS.filter(function (m) { return m.id === btn.dataset.pick; })[0];
      if (!picked) return;
      state.cat = picked.cat;
      buildMains();
      state.main = null;
      selectMain(picked.id);
      $('#order').scrollIntoView();
    });
  });

  buildCats();
  buildMains();
  buildStatic();
  sync();
  renderTicket();

  /* ---------------- 3. Scroll reveal + year ---------------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (node) { io.observe(node); });
  } else {
    reveals.forEach(function (node) { node.classList.add('in'); });
  }

  $('#year').textContent = String(new Date().getFullYear());
})();
