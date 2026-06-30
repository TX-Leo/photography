#!/usr/bin/env python3
"""
Build optimized, web-ready gallery assets + a categorized manifest (data.js)
from the originals in photos/<Category>/.

For each source image it writes two JPEGs:
  gallery/<cat-slug>/<photo-slug>.jpg        full   (long edge 2400, q82)  -> lightbox
  gallery/<cat-slug>/thumb/<photo-slug>.jpg  thumb  (long edge 1000, q72)  -> grid

- HEIC is decoded via macOS `sips` (Pillow has no HEIC support here).
- EXIF orientation is baked into pixels; all other EXIF (incl. GPS) is dropped.
- Filenames/categories are slugified to safe web paths; the original filename
  (accents preserved) becomes the caption.

Re-run after adding/removing photos:  python3 build_gallery.py
"""
import os, sys, re, json, shutil, subprocess, tempfile, unicodedata, datetime
from concurrent.futures import ProcessPoolExecutor

from PIL import Image, ImageOps, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT      = os.path.dirname(os.path.abspath(__file__))
SRC       = os.path.join(ROOT, "photos")
OUT       = os.path.join(ROOT, "gallery")
FULL_EDGE = 2400
THUMB_EDGE = 1000
FULL_Q    = 82
THUMB_Q   = 72
EXTS      = (".jpg", ".jpeg", ".png", ".heic")

# Curated display order + editorial blurbs. Keys match the on-disk folder name
# AFTER stripping surrounding whitespace. Folders not listed are appended A->Z.
CATEGORY_META = [
    ("City",                  "City",                  "Skylines, streets, and the hum of places."),
    ("Architecture",          "Architecture",          "Lines, light, and the shapes we build."),
    ("Church",                "Church",                "Stillness under sacred vaults."),
    ("Museum",                "Museum",                "Quiet rooms, loud histories."),
    ("National Park",         "National Park",         "Wide land, open sky."),
    ("Sea:Lake",              "Sea & Lake",            "Water, horizon, and calm."),
    ("Astronomical Phenomena","Astronomical Phenomena","When the sky performs."),
    ("Firework",              "Firework",              "Light that blooms, then is gone."),
    ("Flower",                "Flower",                "Small, deliberate beauty."),
    ("Animal",                "Animal",                "Brief encounters with the wild."),
    ("Car",                   "Car",                   "Machines with a pulse."),
    ("Robot",                 "Robot",                 "Where my research meets the lens."),
    ("Company",               "Company",               "Pilgrimages to where it's built."),
    ("School",                "School",                "Campuses and the road through them."),
    ("Graduation",            "Graduation",            "Endings that were beginnings."),
    ("Portrait",              "Portrait",              "People, held still for a moment."),
    ("Me",                    "Me",                    "The one behind the camera."),
]


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def caption_from(stem: str) -> str:
    # tidy a few malformed names; keep accents for display
    stem = stem.strip()
    stem = re.sub(r"\.?(jpe?g|png|heic)$", "", stem, flags=re.I)  # stray ext in name
    stem = re.sub(r"\s+", " ", stem)
    return stem.strip()


