# TrebaMi3D — 3D printing service website

**Live:** [trebami3d.rs](https://trebami3d.rs)

Production website for **TrebaMi3D**, a local 3D printing, scanning and modeling service in Crvenka, Serbia, run by Bojan Jovović. I designed, built, tested and deployed it, and set it up so the owner can edit all content himself, with no code and no developer in the loop.

## How it works

```
Pages CMS (owner edits content)
        │  commits to this repo
        ▼
GitHub ──► Cloudflare build ──► scripts/build.mjs ──► dist/ ──► trebami3d.rs
```

- **Content** lives in a single file, `content/site.json`, edited through [Pages CMS](https://pagescms.org) (`.pages.yml`). Every save is a Git commit, which triggers a new deploy.
- **Build:** a zero-dependency Node.js static site generator (`scripts/`) renders `src/index.template.html` with the content. It validates the content first and fails the build with a clear message if something is missing, such as a required field or an image file.
- **Hosting:** Cloudflare Workers static assets (`wrangler.jsonc`), with a custom domain. A separate small Worker (`workers/www-redirect`) sends `www.trebami3d.rs` to the bare domain with a 301 redirect.
- **Contact form:** submits to Web3Forms, so no backend server is needed.

## Features

- Single-page site with services, gallery with a lightbox, equipment, pricing, FAQ and a contact form
- Theme system: a black-and-white base with a selectable accent color (presets or a custom hex color) plus a legacy navy/red theme. The owner switches themes from the CMS.
- SEO: Open Graph and Twitter tags, LocalBusiness JSON-LD, and a web manifest with favicons
- Content-hashed CSS/JS file names with cache headers set accordingly
- Optional sections and contact channels that disappear when left empty, so no placeholder text ever reaches production
- Mobile-first layout with a bottom contact bar

## Testing

Testing is the core of this project. The site has two layers of tests.

**Build and unit tests: 71 tests, using Node's built-in `node:test` with no dependencies.** They cover:
- content validation and template rendering, including HTML escaping, nested loops and conditionals
- the theme engine and SVG recoloring, including contrast warnings for dark custom colors
- SEO output, and that every referenced image exists and stays under 300 KB
- that no placeholder text or old brand names leak into the build
- the `www` redirect Worker

**End-to-end tests: Playwright, run against the real build served locally.** They cover:
- no console errors and no horizontal scroll at a 375px viewport width
- the mobile menu, the FAQ and keyboard access to the gallery lightbox
- the contact form: validation, the success path, an HTTP 500 response, `success: false`, and the loading state, with Web3Forms mocked
- that every CSS class used on the page actually exists in the stylesheet
- theme variants, each built and served on its own port and checked side by side

## Run locally

Requires Node.js 20 or newer.

```bash
npm run dev      # build + serve locally
npm test         # build/unit tests

cd tests/e2e
npm install
npm run install-browsers
npm test         # Playwright E2E
```

## Docs (Serbian)

- [`ADMIN-UPUTSTVO.sr.md`](ADMIN-UPUTSTVO.sr.md): guide for the owner on editing content in Pages CMS
- [`DEPLOY.sr.md`](DEPLOY.sr.md): deployment setup
- [`SPEC.md`](SPEC.md): the original specification

---

Built by [Miljan Jovović](https://www.linkedin.com/in/miljan-jovovic-467702239), QA Automation Engineer.
