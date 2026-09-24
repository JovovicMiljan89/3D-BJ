# SPEC — 3D-BJ

## 1. Goal
A single-page website presenting **3D-BJ**, a 3D printing service, with product
photos + descriptions and an easy way to send a contact inquiry by **phone**,
**email**, or a form. Visual design, layout and interactions are unchanged from
the original mockup. Content (texts, prices/specs, services, equipment, gallery)
is editable by a non-technical admin (Bojan) without touching code. Phone and
email shown on the site remain the original fake placeholders until replaced
with real values in `content/site.json`.

## 2. Tech
- Plain HTML5 + CSS3 + vanilla JavaScript (ES6) for the shipped site. No
  frameworks, no client-side JSON fetch to build the page.
- **Build-time rendering**: `content/site.json` + `src/index.template.html` →
  `scripts/build.mjs` (zero-dependency Node 18+ built-ins only) → `dist/`.
  `dist/` is what gets deployed; it's a complete static site.
- **Admin editing**: [Pages CMS](https://pagescms.org) (`.pages.yml`), commits
  directly to the GitHub repo — no server, no database, no login on the
  public site.
- **Hosting**: Cloudflare (Compute / Workers static assets) free plan, `*.workers.dev` subdomain in practice (custom
  domain optional).
- **Contact form**: [Web3Forms](https://web3forms.com) free plan — a client-side
  `fetch()` POST, no backend to run.
- Target browsers: latest Chrome, Firefox, Safari, Edge; mobile Safari/Chrome.

## 3. Page sections
| # | Section       | Content |
|---|---------------|---------|
| 1 | Header        | Logo, anchor links (Services, Workshop, Gallery, How it works), **Contact** button. Sticky. |
| 2 | Hero          | Headline, short text, **Request a quote** (opens contact modal), **See our work** (scrolls to gallery), illustration. |
| 3 | Services      | Cards: icon (emoji) + title + text, list length editable. |
| 4 | Workshop      | Wide workshop photo, equipment cards (photo, tag, title, spec list), stat tiles, "Meet the maker" card with Contact button. |
| 5 | Gallery       | Images with captions; click opens a lightbox. Items editable/addable via the admin. |
| 6 | How it works  | Numbered steps + **Start an inquiry** button. |
| 7 | Footer        | Copyright (business name + owner, build-time year), phone and email links. |
| — | Contact modal | Phone (`tel:`) and email (`mailto:`) tiles + inquiry form. |

All of the above text/images come from `content/site.json` — see `README.md`
for the mapping and `.pages.yml` for the admin-facing field labels (Serbian).

## 4. Content model
`content/site.json` holds: `meta`, `brand`, `nav`, `hero`, `servicesSection` +
`services[]`, `workshop` (+ `equipment[]` with `specs[]`, `stats[]`),
`maker`, `gallerySection` + `gallery[]`, `howSection` + `steps[]`, `contact`
(including form field labels, select options, messages, and the Web3Forms
access key), `footer`. Every image field is a path under `/assets/...`; the
build fails if the file doesn't exist.

## 5. Functional requirements
- **FR-1** Every element with `data-open-contact` opens the contact modal.
- **FR-2** Modal closes via ✕ button, clicking the backdrop, or pressing `Esc`. Page scroll is locked while open.
- **FR-3** Phone tile uses `tel:` link; email tile uses `mailto:`, both built from `content.contact`.
- **FR-4** Inquiry form fields: Name*, Email*, Material, Service, Message* — labels and options come from `content.contact`.
- **FR-5** On submit with invalid/empty required fields → show inline error, do not send.
- **FR-6** On valid submit → POST JSON to `https://api.web3forms.com/submit` with the access key baked into the rendered form, a subject line, and the field values; show a loading state on the submit button, then success or a network-error message (both pre-rendered, no runtime content fetch). Includes a hidden Web3Forms honeypot (`botcheck`).
- **FR-7** Clicking a gallery image opens it enlarged with its caption; same close behavior as FR-2.
- **FR-8** Anchor links scroll smoothly to their section.
- **FR-9** `scripts/build.mjs` validates `content/site.json` (required fields present and correctly typed, every referenced image exists) before rendering. On failure it exits non-zero with the specific field/image at fault, so a broken admin edit fails the Cloudflare build instead of publishing a broken site.
- **FR-10** The rendered `dist/index.html` contains no leftover `{{ }}` placeholders and no unescaped HTML from content values.

## 6. Non-functional
- Theme: **dark only** (no light mode). Palette: near-black navy background `#070b14`, navy surfaces `#101a2f` / `#1b2d55`, red accent `#e11d2e`, text `#e7ecf6`. Unchanged from the original mockup (`css/styles.css` untouched).
- Responsive: ≥ 860px desktop grid; < 860px single column, gallery 2 columns; < 480px contact tiles stacked. No horizontal scroll at 375px width.
- Accessible: alt text on images (editable per item), `aria-modal` dialogs, visible focus styles, keyboard `Esc` to close.
- The page works without JavaScript except for: opening/closing the contact modal, submitting the contact form, and the gallery lightbox. All content is visible with JS disabled.

## 7. Acceptance checklist (manual + automated)
Automated via `npm test` (`tests/build.test.mjs`) and, optionally, `tests/e2e/`:
- [x] `npm run build` succeeds against real content and produces `dist/index.html` with no leftover placeholders.
- [x] A missing required field or a missing image file fails the build with a clear message.
- [x] Template engine HTML-escapes interpolated values; nested `{{#each}}` (equipment → specs) renders correctly.
- [x] (e2e) Page loads with no console errors.
- [x] (e2e) All "contact" buttons open the modal.
- [x] (e2e) Empty form submit shows inline error; a mocked valid submit shows the success message.
- [x] (e2e) Gallery lightbox opens with the correct caption.
- [x] (e2e) No horizontal scroll at 375px width.

Manual, before each real deploy:
- [ ] Dark theme only; all text readable on dark background (inputs, selects, modal included).
- [ ] Header shows the logo; browser tab shows the favicon.
- [ ] Phone link `href` and email `href` match `content.contact`.
- [ ] Layout OK at 1440px, 768px and 375px widths.
- [ ] Footer shows the current build year.
- [ ] A real Web3Forms submission (not mocked) actually arrives by email.

## 8. Possible next steps (out of scope)
- File upload for STL/3MF models.
- Price calculator (material × weight × print time).
- Replace remaining SVG placeholder illustrations with real high-res photos.
- SEO meta / Open Graph image per page (currently one static set in `content.meta`), cookie-free analytics.
- Multi-language content (currently `meta.lang` is a single value; the JSON schema would need per-locale variants).
