# GLOW Lab Website

**Live site:** [glowlab-kaist.vercel.app](https://glowlab-kaist.vercel.app)

Website for **GLOW (Generative Learning of Worlds) Lab** — Kim Jaechul Graduate
School of AI, KAIST. Led by Prof. Seung Wook Kim.

A fully static site: no build step and no package dependencies.

## Structure

```
index.html          Home — mission + research areas, news, selected work
publications.html   Full publication list, grouped by year
people.html         PI profile, career timeline, students grid
join.html           How to apply
css/style.css       Scene-style design tokens, layouts, themes, and motion
js/theme-init.js    Applies the saved/system theme before first paint
js/main.js          Theme control, prefetching, and publication enhancement
js/magnetic-glow.js Interactive Magnetic Glow header mark
assets/             Fonts, logo fallback, WebGL runtime, photo, CV, favicon
scripts/             Publication media optimization utilities
```

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy (GitHub Pages)

1. Create a repository (e.g. `glow-lab/glow-lab.github.io` under a GitHub org
   for the lab, or `<user>/glow-lab`).
2. Push this folder to the `main` branch.
3. In repo Settings → Pages, set source to `main` / root.

Any other static host (Netlify, Cloudflare Pages) also works as-is.

## Common edits

- **News**: add an `<li class="news-item">` in the News section of `index.html`
  (newest first).
- **New publication**: copy a `<li class="pub">` block in `publications.html`
  under the right year (add the year heading if needed). Use
  `<span class="me">` around lab-member names, `*` for equal contribution, and
  `<span class="award">` for oral/spotlight/highlight badges. The preview grid is
  generated from this list, so it does not need a second manual entry. Add one
  entry to `assets/publications/media-manifest.json`, reference
  `assets/publications/<slug>.webp` with `data-thumbnail`, and run
  `bash scripts/optimize-publication-media.sh <slug>`. The script generates the
  list thumbnail, cropped card still, and optional motion preview. If motion is
  configured, reference it with
  `data-preview-video="assets/publications/motion/<slug>.mp4"`. Raw downloads
  are temporary and are not stored in the deployed site.
- **Publication media**: use
  `bash scripts/optimize-publication-media.sh --check` to validate all 30 media
  sets, or pass `--all` to rebuild them. Edit a manifest entry's
  `focalPoint` to tune the 3:4 crop and `posterTime` to select the still frame
  used before its matching hover video.
- **Publication card styles**: `.publication-card` remains the original
  landscape-thumbnail card. Add the independent
  `.publication-card--media-reveal` modifier for option 2: portrait copy by
  default, then a cropped still or lazily loaded video on hover/focus. Removing
  only the modifier restores the original card design.
- **Venue badge**: use `<span class="venue-badge">CVPR</span>` anywhere a
  publication venue is shown. Home, Selected/Preview cards, and the publication
  list all share this component's size, weight, radius, and theme colors.
- **New lab member**: `people.html` is the single source for both the People page
  and the Home member preview. In the `#members .people-grid`, copy an existing
  `<article class="card person-card" data-member-record>` and update its name,
  role, and avatar. Give the avatar a unique
  `data-member-transition="first-last"` value. To use a photo, put it in
  `assets/` and replace the placeholder SVG with
  `<img class="person-avatar-photo" src="assets/name.jpg" alt="Full Name">`.
  Keep `data-member-record` only on real member cards (not the Join card).
  Home follows this People-page order automatically and previews the first
  **16** members; additional members remain available on the People page. The
  filled arrow hexagon is a separate, permanent CTA to `join.html` and does not
  count toward the 16-member limit.
- **CV**: replace `assets/CV-SeungWookKim.pdf` when it changes.
- **Colors / fonts**: edit the CSS custom properties and `@font-face` rules at
  the top of `css/style.css`.
- **Lab logos**: the header starts with `assets/glow-mark.svg`, then
  `js/magnetic-glow.js` progressively adds the interactive 3D mark beside the
  Figma-exported `logo-half` wordmark. The footer assembles the outlined
  `assets/logo-full-*.svg` exports from Figma.
  `assets/kaist-ai-logo.svg` is the official KAIST AI mark.