def load_image(path: str):
    """Return an upright RGB PIL image, decoding HEIC via sips if needed."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".heic":
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        tmp.close()
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "100",
             path, "--out", tmp.name],
            check=True, capture_output=True,
        )
        im = Image.open(tmp.name)
        im.load()
        os.unlink(tmp.name)
    else:
        im = Image.open(path)
        im.load()
    im = ImageOps.exif_transpose(im)          # bake rotation, then we drop EXIF
    if im.mode != "RGB":
        im = im.convert("RGB")
    return im


def resize_long_edge(im: Image.Image, edge: int) -> Image.Image:
    w, h = im.size
    if max(w, h) <= edge:
        return im.copy()
    if w >= h:
        nw, nh = edge, round(h * edge / w)
    else:
        nh, nw = edge, round(w * edge / h)
    return im.resize((nw, nh), Image.LANCZOS)


def process(job):
    src, full_out, thumb_out = job["src"], job["full"], job["thumb"]
    try:
        im = load_image(src)
        full = resize_long_edge(im, FULL_EDGE)
        full.save(full_out, "JPEG", quality=FULL_Q, optimize=True, progressive=True)
        thumb = resize_long_edge(im, THUMB_EDGE)
        thumb.save(thumb_out, "JPEG", quality=THUMB_Q, optimize=True, progressive=True)
        return {"ok": True, "id": job["id"], "w": full.size[0], "h": full.size[1]}
    except Exception as e:
        return {"ok": False, "id": job["id"], "src": src, "err": f"{type(e).__name__}: {e}"}


def discover():
    folders = sorted(
        d for d in os.listdir(SRC)
        if os.path.isdir(os.path.join(SRC, d)) and not d.startswith(".")
    )
    meta = {k: (disp, blurb) for k, disp, blurb in CATEGORY_META}
    order = {k: i for i, (k, _, _) in enumerate(CATEGORY_META)}
    folders.sort(key=lambda d: order.get(d.strip(), 999 + ord(d[0])))
    cats = []
    for folder in folders:
        key = folder.strip()
        disp, blurb = meta.get(key, (key, ""))
        cats.append({"folder": folder, "name": disp, "slug": slugify(key), "blurb": blurb})
    return cats


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"no photos/ dir at {SRC}")
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    cats = discover()
    jobs, manifest = [], []
    used_slugs = set()

    for cat in cats:
        cdir = os.path.join(SRC, cat["folder"])
        cat_slug = cat["slug"]
        out_cat = os.path.join(OUT, cat_slug)
        os.makedirs(os.path.join(out_cat, "thumb"), exist_ok=True)

        files = sorted(
            f for f in os.listdir(cdir)
            if not f.startswith(".") and os.path.splitext(f)[1].lower() in EXTS
        )
        photos = []
        seen = set()
        for f in files:
            stem = os.path.splitext(f)[0]
            pslug = slugify(stem)
            base = pslug
            n = 2
            while (cat_slug, pslug) in used_slugs:
                pslug = f"{base}-{n}"; n += 1
            used_slugs.add((cat_slug, pslug))
            seen.add(pslug)

            full_rel  = f"gallery/{cat_slug}/{pslug}.jpg"
            thumb_rel = f"gallery/{cat_slug}/thumb/{pslug}.jpg"
            jid = f"{cat_slug}/{pslug}"
            jobs.append({
                "id": jid,
                "src": os.path.join(cdir, f),
                "full": os.path.join(ROOT, full_rel),
                "thumb": os.path.join(ROOT, thumb_rel),
            })
            photos.append({
                "id": jid, "full": full_rel, "thumb": thumb_rel,
                "caption": caption_from(stem), "w": 0, "h": 0,
            })
        manifest.append({**{k: cat[k] for k in ("name", "slug", "blurb")}, "photos": photos})

    print(f"Processing {len(jobs)} images across {len(manifest)} categories...")
    dims, fails = {}, []
    workers = max(2, (os.cpu_count() or 4))
    with ProcessPoolExecutor(max_workers=workers) as ex:
        done = 0
        for r in ex.map(process, jobs):
            done += 1
            if r["ok"]:
                dims[r["id"]] = (r["w"], r["h"])
            else:
                fails.append(r)
            if done % 20 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)}")

    # stitch dimensions back, drop any failures
    total = 0
    for cat in manifest:
        kept = []
        for p in cat["photos"]:
            if p["id"] in dims:
                p["w"], p["h"] = dims[p["id"]]
                del p["id"]
                kept.append(p)
        cat["photos"] = kept
        cat["count"] = len(kept)
        cat["cover"] = kept[0] if kept else None
        total += len(kept)

    manifest = [c for c in manifest if c["count"] > 0]

    data = {
        "generated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "total": total,
        "categories": manifest,
    }
    with open(os.path.join(ROOT, "data.js"), "w") as fh:
        fh.write("// AUTO-GENERATED by build_gallery.py — do not edit by hand.\n")
        fh.write("window.GALLERY = ")
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write(";\n")

    print(f"\nDone: {total} photos, {len(manifest)} categories -> data.js")
    if fails:
        print(f"\n{len(fails)} FAILED:")
        for f in fails:
            print(f"  {f['src']}\n    {f['err']}")


if __name__ == "__main__":
    main()
