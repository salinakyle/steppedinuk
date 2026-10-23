/* Stepped In — product page motion (reveal on scroll, perks stagger, add-to-bag feedback) */
(() => {
  'use strict';
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inEditor = () => !!(window.Shopify && window.Shopify.designMode);

  function setup(root) {
    const page = (root || document).querySelector('product-page');
    if (!page || page.dataset.pmReady) return;
    page.dataset.pmReady = '1';

    const label = page.querySelector('[data-add-label]');
    const btn = page.querySelector('[data-add-button]');
    let strings = {};
    try { strings = JSON.parse(page.querySelector('[data-product-strings]').textContent); } catch (e) {}
    if (label && btn && 'MutationObserver' in window) {
      new MutationObserver(() => {
        if (strings.added && label.textContent.trim() === strings.added) {
          btn.classList.remove('is-added'); void btn.offsetWidth; btn.classList.add('is-added');
          setTimeout(() => btn.classList.remove('is-added'), 1500);
        }
      }).observe(label, { childList: true, characterData: true, subtree: true });
    }

    if (reduce() || !('IntersectionObserver' in window)) return;

    const targets = [];
    const gal = page.querySelector('.pgal');
    if (gal) targets.push(gal);
    page.querySelectorAll('.pinfo > .pblock').forEach((el) => targets.push(el));
    page.querySelectorAll('.perk-grid > div .icon').forEach((ic, i) => ic.style.setProperty('--i', i));

    targets.forEach((el, i) => { el.setAttribute('data-reveal', ''); el.style.setProperty('--rd', Math.min(i, 8) * 0.07 + 's'); });
    page.classList.add('pm-ready');

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
    setTimeout(() => targets.forEach((el) => el.classList.add('is-in')), inEditor() ? 600 : 4000);
  }

  const run = (root) => setup(root);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => run());
  else run();
  document.addEventListener('shopify:section:load', (e) => run(e.target));
})();
