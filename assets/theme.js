/* Stepped In — theme.js
 * Framework-free. Interactive pieces are Custom Elements so they re-initialise
 * automatically when sections are added/reloaded in the theme editor.
 */
(() => {
  'use strict';

  const T = (window.theme = window.theme || { routes: {}, strings: {}, cartType: 'drawer' });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */
  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 4500);
  }

  /* ------------------------------------------------------------------ *
   * Drawers & modals
   * ------------------------------------------------------------------ */
  let activePanel = null;
  let lastFocus = null;

  function lockBody(on) { document.body.classList.toggle('is-locked', on); }

  function openPanel(el) {
    if (!el) return;
    if (activePanel && activePanel !== el) closePanel(true);
    lastFocus = document.activeElement;
    el.classList.add('is-open');
    if (el.hasAttribute('data-drawer')) { const o = $('[data-overlay]'); if (o) o.classList.add('is-open'); }
    lockBody(true);
    activePanel = el;
    const target = el.querySelector('[data-search-input],[data-country-filter]') || el.querySelector(FOCUSABLE);
    requestAnimationFrame(() => target && target.focus({ preventScroll: true }));
    document.dispatchEvent(new CustomEvent('panel:open', { detail: { id: el.id } }));
  }

  function closePanel(keepFocus) {
    if (!activePanel) return;
    activePanel.classList.remove('is-open');
    const o = $('[data-overlay]'); if (o) o.classList.remove('is-open');
    lockBody(false);
    const prev = lastFocus;
    activePanel = null;
    if (!keepFocus && prev && prev.focus) prev.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const openD = e.target.closest('[data-open-drawer]');
    if (openD) { e.preventDefault(); openPanel(document.getElementById(openD.dataset.openDrawer)); return; }
    const openM = e.target.closest('[data-open-modal]');
    if (openM) { e.preventDefault(); openPanel(document.getElementById(openM.dataset.openModal)); return; }
    if (e.target.closest('[data-close-drawer],[data-close-modal]')) {
      // Links that also close the panel (e.g. "Clear") must still navigate.
      const link = e.target.closest('a[href]');
      if (!link) e.preventDefault();
      closePanel();
      return;
    }
    if (e.target.matches('[data-overlay]')) closePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePanel) { closePanel(); return; }
    if (e.key === 'Tab' && activePanel) {
      const items = $$(FOCUSABLE, activePanel).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------------------ *
   * Header: sticky offset + mega menu
   * ------------------------------------------------------------------ */
  function syncHeaderHeight() {
    const header = $('site-header');
    if (!header) return;
    const wrap = header.closest('.shopify-section') || header;
    const sticky = getComputedStyle(wrap).position === 'sticky';
    document.documentElement.style.setProperty('--header-h', sticky ? wrap.offsetHeight + 'px' : '0px');
  }
  window.addEventListener('resize', debounce(syncHeaderHeight, 100));
  window.addEventListener('load', syncHeaderHeight);
  document.addEventListener('DOMContentLoaded', syncHeaderHeight);

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      this.triggers = $$('[data-mega-trigger]', this);
      this.current = null;
      this.triggers.forEach((t) => {
        t.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover)').matches) this.open(t); });
        t.addEventListener('click', () => (this.current === t ? this.close() : this.open(t)));
      });
      this.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) this.close(); });
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.current) { const t = this.current; this.close(); t.focus(); } });
      this.addEventListener('focusout', (e) => { if (this.current && !this.contains(e.relatedTarget)) this.close(); });
      syncHeaderHeight();
    }
    open(trigger) {
      this.close();
      const panel = document.getElementById(trigger.dataset.megaTrigger);
      if (!panel) return;
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      this.current = trigger;
    }
    close() {
      this.triggers.forEach((t) => {
        t.setAttribute('aria-expanded', 'false');
        const p = document.getElementById(t.dataset.megaTrigger);
        if (p) p.hidden = true;
      });
      this.current = null;
    }
  }
  customElements.define('site-header', SiteHeader);

  /* ------------------------------------------------------------------ *
   * Announcement bar
   * ------------------------------------------------------------------ */
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.msgs = $$('[data-msg]', this);
      this.i = 0;
      const prev = $('[data-prev]', this), next = $('[data-next]', this);
      if (prev) prev.addEventListener('click', () => this.go(this.i - 1));
      if (next) next.addEventListener('click', () => this.go(this.i + 1));
      const ms = parseInt(this.dataset.autoplay, 10);
      if (ms && this.msgs.length > 1 && !reducedMotion()) {
        const start = () => { this.timer = setInterval(() => this.go(this.i + 1), ms); };
        const stop = () => clearInterval(this.timer);
        start();
        this.addEventListener('mouseenter', stop);
        this.addEventListener('mouseleave', () => { stop(); start(); });
        this.addEventListener('focusin', stop);
      }
    }
    disconnectedCallback() { clearInterval(this.timer); }
    go(n) {
      const len = this.msgs.length;
      this.i = (n + len) % len;
      this.msgs.forEach((m, k) => { m.hidden = k !== this.i; });
    }
  }
  customElements.define('announcement-bar', AnnouncementBar);

  /* ------------------------------------------------------------------ *
   * Hero slider
   * ------------------------------------------------------------------ */
  class HeroSlider extends HTMLElement {
    connectedCallback() {
      this.track = $('[data-track]', this);
      this.slides = $$('[data-slide]', this);
      this.bars = $$('[data-go]', this);
      this.counter = $('[data-counter]', this);
      this.controls = $('[data-controls]', this);
      this.badge = $('[data-badge]', this);
      this.i = 0;
      const prev = $('[data-prev]', this), next = $('[data-next]', this);
      if (prev) prev.addEventListener('click', () => { this.go(this.i - 1); this.restart(); });
      if (next) next.addEventListener('click', () => { this.go(this.i + 1); this.restart(); });
      this.bars.forEach((b) => b.addEventListener('click', () => { this.go(+b.dataset.go); this.restart(); }));
      let x0 = null;
      this.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      this.addEventListener('touchend', (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) { this.go(this.i + (dx < 0 ? 1 : -1)); this.restart(); }
      });
      this.ms = parseInt(this.dataset.autoplay, 10) || 0;
      if (this.ms && this.slides.length > 1 && !reducedMotion()) {
        this.addEventListener('mouseenter', () => this.stop());
        this.addEventListener('mouseleave', () => this.start());
        this.addEventListener('focusin', () => this.stop());
        this.addEventListener('focusout', () => this.start());
        this.start();
      }
      this.go(0);
    }
    disconnectedCallback() { this.stop(); }
    start() { this.stop(); if (this.ms) this.timer = setInterval(() => this.go(this.i + 1), this.ms); }
    stop() { clearInterval(this.timer); }
    restart() { if (this.ms && this.timer) this.start(); }
    go(n) {
      const len = this.slides.length;
      if (!len) return;
      this.i = (n + len) % len;
      this.track.style.transform = `translateX(${-100 * this.i}%)`;
      this.slides.forEach((s, k) => {
        const active = k === this.i;
        s.setAttribute('aria-hidden', active ? 'false' : 'true');
        $$('[data-focusable]', s).forEach((a) => { a.tabIndex = active ? 0 : -1; });
      });
      this.bars.forEach((b, k) => { if (k === this.i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      if (this.counter) this.counter.textContent = String(this.i + 1).padStart(2, '0') + ' / ' + String(len).padStart(2, '0');
      const color = getComputedStyle(this.slides[this.i]).color;
      if (this.controls) this.controls.style.color = color;
      if (this.badge) this.badge.style.color = color;
    }
  }
  customElements.define('hero-slider', HeroSlider);

  /* ------------------------------------------------------------------ *
   * Product tabs
   * ------------------------------------------------------------------ */
  class ProductTabs extends HTMLElement {
    connectedCallback() {
      this.tabs = $$('[data-tab]', this);
      this.tabs.forEach((t, i) => {
        t.addEventListener('click', () => this.select(i));
        t.addEventListener('keydown', (e) => {
          const map = { ArrowRight: 1, ArrowLeft: -1 };
          if (map[e.key]) { e.preventDefault(); this.select((i + map[e.key] + this.tabs.length) % this.tabs.length, true); }
          if (e.key === 'Home') { e.preventDefault(); this.select(0, true); }
          if (e.key === 'End') { e.preventDefault(); this.select(this.tabs.length - 1, true); }
        });
      });
    }
    select(n, focus) {
      this.tabs.forEach((t, i) => {
        const on = i === n;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
        if (on && focus) t.focus();
      });
    }
  }
  customElements.define('product-tabs', ProductTabs);

  /* ------------------------------------------------------------------ *
   * Product card gallery
   * ------------------------------------------------------------------ */
  class CardGallery extends HTMLElement {
    connectedCallback() {
      this.track = $('[data-track]', this);
      this.dots = $$('[data-dot]', this);
      if (!this.track || this.dots.length < 2) return;
      const prev = $('[data-prev]', this), next = $('[data-next]', this);
      const step = (d) => this.track.scrollBy({ left: d * this.track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
      if (prev) prev.addEventListener('click', (e) => { e.preventDefault(); step(-1); });
      if (next) next.addEventListener('click', (e) => { e.preventDefault(); step(1); });
      this.dots.forEach((d) => d.addEventListener('click', (e) => {
        e.preventDefault();
        this.track.scrollTo({ left: +d.dataset.dot * this.track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }));
      this.track.addEventListener('scroll', () => {
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(() => {
          const i = Math.round(this.track.scrollLeft / (this.track.clientWidth || 1));
          this.dots.forEach((d, k) => { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
        });
      }, { passive: true });
    }
  }
  customElements.define('card-gallery', CardGallery);

  /* ------------------------------------------------------------------ *
   * Wishlist (localStorage)
   * ------------------------------------------------------------------ */
  const WL_KEY = 'steppedin:wishlist';
  const wlRead = () => { try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch (e) { return []; } };
  const wlWrite = (list) => { try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ } };
  function syncWishlist(root = document) {
    const list = wlRead();
    $$('[data-wishlist]', root).forEach((b) => b.setAttribute('aria-pressed', list.includes(b.dataset.wishlist) ? 'true' : 'false'));
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wishlist]');
    if (!b) return;
    e.preventDefault();
    const h = b.dataset.wishlist;
    let list = wlRead();
    list = list.includes(h) ? list.filter((x) => x !== h) : list.concat(h);
    wlWrite(list);
    syncWishlist();
  });
  document.addEventListener('DOMContentLoaded', () => syncWishlist());

  /* ------------------------------------------------------------------ *
   * Cart
   * ------------------------------------------------------------------ */
  const cartCountEls = () => $$('[data-cart-count]');

  function renderDrawer(html) {
    if (!html) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const src = $('[data-cart-inner]', doc);
    const dst = $('#cart-drawer [data-cart-inner]');
    if (src && dst) dst.innerHTML = src.innerHTML;
  }

  async function refreshCartCount() {
    try {
      const res = await fetch(T.routes.cart + '.js', { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      cartCountEls().forEach((el) => { el.textContent = cart.item_count; el.dataset.empty = cart.item_count === 0 ? 'true' : 'false'; });
      return cart;
    } catch (e) { return null; }
  }

  async function refreshCartPage() {
    const holder = $('[data-main-cart]');
    if (!holder) return;
    const res = await fetch(location.href, { headers: { Accept: 'text/html' } });
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const fresh = $('[data-main-cart]', doc);
    if (fresh) holder.innerHTML = fresh.innerHTML;
  }

  async function afterCartChange(sections) {
    if (sections && sections['cart-drawer']) renderDrawer(sections['cart-drawer']);
    await Promise.all([refreshCartCount(), refreshCartPage()]);
  }

  async function addToCart(body, asForm) {
    let init;
    if (asForm) {
      body.append('sections', 'cart-drawer');
      body.append('sections_url', location.pathname);
      init = { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' }, body };
    } else {
      init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [body], sections: 'cart-drawer', sections_url: location.pathname })
      };
    }
    const res = await fetch(T.routes.cartAdd + '.js', init);
    const json = await res.json();
    if (!res.ok || json.status) throw new Error(json.description || json.message || T.strings.error);
    await afterCartChange(json.sections);
    if (T.cartType === 'drawer' && T.template !== 'cart') openPanel($('#cart-drawer'));
    else if (T.template !== 'cart') window.location.href = T.routes.cart;
    return json;
  }
  window.theme.addToCart = addToCart;

  async function changeLine(key, quantity) {
    const holder = $('#cart-drawer [data-cart-inner]');
    const page = $('[data-main-cart]');
    [holder, page].forEach((h) => h && h.classList.add('cart-loading'));
    try {
      const res = await fetch(T.routes.cartChange + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: key, quantity, sections: 'cart-drawer', sections_url: location.pathname })
      });
      const json = await res.json();
      if (!res.ok || json.status) throw new Error(json.description || json.message || T.strings.error);
      await afterCartChange(json.sections);
    } catch (err) {
      toast(err.message || T.strings.error);
    } finally {
      [$('#cart-drawer [data-cart-inner]'), $('[data-main-cart]')].forEach((h) => h && h.classList.remove('cart-loading'));
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cart-change]');
    if (!b) return;
    e.preventDefault();
    changeLine(b.dataset.cartChange, parseInt(b.dataset.qty, 10));
  });

  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-cart-note]')) return;
    fetch(T.routes.cartUpdate + '.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: e.target.value }) });
  });

  // Quick add from product cards
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-quick-add]');
    if (!b || b.disabled) return;
    e.preventDefault();
    const label = b.textContent;
    b.disabled = true;
    if (b.classList.contains('card__add')) b.textContent = T.strings.adding;
    try {
      await addToCart({ id: parseInt(b.dataset.quickAdd, 10), quantity: 1 }, false);
      if (b.classList.contains('card__add')) { b.textContent = T.strings.added; setTimeout(() => { b.textContent = label; }, 1600); }
    } catch (err) {
      toast(err.message || T.strings.error);
      b.textContent = label;
    } finally {
      b.disabled = false;
    }
  });

  /* ------------------------------------------------------------------ *
   * Predictive search
   * ------------------------------------------------------------------ */
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      this.input = $('[data-search-input]', this);
      this.results = $('[data-predictive-results]', this);
      if (!this.input) return;
      this.input.addEventListener('input', debounce(() => this.run(), 220));
      $$('[data-term]', this).forEach((b) => b.addEventListener('click', () => {
        this.input.value = b.dataset.term;
        this.input.focus();
        this.run();
      }));
    }
    async run() {
      const q = this.input.value.trim();
      if (!q) { this.results.innerHTML = ''; return; }
      if (this.ctrl) this.ctrl.abort();
      this.ctrl = new AbortController();
      try {
        const url = `${T.routes.predictiveSearch}?q=${encodeURIComponent(q)}&section_id=predictive-search&resources[type]=product,collection,page,article&resources[limit]=6`;
        const res = await fetch(url, { signal: this.ctrl.signal });
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const out = $('[data-predictive]', doc);
        this.results.innerHTML = out ? out.innerHTML : '';
      } catch (err) { /* aborted or offline */ }
    }
  }
  customElements.define('predictive-search', PredictiveSearch);

  /* ------------------------------------------------------------------ *
   * Country selector
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-country]');
    if (!b) return;
    const form = b.closest('form');
    const input = form && $('[data-country-input]', form);
    if (!form || !input) return;
    input.value = b.dataset.country;
    form.submit();
  });
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-country-filter]')) return;
    const q = e.target.value.trim().toLowerCase();
    const modal = e.target.closest('[data-modal]');
    let shown = 0;
    $$('[data-country-row]', modal).forEach((row) => {
      const hit = !q || row.dataset.name.includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    });
    let empty = $('[data-country-empty]', modal);
    if (!shown) {
      if (!empty) {
        empty = document.createElement('p');
        empty.dataset.countryEmpty = '';
        empty.style.padding = '8px 24px 24px';
        empty.textContent = T.strings.noCountryResults;
        $('.country-list', modal).after(empty);
      }
    } else if (empty) empty.remove();
  });

  /* ------------------------------------------------------------------ *
   * Read more (collection description)
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-read-more]');
    if (!b) return;
    const el = document.getElementById(b.getAttribute('aria-controls'));
    const open = b.getAttribute('aria-expanded') === 'true';
    if (el) el.classList.toggle('is-clamped', open);
    b.setAttribute('aria-expanded', open ? 'false' : 'true');
    b.textContent = open ? b.dataset.more : b.dataset.less;
  });

  /* ------------------------------------------------------------------ *
   * Collection filtering (Storefront Filtering API, no page reload)
   * ------------------------------------------------------------------ */
  class CollectionFilters extends HTMLElement {
    connectedCallback() {
      this.onChange = debounce((e) => this.fromForm(e), 280);
      this.addEventListener('input', (e) => { if (e.target.closest('[data-filters-form]')) this.onChange(e); });
      this.addEventListener('change', (e) => {
        if (e.target.matches('[data-sort]')) this.fromForm(e);
      });
      this.onClick = (e) => {
        const lm = e.target.closest('[data-load-more-btn]'); if (lm && this.contains(lm)) { e.preventDefault(); this.loadMore(lm); return; } const link = e.target.closest('[data-filter-link]');
        if (link && link.href) { e.preventDefault(); this.apply(link.href); return; }
        const page = e.target.closest('.pagination a');
        if (page && this.contains(page)) { e.preventDefault(); this.apply(page.href, true); }
      };
      document.addEventListener('click', this.onClick);
      this.onPop = () => this.apply(location.href, false, false);
      window.addEventListener('popstate', this.onPop); this.rows = 4; this.onResize = debounce(() => this.layoutGrid(), 120); window.addEventListener('resize', this.onResize); this.layoutGrid();
    }
    disconnectedCallback() {
      document.removeEventListener('click', this.onClick);
      window.removeEventListener('popstate', this.onPop); window.removeEventListener('resize', this.onResize);
    }
    fromForm() {
      const form = $('[data-filters-form]', this);
      const sort = $('[data-sort]', this);
      const params = new URLSearchParams();
      if (form) {
        new FormData(form).forEach((v, k) => { if (v !== '' && k !== 'sort_by') params.append(k, v); });
      } else {
        new URLSearchParams(location.search).forEach((v, k) => { if (k.startsWith('filter.')) params.append(k, v); });
      }
      if (sort && sort.value !== sort.dataset.default) params.set('sort_by', sort.value);
      else if (!sort && new URLSearchParams(location.search).get('sort_by')) params.set('sort_by', new URLSearchParams(location.search).get('sort_by'));
      const qs = params.toString();
      this.apply(location.pathname + (qs ? '?' + qs : ''));
    }
    async apply(url, scrollTop, push = true) {
      const results = $('[data-collection-swap="results"]', this);
      if (results) results.classList.add('is-loading');
      const focus = this.rememberFocus();
      try {
        const res = await fetch(url, { headers: { Accept: 'text/html' } });
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        $$('[data-collection-swap]').forEach((node) => {
          const fresh = $(`[data-collection-swap="${node.dataset.collectionSwap}"]`, doc);
          if (fresh) node.innerHTML = fresh.innerHTML;
        });
        if (push) history.pushState({}, '', url); this.rows = 4; this.layoutGrid();
        syncWishlist(this);
        this.restoreFocus(focus);
        if (scrollTop) {
          const t = $('.toolbar', this);
          if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 0), behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      } catch (err) {
        window.location.href = url;
      } finally {
        const r = $('[data-collection-swap="results"]', this);
        if (r) r.classList.remove('is-loading');
      }
    }
    cols(grid) { const v = getComputedStyle(grid).gridTemplateColumns; if (v && v !== 'none') return v.split(' ').filter(Boolean).length; return matchMedia('(max-width:749px)').matches ? 2 : 4; } cards(grid) { return $$(':scope > .card', grid); } layoutGrid() { const grid = $('[data-collection-swap="results"] .grid-products', this); if (!grid) return; const cards = this.cards(grid); const show = (this.rows || 4) * this.cols(grid); cards.forEach((c, i) => { c.hidden = i >= show; }); this.setAttribute('data-grid-ready', ''); const box = $('[data-load-more]', this); if (!box) return; const shown = Math.min(show, cards.length); const total = +box.dataset.total || cards.length; const done = (+box.dataset.offset || 0) + shown; const bar = $('[data-load-more-bar]', box); if (bar) bar.style.width = Math.min(100, (done / total) * 100) + '%'; const cnt = $('[data-load-more-count]', box); if (cnt) cnt.textContent = 'Showing ' + done + ' of ' + total + ' items'; const btn = $('[data-load-more-btn]', box); if (btn) btn.hidden = !(shown < cards.length || box.dataset.nextUrl); } async loadMore(btn) { if (this.loading) return; const grid = $('[data-collection-swap="results"] .grid-products', this); const box = $('[data-load-more]', this); if (!grid || !box) return; const need = ((this.rows || 4) + 4) * this.cols(grid); if (this.cards(grid).length < need && box.dataset.nextUrl) { this.loading = true; btn.disabled = true; try { while (this.cards(grid).length < need && box.dataset.nextUrl) { const res = await fetch(box.dataset.nextUrl, { headers: { Accept: 'text/html' } }); const doc = new DOMParser().parseFromString(await res.text(), 'text/html'); const g2 = $('[data-collection-swap="results"] .grid-products', doc); const b2 = $('[data-load-more]', doc); if (!g2) { delete box.dataset.nextUrl; break; } $$(':scope > .card', g2).forEach((c) => grid.appendChild(document.importNode(c, true))); if (b2 && b2.dataset.nextUrl) box.dataset.nextUrl = b2.dataset.nextUrl; else delete box.dataset.nextUrl; } } catch (err) { window.location.href = box.dataset.nextUrl || location.href; return; } finally { this.loading = false; btn.disabled = false; } } this.rows = (this.rows || 4) + 4; this.layoutGrid(); syncWishlist(this); } rememberFocus() {
      const a = document.activeElement;
      if (!a || !this.contains(a) || !a.name) return null;
      return { name: a.name, value: a.value, type: a.type, pos: a.selectionStart };
    }
    restoreFocus(f) {
      if (!f) return;
      const sel = f.type === 'checkbox' || f.type === 'radio' ? `[name="${CSS.escape(f.name)}"][value="${CSS.escape(f.value)}"]` : `[name="${CSS.escape(f.name)}"]`;
      const el = $(sel, this);
      if (el) { el.focus({ preventScroll: true }); try { if (f.pos != null) el.setSelectionRange(f.pos, f.pos); } catch (e) { /* not a text input */ } }
    }
  }
  customElements.define('collection-filters', CollectionFilters);

  /* ------------------------------------------------------------------ *
   * Product recommendations (loaded lazily)
   * ------------------------------------------------------------------ */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url) return;
      const load = async () => {
        try {
          const res = await fetch(this.dataset.url);
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          const fresh = $('product-recommendations', doc);
          if (fresh && fresh.innerHTML.trim()) { this.innerHTML = fresh.innerHTML; syncWishlist(this); }
        } catch (e) { /* leave empty */ }
      };
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver((entries) => {
          if (entries.some((en) => en.isIntersecting)) { this.io.disconnect(); load(); }
        }, { rootMargin: '400px' });
        this.io.observe(this);
      } else load();
    }
    disconnectedCallback() { if (this.io) this.io.disconnect(); }
  }
  customElements.define('product-recommendations', ProductRecommendations);

  /* ------------------------------------------------------------------ *
   * Product gallery + lightbox
   * ------------------------------------------------------------------ */
  class ProductGallery extends HTMLElement {
    connectedCallback() {
      this.track = $('[data-track]', this);
      this.slides = $$('[data-slide]', this);
      this.thumbs = $$('[data-thumb]', this);
      this.dots = $$('[data-dot]', this);
      this.index = 0;
      const prev = $('[data-prev]', this), next = $('[data-next]', this);
      if (prev) prev.addEventListener('click', () => this.goTo(this.index - 1));
      if (next) next.addEventListener('click', () => this.goTo(this.index + 1));
      this.thumbs.forEach((t) => t.addEventListener('click', () => this.goTo(+t.dataset.thumb)));
      this.dots.forEach((d) => d.addEventListener('click', () => this.goTo(+d.dataset.dot)));
      this.track.addEventListener('scroll', () => {
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(() => this.sync(Math.round(this.track.scrollLeft / (this.track.clientWidth || 1))));
      }, { passive: true });
      this.track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.goTo(this.index + 1);
        if (e.key === 'ArrowLeft') this.goTo(this.index - 1);
      });
      const zoom = $('[data-zoom]', this);
      if (zoom) zoom.addEventListener('click', () => this.dispatchEvent(new CustomEvent('gallery:zoom', { bubbles: true, detail: { index: this.index } })));
      this.slides.forEach((s, i) => s.addEventListener('click', (e) => {
        if (s.dataset.zoomSrc && !e.target.closest('video,model-viewer,iframe')) this.dispatchEvent(new CustomEvent('gallery:zoom', { bubbles: true, detail: { index: i } }));
      }));
      const initial = this.dataset.initial;
      if (initial) this.showMedia(initial, true);
      this.sync(this.index);
    }
    goTo(i, instant) {
      const len = this.slides.length;
      if (!len) return;
      const n = (i + len) % len;
      this.track.style.scrollBehavior = instant || reducedMotion() ? 'auto' : '';
      this.track.scrollTo({ left: n * this.track.clientWidth });
      if (instant) this.sync(n);
    }
    showMedia(id, instant) {
      const i = this.slides.findIndex((s) => s.dataset.mediaId === String(id));
      if (i >= 0 && i !== this.index) this.goTo(i, instant);
    }
    sync(i) {
      this.index = Math.max(0, Math.min(i, this.slides.length - 1));
      this.thumbs.forEach((t, k) => { if (k === this.index) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
      this.dots.forEach((d, k) => { if (k === this.index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      const active = this.thumbs[this.index];
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  customElements.define('product-gallery', ProductGallery);

  /* ------------------------------------------------------------------ *
   * Product page: variants, add to bag, sticky bar, lightbox, delivery
   * ------------------------------------------------------------------ */
  class ProductPage extends HTMLElement {
    connectedCallback() {
      this.data = JSON.parse($('[data-product-json]', this).textContent);
      this.str = JSON.parse($('[data-product-strings]', this).textContent);
      this.form = $('[data-product-form]', this);
      this.gallery = $('product-gallery', this);
      this.idInput = $('[data-variant-id]', this);
      this.addBtn = $('[data-add-button]', this);
      this.addLabel = $('[data-add-label]', this);
      this.qtyInput = $('[data-qty-input]', this);
      this.errorEl = $('[data-form-error]', this);
      this.optError = $('[data-option-error]', this);
      this.stockEl = $('[data-stock-status]', this);
      this.checkout = $('[data-dynamic-checkout]', this);
      this.sticky = $('[data-sticky-bar]', this);
      this.requireSel = this.dataset.requireSelection === 'true';
      this.updateUrl = this.dataset.updateUrl === 'true';
      this.inputs = $$('[data-option-input]', this);
      this.selected = this.data.options.map(() => null);
      if (!this.inputs.length && this.data.variants.length === 1) this.selected = this.data.variants[0].options.slice();
      this.inputs.forEach((i) => {
        if (i.checked) this.selected[+i.dataset.position - 1] = i.value;
        i.addEventListener('change', () => {
          this.selected[+i.dataset.position - 1] = i.value;
          if (this.optError) this.optError.hidden = true;
          this.refresh();
        });
      });

      // quantity
      const minus = $('[data-qty-minus]', this), plus = $('[data-qty-plus]', this);
      if (minus) minus.addEventListener('click', () => this.setQty(this.qty() - 1));
      if (plus) plus.addEventListener('click', () => this.setQty(this.qty() + 1));
      if (this.qtyInput) this.qtyInput.addEventListener('change', () => this.setQty(this.qty()));

      if (this.form) this.form.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });

      this.initSticky();
      this.initLightbox();
      this.initDelivery();
      this.refresh(true);
    }

    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      clearInterval(this.deliveryTimer);
      document.removeEventListener('keydown', this.lbKey);
    }

    qty() { return Math.max(1, parseInt(this.qtyInput && this.qtyInput.value, 10) || 1); }
    setQty(n) {
      const v = this.variant();
      let max = v && v.inventory != null ? Math.max(1, v.inventory) : 999;
      this.qtyInput.value = Math.min(Math.max(1, n), max);
    }

    variant() {
      if (this.selected.some((v) => v == null)) return null;
      return this.data.variants.find((v) => v.options.every((o, i) => o === this.selected[i])) || null;
    }

    refresh(initial) {
      const v = this.variant();

      // option availability
      this.inputs.forEach((input) => {
        const pos = +input.dataset.position - 1;
        const test = this.selected.slice();
        test[pos] = input.value;
        const matches = this.data.variants.filter((variant) => variant.options.every((o, i) => test[i] == null || o === test[i]));
        input.disabled = matches.length === 0;
        input.classList.toggle('is-soldout', matches.length > 0 && !matches.some((m) => m.available));
      });
      $$('[data-option]', this).forEach((fs) => {
        const out = $('[data-selected-value]', fs);
        if (out) out.textContent = this.selected[+fs.dataset.option - 1] || '';
      });

      // price
      const priceEl = $('[data-price]', this);
      if (priceEl && v) {
        const now = $('[data-price-now]', priceEl), was = $('[data-price-was]', priceEl);
        if (now) now.textContent = v.price;
        if (was) { was.textContent = v.compare; was.hidden = !v.compare; }
      }
      const inst = $('[data-installments]', this);
      if (inst && v && v.installment) {
        inst.textContent = inst.dataset.label.replace('[count]', inst.dataset.count).replace('[amount]', v.installment);
      }
      const sku = $('[data-sku]', this);
      if (sku && v) sku.textContent = v.sku || '—';

      // stock
      if (this.stockEl) this.renderStock(v);

      // form
      if (this.idInput) {
        if (v) this.idInput.value = v.id; else this.idInput.value = '';
      }
      let label = this.str.add, disabled = false;
      if (v && !v.available) { label = this.str.sold_out; disabled = true; }
      if (this.addBtn) {
        this.addBtn.disabled = disabled;
        if (this.addLabel && !this.busy) this.addLabel.textContent = label;
      }
      if (this.checkout) this.checkout.hidden = !(v && v.available);
      if (this.qtyInput && v && v.inventory != null && this.qty() > v.inventory) this.setQty(v.inventory);

      // sticky
      const sp = $('[data-sticky-price]', this);
      if (sp) sp.textContent = v ? v.price : this.str.from + ' ' + (this.data.variants.reduce((m, x) => Math.min(m, x.price_cents), Infinity) / 100).toFixed(2);
      const sl = $('[data-sticky-label]', this);
      if (sl && !this.busy) sl.textContent = label;
      const sb = $('[data-sticky-add]', this);
      if (sb) sb.disabled = disabled;

      if (v && !initial) {
        if (this.gallery && v.media) this.gallery.showMedia(v.media);
        if (this.updateUrl) {
          const url = new URL(location.href);
          url.searchParams.set('variant', v.id);
          history.replaceState({}, '', url);
        }
      }
    }

    renderStock(v) {
      const low = parseInt(this.stockEl.dataset.low, 10) || 0;
      if (!v) { this.stockEl.innerHTML = ''; return; }
      const check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
      if (!v.available) {
        this.stockEl.innerHTML = `<div class="stock stock--low">${this.str.out_of_stock}</div>`;
      } else if (v.inventory != null && low > 0 && v.inventory <= low) {
        const pct = Math.max(8, Math.round((v.inventory / low) * 100));
        this.stockEl.innerHTML = `<div class="stock stock--low"><span class="live" aria-hidden="true"></span>${this.str.low_stock.replace('{{ count }}', v.inventory)}</div><div class="stock__bar"><i style="width:${pct}%"></i></div>`;
      } else {
        this.stockEl.innerHTML = `<div class="stock">${check}${this.str.in_stock}</div>`;
      }
    }

    async submit() {
      const v = this.variant();
      if (!v) {
        if (this.optError) { this.optError.hidden = false; }
        const first = $$('[data-option]', this).find((fs) => !this.selected[+fs.dataset.option - 1]);
        if (first) { const inp = $('input:not(:disabled)', first); if (inp) inp.focus(); }
        return;
      }
      if (!v.available || this.busy) return;
      this.busy = true;
      if (this.errorEl) this.errorEl.hidden = true;
      this.addBtn.disabled = true;
      const set = (t) => { if (this.addLabel) this.addLabel.textContent = t; const sl = $('[data-sticky-label]', this); if (sl) sl.textContent = t; };
      set(this.str.adding);
      try {
        const fd = new FormData(this.form);
        fd.set('id', v.id);
        await addToCart(fd, true);
        set(this.str.added);
        await new Promise((r) => setTimeout(r, 1400));
      } catch (err) {
        if (this.errorEl) { this.errorEl.textContent = err.message || T.strings.error; this.errorEl.hidden = false; }
      } finally {
        this.busy = false;
        this.addBtn.disabled = false;
        this.refresh(true);
      }
    }

    initSticky() {
      if (!this.sticky || !this.addBtn || !('IntersectionObserver' in window)) return;
      const btn = $('[data-sticky-add]', this.sticky);
      const set = (on) => {
        this.sticky.classList.toggle('is-visible', on);
        this.sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (btn) btn.tabIndex = on ? 0 : -1;
      };
      this.io = new IntersectionObserver(([en]) => set(!en.isIntersecting && en.boundingClientRect.top < 0), { threshold: 0 });
      this.io.observe(this.addBtn);
      if (btn) btn.addEventListener('click', () => { if (this.form.requestSubmit) this.form.requestSubmit(); else this.submit(); });
    }

    initLightbox() {
      const lb = $('[data-lightbox]', this);
      if (!lb || !this.gallery) return;
      const img = $('[data-lightbox-img]', lb), count = $('[data-lightbox-count]', lb);
      let items = [], i = 0, opener = null;
      const render = () => {
        const it = items[i];
        img.src = it.src; img.alt = it.alt || '';
        count.textContent = (i + 1) + ' / ' + items.length;
      };
      const open = (index) => {
        items = $$('[data-slide][data-zoom-src]', this.gallery).map((s) => ({ src: s.dataset.zoomSrc, alt: s.dataset.zoomAlt, el: s }));
        if (!items.length) return;
        const cur = this.gallery.slides[index];
        i = Math.max(0, items.findIndex((it) => it.el === cur));
        opener = document.activeElement;
        render();
        lb.classList.add('is-open');
        document.body.classList.add('is-locked');
        $('[data-lightbox-close]', lb).focus();
      };
      const close = () => {
        lb.classList.remove('is-open');
        document.body.classList.remove('is-locked');
        if (opener && opener.focus) opener.focus();
      };
      const step = (d) => { i = (i + d + items.length) % items.length; render(); };
      this.addEventListener('gallery:zoom', (e) => open(e.detail.index));
      $('[data-lightbox-close]', lb).addEventListener('click', close);
      $('[data-lightbox-prev]', lb).addEventListener('click', () => step(-1));
      $('[data-lightbox-next]', lb).addEventListener('click', () => step(1));
      lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
      this.lbKey = (e) => {
        if (!lb.classList.contains('is-open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      };
      document.addEventListener('keydown', this.lbKey);
    }

    initDelivery() {
      const el = $('[data-delivery]', this);
      if (!el) return;
      const cutoff = +el.dataset.cutoff, min = +el.dataset.min, max = +el.dataset.max;
      const skip = el.dataset.skipWeekends === 'true';
      const m = /([+-])(\d{2})(\d{2})/.exec(el.dataset.tz || '+0000');
      const offsetMin = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
      const countdown = $('[data-countdown]', el);
      const range = $('[data-delivery-range]', el);
      const box = countdown && countdown.closest('.info-box');
      const lang = document.documentElement.lang || undefined;
      const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
      const isBiz = (d) => !skip || (d.getUTCDay() !== 0 && d.getUTCDay() !== 6);
      const addDays = (d, n) => {
        const out = new Date(d.getTime());
        while (n > 0) { out.setUTCDate(out.getUTCDate() + 1); if (isBiz(out)) n--; }
        return out;
      };
      const tick = () => {
        const now = new Date(Date.now() + offsetMin * 60000); // shop-local wall clock, read with UTC getters
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const cut = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cutoff);
        const canShipToday = isBiz(today) && now.getTime() < cut;
        if (countdown) {
          if (canShipToday) {
            let s = Math.floor((cut - now.getTime()) / 1000);
            const h = String(Math.floor(s / 3600)).padStart(2, '0'); s %= 3600;
            countdown.textContent = `${h}:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
          } else if (box && !box.dataset.done) {
            box.dataset.done = '1';
            box.lastElementChild.textContent = T.strings.countdownDone;
          }
        }
        if (range) {
          const start = canShipToday ? today : addDays(today, 1);
          const from = addDays(start, Math.max(0, min - 1)), to = addDays(start, Math.max(max - 1, min - 1));
          range.textContent = `${fmt.format(from)} – ${fmt.format(to)}`;
        }
      };
      tick();
      this.deliveryTimer = setInterval(tick, 1000);
    }
  }
  customElements.define('product-page', ProductPage);

  /* Theme editor: close any open drawer when a section is re-rendered */
  document.addEventListener('shopify:section:load', () => { syncWishlist(); syncHeaderHeight(); });
})();
