# Photography · Zhi (Leo) Wang

A premium, single-page photography monograph — **https://tx-leo.github.io/photography/**

129 photographs across 17 series (City, Architecture, Church, Museum, National Park,
Sea & Lake, Astronomical Phenomena, Firework, Flower, Animal, Car, Robot, Company,
School, Graduation, Portrait, Me), shown as titled sections with a floating index,
scroll-spy navigation, a justified-rows layout, and a full-screen lightbox.

Built with plain HTML/CSS + a little vanilla JS and [PhotoSwipe](https://photoswipe.com/).
No framework, no build step for the site itself — just static files on GitHub Pages.

```
index.html        # page shell (hero, sections container, footer)
style.css         # dark editorial design system
app.js            # ES module: builds sections, justified grid, TOC scroll-spy, lightbox
data.js           # AUTO-GENERATED manifest (categories + photos + dimensions + captions)
gallery/          # AUTO-GENERATED web-ready images (full + thumb), the only photos deployed
build_gallery.py  # the pipeline that turns photos/ originals into gallery/ + data.js
photos/           # YOUR ORIGINALS (git-ignored, kept local — not published)
```

## Add / update photos

1. Drop your originals into `photos/<Category>/` — one folder per series. The folder
   name becomes the section title; each **file name becomes that photo's caption**
   (e.g. `photos/City/Shanghai.jpg` → "Shanghai"). JPG/JPEG/PNG/HEIC are all accepted.

2. Regenerate the optimized gallery + manifest:
   ```bash
   python3 build_gallery.py
   ```
   This re-creates `gallery/` (each image resized to a 2400px "full" + a 1000px grid
   "thumb", HEIC decoded, EXIF/GPS stripped for privacy, names slugified) and rewrites
   `data.js`. It does **not** touch your originals in `photos/`.

   To tweak the curated section order or the one-line blurbs, edit `CATEGORY_META` near
   the top of `build_gallery.py`.

3. Publish:
   ```bash
   git add -A && git commit -m "update photos" && git push
   ```
   GitHub Pages redeploys in ~1 minute.

## Notes

- Pages is served from the `main` branch root (Settings → Pages). `.nojekyll` keeps
  GitHub from filtering files.
- Only the optimized `gallery/` images are committed (~64 MB total). The full-res
  originals stay on your drive via `.gitignore` — keep your own backup of `photos/`.
- **If the library grows to many GB,** move `gallery/` to object storage / a CDN
  (Cloudflare R2, Backblaze B2, Cloudinary) and point the `full`/`thumb` paths in
  `data.js` at the CDN URLs — everything else stays the same.
