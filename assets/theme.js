/* SteppedIn theme JS: cart, drawers, rotators, countdowns, tabs, size memory,
   quick add, load more and recently viewed. No dependencies. */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var SIZE_KEY = 'si_size';
  var VIEWED_KEY = 'si_viewed';

  var store = {
    get: function (area, k) { try { return window[area].getItem(k); } catch (e) { return null; } },
    set: function (area, k, v) { try { window[area].setItem(k, v); } catch (e) {} }
  };

  function money(cents) {
    var cur = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'GBP';
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: cur }).format(cents / 100);
    } catch (e) { return (cents / 100).toFixed(2); }
  }

  function getSize() { return store.get('sessionStorage', SIZE_KEY) || ''; }
  function setSize(v) {
    store.set('sessionStorage', SIZE_KEY, v || '');
    applySize(document);
    document.dispatchEvent(new CustomEvent('size:change', { detail: { size: v || '' } }));
  }

  var toastTimer;
  function toast(msg) {
    var el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  /* drawers */
  function openDrawer(name) {
    var d = $('[data-drawer="' + name + '"]');
    if (!d) return;
    closeDrawers();
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    var f = $('input,button,a', d.querySelector('.drawer__panel'));
    if (f) setTimeout(function () { f.focus(); }, 60);
  }
  function closeDrawers() {
    $$('.drawer.is-open').forEach(function (d) {
      d.classList.remove('is-open');
      d.setAttribute('aria-hidden', 'true');
    });
    document.documentElement.style.overflow = '';
  }

  /* cart */
  function cartAdd(id, qty) {
    return fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(id), quantity: qty || 1 }] })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (e) { throw new Error(e.description || e.message || 'Could not add to bag'); });
      }
      return res.json();
    });
  }
  function refreshCart() {
    return Promise.all([
      fetch(root + 'cart.js').then(function (r) { return r.json(); }),
      fetch(root + '?section_id=cart-drawer').then(function (r) { return r.text(); })
    ]).then(function (out) {
      var cart = out[0];
      $$('[data-cart-count]').forEach(function (el) {
        el.textContent = cart.item_count;
        el.hidden = cart.item_count === 0;
      });
      var doc = new DOMParser().parseFromString(out[1], 'text/html');
      var next = $('[data-cart-inner]', doc), cur = $('[data-cart-inner]');
      if (next && cur) cur.innerHTML = next.innerHTML;
      return cart;
    });
  }
  function addAndShow(id, qty) {
    return cartAdd(id, qty).then(refreshCart).then(function () {
      if (document.body.getAttribute('data-cart-type') === 'page') {
        window.location.href = root + 'cart';
      } else {
        openDrawer('cart');
      }
    }).catch(function (e) { toast(e.message); });
  }

  /* rotating messages */
  function initRotators(scope) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('[data-rotator]', scope).forEach(function (el) {
      if (el._rot || reduce) return;
      var items = $$('[data-rotator-item]', el);
      if (items.length < 2) return;
      var i = 0, ms = (Number(el.getAttribute('data-interval')) || 4) * 1000;
      el._rot = setInterval(function () {
        items[i].hidden = true;
        i = (i + 1) % items.length;
        items[i].hidden = false;
      }, ms);
    });
  }

  /* countdowns: shown only when Liquid rendered one for a future date */
  function initCountdowns(scope) {
    $$('[data-countdown]', scope).forEach(function (el) {
      if (el._cd) return;
      var end = Date.parse(el.getAttribute('data-countdown'));
      if (isNaN(end)) return;
      function tick() {
        var d = Math.max(0, end - Date.now());
        var p = { d: Math.floor(d / 864e5), h: Math.floor(d % 864e5 / 36e5), m: Math.floor(d % 36e5 / 6e4), s: Math.floor(d % 6e4 / 1e3) };
        Object.keys(p).forEach(function (k) {
          var n = $('[data-cd-' + k + ']', el);
          if (n) n.textContent = String(p[k]).padStart(2, '0');
        });
        if (d === 0) {
          clearInterval(el._cd);
          var wrap = el.closest('[data-countdown-wrap]');
          if (wrap) wrap.hidden = true;
        }
      }
      tick();
      el._cd = setInterval(tick, 1000);
    });
  }

  /* tabs */
  function initTabs(scope) {
    $$('[data-tabs]', scope).forEach(function (rootEl) {
      if (rootEl._tabs) return;
      rootEl._tabs = true;
      var btns = $$('[data-tab-btn]', rootEl), panels = $$('[data-tab-panel]', rootEl);
      function show(i) {
        btns.forEach(function (b, j) { b.classList.toggle('is-on', i === j); b.setAttribute('aria-selected', i === j ? 'true' : 'false'); });
        panels.forEach(function (p, j) { p.hidden = i !== j; });
      }
      btns.forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); });
      show(0);
    });
  }

  /* size memory on cards: highlights chips, shows "N left in your size" */
  function applySize(scope) {
    var size = getSize();
    var threshold = Number(document.body.getAttribute('data-low-stock')) || 3;
    $$('.tile[data-stock]', scope).forEach(function (tile) {
      var stock = {};
      try { stock = JSON.parse(tile.getAttribute('data-stock') || '{}'); } catch (e) {}
      var low = $('[data-low-stock-badge]', tile);
      var known = size && Object.prototype.hasOwnProperty.call(stock, size);
      $$('[data-quick-add][data-size]', tile).forEach(function (b) { b.classList.toggle('is-on', !!size && b.getAttribute('data-size') === size); });
      tile.classList.toggle('is-oos-size', !!known && stock[size] === 0);
      if (!low) return;
      if (known && stock[size] > 0 && stock[size] <= threshold) {
        low.textContent = stock[size] + ' left in your size';
        low.hidden = false;
      } else if (known && stock[size] === 0) {
        low.textContent = 'Not in your size';
        low.hidden = false;
      } else {
        low.hidden = true;
      }
    });
  }

  /* drop hero: choose a size, deep-link the CTA to that variant */
  function pickDropSize(btn) {
    var group = btn.closest('[data-drop-sizes]');
    if (!group) return;
    $$('[data-drop-size]', group).forEach(function (b) { b.classList.toggle('is-on', b === btn); });
    var panel = btn.closest('[data-tab-panel]') || document;
    var cta = $('[data-drop-cta]', panel);
    if (cta) {
      var base = cta.getAttribute('data-base-href') || cta.getAttribute('href');
      cta.setAttribute('href', base + (base.indexOf('?') > -1 ? '&' : '?') + 'variant=' + btn.getAttribute('data-variant-id'));
    }
    var s = btn.getAttribute('data-size');
    if (s) setSize(s);
  }

  /* load more */
  function loadMore(link) {
    var grid = $('[data-grid]');
    if (!grid || link.classList.contains('is-loading')) return;
    link.classList.add('is-loading');
    link.setAttribute('aria-busy', 'true');
    fetch(link.getAttribute('href')).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var nextGrid = $('[data-grid]', doc);
      if (nextGrid) {
        Array.prototype.slice.call(nextGrid.children).forEach(function (c) { grid.appendChild(document.importNode(c, true)); });
      }
      var nextLink = $('[data-load-more]', doc);
      var count = $('[data-grid-count]', doc), curCount = $('[data-grid-count]');
      if (count && curCount) curCount.innerHTML = count.innerHTML;
      if (nextLink) { link.setAttribute('href', nextLink.getAttribute('href')); link.classList.remove('is-loading'); link.removeAttribute('aria-busy'); }
      else { var w = link.closest('[data-load-more-wrap]'); if (w) w.hidden = true; }
      applySize(grid);
    }).catch(function () { window.location.href = link.getAttribute('href'); });
  }

  /* recently viewed */
  function trackViewed() {
    var h = document.body.getAttribute('data-product-handle');
    if (!h) return;
    var list = [];
    try { list = JSON.parse(store.get('localStorage', VIEWED_KEY) || '[]'); } catch (e) {}
    list = [h].concat(list.filter(function (x) { return x !== h; })).slice(0, 12);
    store.set('localStorage', VIEWED_KEY, JSON.stringify(list));
  }
  function renderViewed(scope) {
    $$('[data-recently-viewed]', scope).forEach(function (el) {
      if (el._rv) return;
      el._rv = true;
      var list = [];
      try { list = JSON.parse(store.get('localStorage', VIEWED_KEY) || '[]'); } catch (e) {}
      var current = document.body.getAttribute('data-product-handle');
      var max = Number(el.getAttribute('data-max')) || 8;
      list = list.filter(function (h) { return h !== current; }).slice(0, max);
      var target = $('[data-viewed-list]', el);
      if (!list.length || !target) return;
      Promise.all(list.map(function (h) {
        return fetch(root + 'products/' + encodeURIComponent(h) + '?view=card').then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
      })).then(function (htmls) {
        var any = false;
        htmls.forEach(function (html) {
          if (!html.trim()) return;
          any = true;
          var wrap = document.createElement('div');
          wrap.className = 'rail__item';
          wrap.style.width = '220px';
          wrap.innerHTML = html;
          target.appendChild(wrap);
        });
        if (any) { el.hidden = false; applySize(target); }
      });
    });
  }

  function initAll(scope) {
    scope = scope || document;
    initRotators(scope);
    initCountdowns(scope);
    initTabs(scope);
    applySize(scope);
    renderViewed(scope);
  }

  /* delegated events */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var open = t.closest('[data-drawer-open]');
    if (open) {
      var name = open.getAttribute('data-drawer-open');
      if (name === 'cart' && document.body.getAttribute('data-cart-type') === 'page') return;
      e.preventDefault();
      openDrawer(name);
      return;
    }
    if (t.closest('[data-drawer-close]')) { closeDrawers(); return; }

    var qa = t.closest('[data-quick-add]');
    if (qa) {
      e.preventDefault();
      if (qa.disabled) return;
      var sz = qa.getAttribute('data-size');
      if (sz) setSize(sz);
      qa.disabled = true;
      addAndShow(qa.getAttribute('data-variant-id'), 1).then(function () { qa.disabled = false; });
      return;
    }
    var chg = t.closest('[data-cart-change]');
    if (chg) {
      e.preventDefault();
      fetch(root + 'cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ line: Number(chg.getAttribute('data-line')), quantity: Number(chg.getAttribute('data-qty')) })
      }).then(refreshCart).catch(function () { toast('Could not update your bag'); });
      return;
    }
    var drop = t.closest('[data-drop-size]');
    if (drop && !drop.disabled) { pickDropSize(drop); return; }
    var lm = t.closest('[data-load-more]');
    if (lm) { e.preventDefault(); loadMore(lm); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawers(); });

  document.addEventListener('DOMContentLoaded', function () {
    trackViewed();
    initAll(document);
  });
  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });

  window.SteppedIn = {
    $: $, $$: $$, money: money, store: store, getSize: getSize, setSize: setSize,
    toast: toast, openDrawer: openDrawer, closeDrawers: closeDrawers,
    cartAdd: cartAdd, refreshCart: refreshCart, addAndShow: addAndShow, applySize: applySize
  };
})();
