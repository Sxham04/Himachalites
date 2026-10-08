An unconventional, immersive tourism platform that reimagines web navigation through a **bottom-to-top scrolling experience**. As users "ascend" through the site, they follow a dynamic, animated SVG path that guides them through featured travel destinations.

### Highlights

* **Inverted Scroll:** A unique bottom-up flow that simulates exploration and discovery.
* **Interactive SVG Path:** A dashed-line animation that draws itself in real-time based on the user's scroll progress.
* **Dynamic Tip Counter:** A rotating SVG indicator that tracks the "head" of the path, adjusting its orientation to match the curve of the line.
* **Parallax Depth:** Multi-layered visual effects that create a sense of scale and immersion as the traveler moves upward.

## Project structure

The site is plain HTML, CSS and JavaScript served as static files (GitHub Pages style: `/dist/Solan`
serves `dist/Solan.html`). Nothing is compiled for deployment; npm is only used for the tests and
for copying the shared header and footer into pages.

```
index.html, about.html, contact.html   top-level pages
dist/<District>.html                   the 12 district pages (public URLs, keep the folder name)
dist/post.html                         a story, or all stories for a district (?d=<district>&p=<post>)
dist/d1.html ... d12.html              redirects from the old district addresses, keep them
dist/img/                              district photos and og:image pictures

css/base.css        shared by every page: top bar, navbar, footer, parallax layers, icons
css/subpage.css     shared by about, contact, district and story pages
css/home.css        home page only          css/about.css, css/contact.css   one page each
css/district.css    district and story pages
css/blog.css        blog spot and story page

js/common.js        every page: phone menu, footer heading hover, navbar anchoring
js/home.js          home page: dashed path, bus, altitude counter, Lenis smooth scroll, parallax
js/path-cache/      precomputed bus positions along each dashed path (see the note in home.js)
js/content-api.js   reads district text and stories from Supabase, builds the blog HTML
js/district-content.js, js/post.js   fill the district pages and the story page
js/supabase-config.js                Supabase project URL and public key

partials/           the shared header and footer (see below)
scripts/            build-pages.js, which copies the partials into the pages
admin/              the admin and author area at /admin/ (see below)
supabase/           database schema, seed data and setup guide
tests/              unit tests (tests/unit) and Playwright UI and screenshot tests (tests/ui)
img/, icons/        site images and district icons
f/<width>px/        footer parallax layers in five sizes
experiments/        map.html, an interactive district map not linked from the site yet
```

Each page loads its stylesheets in this order: `css/base.css`, then `css/subpage.css` (all pages
except the home page), then the page's own file. A rule that is the same on every page belongs in
`base.css`; one that differs belongs in the page's own file.

## Changing the header or footer

The header (top bar and navbar) and the footer (links and parallax layers) are written once, in
`partials/header.html` and `partials/footer.html`. Every page has a copy between
`<!-- partial:header -->` / `<!-- /partial:header -->` markers (the same for `footer`). After editing
a partial, copy it into all pages and commit the result:

```bash
npm run build:pages
```

Don't edit the marked regions inside a page; the next build overwrites them, and `npm test` fails
while a page is out of date. Placeholders such as `{{root}}` (`../` for pages in `dist/`) and the
active nav item are filled per page by `scripts/build-pages.js`.

## Tests

```bash
npm ci
npx playwright install chromium
npm test
```

- `npm run test:unit` runs the Node unit tests: blog HTML, admin helpers, pages in sync with partials.
- `npm run test:ui` runs Playwright against `tests/mock-supabase.js`, a local stand-in for Supabase
  that also serves the site at http://127.0.0.1:8790. The real Supabase project is never touched.
  Every test runs at desktop, tablet and phone sizes.
- `tests/ui/visual.spec.js` compares full-page screenshots of every public page, plus the open
  phone menu, the anchored navbar and link hover, with saved baselines. The baselines (~100 MB,
  specific to the operating system) are not in git. Make them once, on a version of the site you
  know looks right, before changing anything visual:

  ```bash
  npm run test:update-screenshots
  ```

  After an intended visual change, run it again to accept the new look.

---

