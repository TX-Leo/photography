/* =========================================================
   Editorial Monograph — app.js (ES module)
   ========================================================= */
import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5/dist/photoswipe.esm.js';

const DATA = (window.GALLERY || { categories: [], total: 0 });
const CATS = DATA.categories || [];

const pad2 = (n) => String(n).padStart(2, '0');

/* ---------------------------------------------------------
   Build the DOM
   --------------------------------------------------------- */
const sectionsEl = document.getElementById('sections');
const tocListEl  = document.getElementById('toc-list');
const sheetListEl = document.getElementById('toc-sheet-list');

// Hero stats
const heroStats = document.getElementById('hero-stats');
if (heroStats) {
  heroStats.textContent = `${DATA.total || CATS.reduce((s, c) => s + c.photos.length, 0)} photographs · ${CATS.length} series`;
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const sectionRecords = []; // { id, el, photos, gridEl }

CATS.forEach((cat, i) => {
  const idx = pad2(i + 1);
  const id = `series-${cat.slug}`;
  const count = (cat.photos && cat.photos.length) || cat.count || 0;

  // --- Section ---
  const section = document.createElement('section');
  section.className = 'section';
  section.id = id;
  section.setAttribute('aria-labelledby', `${id}-title`);

  const head = document.createElement('div');
  head.className = 'section__head';
  head.innerHTML = `
    <span class="section__num">${idx}</span>
    <div class="section__title-wrap">
      <h2 class="section__title" id="${id}-title">${escapeHtml(cat.name)}</h2>
      <p class="section__blurb"><em>${escapeHtml(cat.blurb || '')}</em></p>
    </div>
    <span class="section__count">${count} ${count === 1 ? 'photograph' : 'photographs'}</span>
  `;
  section.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.id = `grid-${cat.slug}`;
  section.appendChild(grid);

  sectionsEl.appendChild(section);

  sectionRecords.push({ id, el: section, photos: cat.photos || [], gridEl: grid });

  // --- TOC rail item ---
  const tocItem = document.createElement('li');
  tocItem.className = 'toc__item';
  tocItem.dataset.target = id;
  tocItem.innerHTML = `
    <span class="toc__num">${idx}</span>
    <span class="toc__name">${escapeHtml(cat.name)}</span>
  `;
  tocItem.addEventListener('click', () => scrollToSection(id));
  tocListEl.appendChild(tocItem);

  // --- Mobile sheet item ---
  const sheetItem = document.createElement('li');
  sheetItem.className = 'toc-sheet__item';
  sheetItem.dataset.target = id;
  sheetItem.innerHTML = `<span class="n">${idx}</span><span class="t">${escapeHtml(cat.name)}</span>`;
  sheetItem.addEventListener('click', () => { closeSheet(); scrollToSection(id); });
  sheetListEl.appendChild(sheetItem);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------------------------------------------------------
   Justified-rows layout
   --------------------------------------------------------- */
function targetRowHeight(width) {
  if (width <= 560) return 168;
  if (width <= 900) return 232;
  if (width <= 1280) return 300;
  return 344;
}
function gapFor(width) { return width <= 560 ? 8 : (width <= 900 ? 10 : 12); }

function buildGrid(record) {
  const { gridEl, photos } = record;
  const containerW = gridEl.clientWidth;
  if (!containerW || !photos.length) return;

  const targetH = targetRowHeight(containerW);
  const gap = gapFor(containerW);
  gridEl.style.setProperty('--gap', gap + 'px');

  // Reuse anchors if already built (resize) — else create
  let anchors = record.anchors;
  if (!anchors) {
    anchors = photos.map((p, idx) => createTile(p, record, idx));
    record.anchors = anchors;
  }

  // Frag of rows
  const frag = document.createDocumentFragment();
  let row = [];
  let rowAspect = 0; // sum of aspect ratios (w/h)

  const flushRow = (isLast) => {
    if (!row.length) return;
    const totalGap = gap * (row.length - 1);
    // Solve row height so scaled widths + gaps == containerW
    let h = (containerW - totalGap) / rowAspect;

    // Clamp the final/partial row so a lone wide image never balloons
    const clamped = isLast && h > targetH * 1.25;
    if (clamped) h = targetH * 1.25;
    const hh = Math.round(h);

    const rowEl = document.createElement('div');
    rowEl.className = 'grid__row';

    // Round each tile width, then absorb the sub-pixel drift into the last
    // tile of a FULL row so the right edge is pixel-flush (no ragged gap).
    const widths = row.map((item) => Math.round(h * item.aspect));
    if (!clamped) {
      const used = widths.reduce((a, b) => a + b, 0) + totalGap;
      widths[widths.length - 1] += (containerW - used);
    }

    row.forEach((item, k) => {
      const w = widths[k];
      const a = item.anchor;
      a.style.width = w + 'px';
      a.style.height = hh + 'px';
      const img = a.querySelector('img');
      img.setAttribute('width', w);
      img.setAttribute('height', hh);
      rowEl.appendChild(a);
    });

    frag.appendChild(rowEl);
    row = [];
    rowAspect = 0;
  };

  photos.forEach((p, idx) => {
    const aspect = (p.w && p.h) ? (p.w / p.h) : 1.5;
    row.push({ anchor: anchors[idx], aspect });
    rowAspect += aspect;

    // projected width at target height
    const projected = rowAspect * targetH + gap * (row.length - 1);
    if (projected >= containerW) flushRow(false);
  });
  flushRow(true);

  gridEl.innerHTML = '';
  gridEl.appendChild(frag);
}

function createTile(photo, record, idx) {
  const a = document.createElement('a');
  a.className = 'tile';
  a.href = photo.full;
  a.setAttribute('data-pswp-width', photo.w || 2400);
  a.setAttribute('data-pswp-height', photo.h || 1600);
  a.setAttribute('data-caption', photo.caption || '');
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');

  const img = document.createElement('img');
  img.src = photo.thumb || photo.full;
  img.alt = photo.caption || record.id;
  img.loading = 'lazy';
  img.decoding = 'async';
  a.appendChild(img);

  if (photo.caption) {
    const cap = document.createElement('span');
    cap.className = 'tile__cap';
    cap.textContent = photo.caption;
    a.appendChild(cap);
  }

  revealObserver.observe(a);
  return a;
}

/* ---------------------------------------------------------
   Reveal-on-scroll (staggered)
   --------------------------------------------------------- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealObserver = new IntersectionObserver((entries, obs) => {
  let stagger = 0;
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const delay = reduceMotion ? 0 : Math.min(stagger * 55, 330);
    stagger++;
    setTimeout(() => el.classList.add('is-in'), delay);
    obs.unobserve(el);
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

/* ---------------------------------------------------------
   Build all grids + debounced resize
   --------------------------------------------------------- */
function layoutAll() {
  sectionRecords.forEach(buildGrid);
}

// Relayout only when the viewport WIDTH actually changes (ignore mobile
// URL-bar height jitter), debounced.
let lastW = window.innerWidth;
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const w = window.innerWidth;
    if (w !== lastW) { lastW = w; layoutAll(); }
  }, 160);
}, { passive: true });

