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
  generated from this list, so it does not need a second manual entry.
- **New lab member**: in `people.html`, copy a `.person-card` in the students
  grid. To use a photo instead of the placeholder icon, put it in `assets/`
  and replace the icon with `<img src="assets/name.jpg" alt="Portrait of …">`.
- **CV**: replace `assets/CV-SeungWookKim.pdf` when it changes.
- **Colors / fonts**: edit the CSS custom properties and `@font-face` rules at
  the top of `css/style.css`.
- **Header logos**: `assets/magnetic-glow-fallback.svg` is the resolution-independent
  immediate fallback and `js/magnetic-glow.js` progressively adds the interactive
  monochrome WebGL mark. `assets/kaist-ai-logo.svg` is the official KAIST AI mark.
