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
const heroIndexEl = document.getElementById('hero-index');

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

  // --- Hero index link ---
  if (heroIndexEl) {
    const hi = document.createElement('a');
    hi.className = 'hero__index-link';
    hi.href = `#${id}`;
    hi.innerHTML = `<span class="hero__index-num">${idx}</span><span class="hero__index-name">${escapeHtml(cat.name)}</span>`;
    hi.addEventListener('click', (e) => { e.preventDefault(); scrollToSection(id); });
    heroIndexEl.appendChild(hi);
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------------------------------------------------------
   Masonry (balanced columns) layout
   --------------------------------------------------------- */
function columnsFor(width) {
  if (width <= 640) return 1;
  if (width <= 1024) return 2;
  return 3;
}
function gapFor(width) { return width <= 640 ? 16 : 26; }

function buildGrid(record) {
  const { gridEl, photos } = record;
  const W = gridEl.clientWidth;
  if (!W || !photos.length) return;

  const cols = columnsFor(W);
  const gap = gapFor(W);
  const colW = (W - gap * (cols - 1)) / cols;

  // Build the figures once; reuse across relayouts (keeps reveal state).
  let tiles = record.tiles;
  if (!tiles) {
    tiles = photos.map((p, idx) => createTile(p, record, idx));
    record.tiles = tiles;
  }

  // Distribute into balanced columns: each tile joins the currently shortest
  // column (height estimated from aspect ratio + caption block).
  const colEls = [];
  const colH = new Array(cols).fill(0);
  const frag = document.createDocumentFragment();
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'grid__col';
    colEls.push(col);
    frag.appendChild(col);
  }
  const CAP_H = 58;
  tiles.forEach((tile) => {
    let m = 0;
    for (let c = 1; c < cols; c++) if (colH[c] < colH[m]) m = c;
    colEls[m].appendChild(tile);
    colH[m] += colW * tile._ratio + CAP_H + gap;
  });

  gridEl.style.setProperty('--gap', gap + 'px');
  gridEl.innerHTML = '';
  gridEl.appendChild(frag);
}

// Show the place as a distinct tag only when it adds information — i.e. when
// the caption isn't already the place (or doesn't contain it).
function displayPlace(caption, place) {
  if (!place) return '';
  const c = String(caption || '').toLowerCase().trim();
  const p = String(place).toLowerCase().trim();
  if (!p || p === c || c.includes(p) || p.includes(c)) return '';
  return place;
}

function createTile(photo, record, idx) {
  const place = displayPlace(photo.caption, photo.place);

  const fig = document.createElement('figure');
  fig.className = 'tile';
  fig._ratio = (photo.w && photo.h) ? (photo.h / photo.w) : 0.7;

  const a = document.createElement('a');
  a.className = 'tile__media';
  a.href = photo.full;
  a.setAttribute('data-pswp-width', photo.w || 2400);
  a.setAttribute('data-pswp-height', photo.h || 1600);
  a.setAttribute('data-caption', photo.caption || '');
  if (place) a.setAttribute('data-place', place);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');

  const img = document.createElement('img');
  img.src = photo.thumb || photo.full;
  img.alt = photo.caption ? (place ? `${photo.caption}, ${place}` : photo.caption) : record.id;
  img.loading = 'lazy';
  img.decoding = 'async';
  if (photo.w && photo.h) img.style.aspectRatio = `${photo.w} / ${photo.h}`;
  a.appendChild(img);
  fig.appendChild(a);

  if (photo.caption || place) {
    const cap = document.createElement('figcaption');
    cap.className = 'tile__cap';
    if (photo.caption) {
      const title = document.createElement('span');
      title.className = 'tile__cap-title';
      title.textContent = photo.caption;
      cap.appendChild(title);
    }
    if (place) {
      const pl = document.createElement('span');
      pl.className = 'tile__cap-place';
      pl.textContent = place;
      cap.appendChild(pl);
    }
    fig.appendChild(cap);
  }

  revealObserver.observe(fig);
  return fig;
}

/* ---------------------------------------------------------
   Reveal-on-scroll (staggered)
   --------------------------------------------------------- */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal tiles as they scroll in. Falls back to showing everything immediately
// if IntersectionObserver is unavailable, so content is never left hidden.
const revealObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries, obs) => {
      let stagger = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = reduceMotion ? 0 : Math.min(stagger * 55, 330);
        stagger++;
        setTimeout(() => el.classList.add('is-in'), delay);
        obs.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 })
  : { observe: (el) => el.classList.add('is-in'), unobserve() {} };

/* ---------------------------------------------------------
   Build all grids + debounced resize
   --------------------------------------------------------- */
function layoutAll() {
  sectionRecords.forEach(buildGrid);
}

// Build the grids, and rebuild whenever the available content WIDTH changes.
// A ResizeObserver fires on first observe too, so the gallery always renders
// regardless of load-event / web-font timing; we guard on width so mobile
// URL-bar height jitter (which changes only height) never forces a reflow.
const measureEl = document.querySelector('.page') || document.body;
let lastW = -1;
let resizeTimer = null;
function scheduleLayout() {
  const w = measureEl.clientWidth || window.innerWidth;
  if (w === lastW) return;
  lastW = w;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layoutAll, 120);
}
if ('ResizeObserver' in window) {
  new ResizeObserver(scheduleLayout).observe(measureEl);
} else {
  window.addEventListener('resize', scheduleLayout, { passive: true });
}
// Build via plain timers + events too — independent of requestAnimationFrame /
// ResizeObserver, which some environments throttle or pause. Re-runs are cheap
// and idempotent (tiles are cached on the record).
layoutAll();
setTimeout(layoutAll, 80);
setTimeout(layoutAll, 500);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(layoutAll);
}
window.addEventListener('load', layoutAll);

/* ---------------------------------------------------------
   PhotoSwipe — one lightbox per category
   --------------------------------------------------------- */
sectionRecords.forEach((record) => {
  const lightbox = new PhotoSwipeLightbox({
    gallery: '#' + 'grid-' + record.id.replace('series-', ''),
    children: 'a.tile__media',
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
          el.innerHTML = '';
          if (!curr) return;
          const cap = curr.getAttribute('data-caption') || '';
          const place = curr.getAttribute('data-place') || '';
          if (cap) {
            const t = document.createElement('span');
            t.className = 'pswp-cap-title';
            t.textContent = cap;
            el.appendChild(t);
          }
          if (place) {
            const p = document.createElement('span');
            p.className = 'pswp-cap-place';
            p.textContent = place;
            el.appendChild(p);
          }
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