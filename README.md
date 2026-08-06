# GLOW Lab Website

Website for **GLOW (Generative Learning of Worlds) Lab** — Kim Jaechul Graduate
School of AI, KAIST. Led by Prof. Seung Wook Kim.

A fully static site: no build step, no dependencies.

## Structure

```
index.html          Home — hero + research areas, news, selected work
publications.html   Full publication list, grouped by year
people.html         PI profile, career timeline, students grid
join.html           How to apply
css/style.css       All styles (design tokens at the top under :root)
js/main.js          Nav, scroll reveals, and the animated hero globe
assets/             Photos, CV, and favicon
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
  `<span class="award">` for oral/spotlight/highlight badges.
- **New lab member**: in `people.html`, copy a `.person-card` in the students
  grid. Add a cropped 512×512 WebP portrait to `assets/people/` and update its
  contact links. The Home member stack reads the same member records from
  `people.html` and displays up to 16 members.
- **CV**: replace `assets/CV-SeungWookKim.pdf` when it changes.
- **Colors / fonts**: edit the CSS custom properties in `:root` at the top of
  `css/style.css`.
