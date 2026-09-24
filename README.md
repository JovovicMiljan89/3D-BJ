# 3D-BJ — Static Site with Pages CMS Admin

A single-page marketing site for **3D-BJ**, a 3D print / scan / model service run
by **Bojan Jovović**. Same dark navy/black/red design as the original mockup —
now content-driven and free to host.

- **Public site**: fully static HTML, generated at build time. No server, no
  database, no login on the public site.
- **Admin editing**: Bojan edits everything (texts, prices/specs, services,
  equipment, gallery photos) through [Pages CMS](https://pagescms.org), a
  hosted admin UI that commits straight to this GitHub repo — no code, no
  GitHub account needed for him.
- **Hosting**: [Cloudflare Pages](https://pages.cloudflare.com) free plan.
  Every commit (including Bojan's edits) triggers a rebuild; live in ~1–2 min.
- **Contact form**: [Web3Forms](https://web3forms.com) free plan — submits
  go straight to email, no backend to run.

> Looking for the previous approach (Node/Express server with a session-login
> admin panel and a JSON-file database)? That's the `master` branch — kept
> intentionally separate so both approaches exist side by side.

## How content becomes a page

```
content/site.json  +  src/index.template.html
        │                      │
        └────────► scripts/build.mjs ────────► dist/  (deploy this)
                    (validates, then
                     renders + copies
                     css/ js/ assets/)
```

`content/site.json` is the **single source of truth** for every piece of
user-facing text and every image path — edited either by hand or through
Pages CMS (`.pages.yml` defines that admin UI). `src/index.template.html` is
the page with `{{placeholders}}` and `{{#each}}` blocks. The build script
HTML-escapes everything, checks that every referenced image actually exists,
and writes a fully rendered `dist/index.html` — no client-side fetch of JSON,
so the page is immediately indexable, has no layout flash, and works without
JavaScript except for the contact modal, the contact form, and the gallery
lightbox.

## Run it locally

No install needed for the site itself (zero npm dependencies):

```bash
npm run build   # content/site.json -> dist/
npm run dev     # build, then serve dist/ at http://localhost:8080
npm test        # node:test — content validation + template engine
```

Optional end-to-end smoke test (kept in its own `tests/e2e/` so the root
project stays dependency-free):

```bash
cd tests/e2e
npm install
npx playwright install chromium   # first time only
npm test
```

## Project structure

```
print3d-mockup/
├── content/
│   └── site.json              # ALL editable content — edit this or use Pages CMS
├── src/
│   └── index.template.html    # page template ({{placeholders}}, {{#each}})
├── scripts/
│   ├── build.mjs               # validate -> render -> dist/ (+ dist/_headers)
│   ├── serve.mjs                # zero-dependency static server for `npm run dev`
│   └── lib/
│       ├── validate.mjs         # required fields, types, image files exist
│       ├── render.mjs            # tiny {{ }} / {{#each}} template engine
│       └── escape.mjs             # HTML-escaping
├── css/styles.css              # unchanged from the original mockup
├── js/main.js                  # contact modal, Web3Forms submit, gallery lightbox
├── assets/
│   ├── logo/, images/           # original logo + seed illustrations
│   └── uploads/                  # photos Bojan uploads via Pages CMS land here
├── tests/
│   ├── build.test.mjs           # node:test — validation + template engine
│   └── e2e/                       # optional Playwright smoke test (own package.json)
├── .pages.yml                   # Pages CMS admin UI config (Serbian labels)
├── .node-version                 # pins Cloudflare Pages' Node version
├── dist/                          # build output — deploy this (gitignored)
├── DEPLOY.sr.md                  # (Serbian) deploy steps for Miljan
├── ADMIN-UPUTSTVO.sr.md           # (Serbian) how-to guide for Bojan
└── SPEC.md                        # functional spec & acceptance criteria
```

## Where to change things

| What | Where |
|---|---|
| Any text on the site | `content/site.json` (or Pages CMS — same file, friendlier UI) |
| Product/gallery photos, equipment photos, logos | `content/site.json` image fields → files in `assets/` or `assets/uploads/` |
| Page structure / HTML | `src/index.template.html` |
| Colors / layout | `css/styles.css` — unchanged from the original mockup |
| Contact form behavior | `js/main.js` |
| What fields Bojan sees in the admin UI | `.pages.yml` |

## Deploying

See **`DEPLOY.sr.md`** (Serbian, step by step): GitHub repo, Cloudflare Pages
build settings, connecting Pages CMS and inviting Bojan, creating the
Web3Forms key, optional custom domain.

See **`ADMIN-UPUTSTVO.sr.md`** (Serbian) for the short guide handed to Bojan.