// First layout: wait a frame so clientWidth is correct, and relayout after fonts load
requestAnimationFrame(layoutAll);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => requestAnimationFrame(layoutAll));
}
window.addEventListener('load', () => requestAnimationFrame(layoutAll));

/* ---------------------------------------------------------
   PhotoSwipe — one lightbox per category
   --------------------------------------------------------- */
sectionRecords.forEach((record) => {
  const lightbox = new PhotoSwipeLightbox({
    gallery: '#' + 'grid-' + record.id.replace('series-', ''),
    children: 'a.tile',
    pswpModule: PhotoSwipe,
    bgOpacity: 0.97,
    showHideAnimationType: reduceMotion ? 'none' : 'fade',
    zoom: false,
  });

  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name: 'custom-caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      html: '',
      onInit: (el, pswp) => {
        const update = () => {
          const curr = pswp.currSlide && pswp.currSlide.data && pswp.currSlide.data.element;
          el.textContent = curr ? (curr.getAttribute('data-caption') || '') : '';
        };
        pswp.on('change', update);
        update();
      },
    });
  });

  lightbox.init();
});

/* ---------------------------------------------------------
   Scroll-spy (active TOC item + moving tick)
   --------------------------------------------------------- */
const tocItems = Array.from(document.querySelectorAll('.toc__item'));
const sheetItems = Array.from(document.querySelectorAll('.toc-sheet__item'));
const byTarget = (list, id) => list.find((el) => el.dataset.target === id);

let activeId = null;
function setActive(id) {
  if (id === activeId) return;
  activeId = id;
  tocItems.forEach((el) => el.classList.toggle('is-active', el.dataset.target === id));
  sheetItems.forEach((el) => el.classList.toggle('is-active', el.dataset.target === id));
}

// Scroll-spy: track each section's visible ratio within a top band and make
// the most-visible one active. Comparing ratios (rather than "first from top")
// avoids flicker between adjacent sections.
const spyRatios = new Map();
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => spyRatios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
  let best = null, bestR = 0;
  spyRatios.forEach((r, id) => { if (r > bestR) { bestR = r; best = id; } });
  if (best) setActive(best);
}, { rootMargin: '-12% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

sectionRecords.forEach((r) => spy.observe(r.el));

/* ---------------------------------------------------------
   Smooth scroll
   --------------------------------------------------------- */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

/* ---------------------------------------------------------
   Mobile sheet
   --------------------------------------------------------- */
const sheet = document.getElementById('toc-sheet');
const toggle = document.getElementById('toc-toggle');
const sheetClose = document.getElementById('toc-sheet-close');

function openSheet() {
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  toggle.setAttribute('aria-expanded', 'true');
}
function closeSheet() {
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  toggle.setAttribute('aria-expanded', 'false');
}
toggle.addEventListener('click', () => {
  sheet.classList.contains('is-open') ? closeSheet() : openSheet();
});
sheetClose.addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

/* ---------------------------------------------------------
   Scroll progress bar
   --------------------------------------------------------- */
const progressBar = document.querySelector('.scroll-progress__bar');
let progressTick = false;
function updateProgress() {
  const h = document.documentElement;
  const scrolled = h.scrollTop / Math.max(1, (h.scrollHeight - h.clientHeight));
  progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrolled))})`;
  progressTick = false;
}
window.addEventListener('scroll', () => {
  if (!progressTick) { progressTick = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
updateProgress();