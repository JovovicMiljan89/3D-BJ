# SPEC — 3D-BJ Mockup

## 1. Goal
A simple single-page website presenting a fictional 3D printing service, with a few images
and an easy way to send a contact inquiry by **phone** or **email**. Mock data only.

## 2. Tech
- Plain HTML5 + CSS3 + vanilla JavaScript (ES6). No frameworks, no build step.
- Works by opening `index.html` directly or via a static server (Live Server).
- Target browsers: latest Chrome, Firefox, Safari, Edge; mobile Safari/Chrome.

## 3. Page sections
| # | Section       | Content |
|---|---------------|---------|
| 1 | Header        | 3D-BJ wordmark logo, anchor links (Services, Workshop, Gallery, How it works), **Contact** button. Sticky. |
| 2 | Hero          | Headline, short text, **Request a quote** (opens contact modal), **See our work** (scrolls to gallery), illustration. |
| 3 | Services      | 6 cards: Prototypes, Spare parts, Gifts & décor, Multicolor prints, Engineering materials, 3D scanning. |
| 4 | Workshop      | Wide workshop photo, 3 equipment cards (photo, tag, title, spec list), 4 stat tiles, "Meet the maker" card (Bojan Jovović, owner & print operator) with Contact button. |
| 5 | Gallery       | 4 images with captions; click opens a lightbox. |
| 6 | How it works  | 4 numbered steps (send → scan & model → quote → print & deliver) + **Start an inquiry** button. |
| 7 | Footer        | Copyright (auto year), phone and email links. |
| — | Contact modal | Phone (`tel:`) and email (`mailto:`) tiles + short inquiry form. |

## 4. Mock data
- Equipment (identified from workshop video): 2× Bambu Lab A1 + AMS lite (multicolor FDM), 1× enclosed CoreXY FDM printer, 1× 3D scanner with turntable. Specs shown on the page are indicative, not verified.
- Business: **3D-BJ**. Owner & print operator: **Bojan Jovović**
- Phone: `+1 (555) 010-0199` (reserved fictional range)
- Email: `hello@3d-bj.example` (`.example` is a reserved, non-routable domain)

## 5. Functional requirements
- **FR-1** Every element with `data-open-contact` opens the contact modal.
- **FR-2** Modal closes via ✕ button, clicking the backdrop, or pressing `Esc`. Page scroll is locked while open.
- **FR-3** Phone tile uses `tel:` link; email tile uses `mailto:` with subject "3D print inquiry".
- **FR-4** Inquiry form fields: Name*, Email*, Material (PLA / PLA multicolor / PETG / ABS-ASA / TPU / Not sure), Service (3D printing / 3D scanning / Scan + print), Message*.
- **FR-5** On submit with invalid/empty required fields → show inline error, do not send.
- **FR-6** On valid submit → open `mailto:` with subject `3D print inquiry from <name>` and a body containing all fields; reset form; show success message.
- **FR-7** Clicking a gallery image opens it enlarged with its caption; same close behavior as FR-2.
- **FR-8** Anchor links scroll smoothly to their section.

## 6. Non-functional
- Theme: **dark only** (no light mode). Palette: near-black navy background `#070b14`, navy surfaces `#101a2f` / `#1b2d55`, red accent `#e11d2e`, text `#e7ecf6`.
- Responsive: ≥ 860px desktop grid; < 860px single column, gallery 2 columns; < 480px contact tiles stacked.
- No horizontal scroll on 360px wide screens.
- Accessible: alt text on images, `aria-modal` dialogs, visible focus styles, keyboard `Esc` to close.
- Total page weight < 400 KB (SVG + compressed JPG stills).

## 7. Acceptance checklist (manual QA)
- [ ] Page loads with no console errors.
- [ ] Dark theme only; all text readable on dark background (inputs, selects, modal included).
- [ ] All "contact" buttons (header, hero, maker card, steps) open the modal.
- [ ] Header shows 3D-BJ logo; browser tab shows 3D-BJ cube favicon.
- [ ] Modal closes by ✕, backdrop and `Esc`.
- [ ] Phone link has `href="tel:+15550100199"`.
- [ ] Email link has `href` starting with `mailto:hello@3d-bj.example`.
- [ ] Empty form submit shows error; invalid email shows error.
- [ ] Valid submit triggers `mailto:` with pre-filled subject/body and shows success message.
- [ ] Workshop section shows 1 wide photo, 3 equipment cards and 4 stat tiles; stacks to 1 column on mobile.
- [ ] Form email body contains Service and Material.
- [ ] Each gallery image opens in lightbox with correct caption.
- [ ] Layout OK at 1440px, 768px and 375px widths.
- [ ] Footer shows current year.

## 8. Possible next steps (out of scope)
- Real backend for the form (Formspree / Netlify Forms / custom API).
- File upload for STL/3MF models.
- Price calculator (material × weight × print time).
- Replace video stills with real high-res photos; confirm exact model of enclosed printer and scanner.
- Real photos, SEO meta, Open Graph image, cookie-free analytics.
