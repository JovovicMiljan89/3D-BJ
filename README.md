# 3D-BJ — 3D Printing Mockup (Single Page)

A simple, dependency-free single-page mockup for **3D-BJ**, a 3D print / scan / model service run by **Bojan Jovović** (owner & print operator).
Phone number and email are fake placeholders.

## Quick start (VS Code)

1. Open this folder in VS Code (`File → Open Folder…`).
2. Install the recommended extensions when prompted (Live Server, Prettier).
3. Right-click `index.html` → **Open with Live Server**
   — or run in terminal: `npm start` (requires Node.js, no install step needed).
4. Or simply double-click `index.html` to open it in a browser.

## Project structure

```
print3d-mockup/
├── index.html              # The whole page (header, hero, services, workshop, gallery, steps, footer, modal)
├── css/styles.css          # All styles + responsive rules
├── js/main.js              # Contact modal, inquiry form → mailto, gallery lightbox
├── assets/logo/            # 3D-BJ logo set (see Logo section below)
├── assets/images/          # Mock SVG illustrations (replace with real photos later)
│   ├── favicon.svg
│   ├── hero-printer.svg
│   ├── vase.svg
│   ├── gear.svg
│   ├── figurine.svg
│   ├── phone-stand.svg
│   ├── workshop.jpg        # Stills from the workshop video (low-res, replace later)
│   ├── printers-multicolor.jpg
│   ├── printer-enclosed.jpg
│   └── scanner.jpg
├── SPEC.md                 # Functional spec & acceptance criteria
├── package.json             # Optional npm scripts (start / format)
├── .vscode/                # Recommended extensions + editor settings
├── .prettierrc
└── .gitignore
```

## Where to change mock data

| What            | Where                                                        |
|-----------------|--------------------------------------------------------------|
| Business name   | `index.html` (logo, title, footer)                            |
| Phone           | `index.html` → search `tel:+15550100199`                      |
| Email           | `index.html` → search `3d-bj.example` + `CONTACT_EMAIL` in `js/main.js` |
| Images          | Replace files in `assets/images/` (keep names or update `src`) |
| Equipment specs | `index.html` → section `#workshop` (all values are indicative/mock) |
| Colors          | `css/styles.css` → `:root` variables (dark-only: black / navy / red) |

## Notes

- No backend: the inquiry form opens the visitor's email client with a pre-filled message (`mailto:`).
  To use a real backend later, replace the `submit` handler in `js/main.js` with a `fetch()` call
  (e.g. Formspree, Netlify Forms, or your own API).
- `tel:` links dial on mobile; on desktop they open the default calling app (if any).

## Logo (assets/logo/)

| File | Use |
|------|-----|
| `3d-bj-horizontal.svg` / `.png` | Main logo: cube + wordmark + tagline "PRINT · SCAN · MODEL" |
| `3d-bj-wordmark.svg` | Compact version for the site header |
| `3d-bj-stacked.svg` / `.png` | Stacked version with the name "Bojan Jovović" (business card, social cover) |
| `3d-bj-mark.svg` | Cube symbol only (avatar, stickers, watermark) |
| `3d-bj-icon.svg` / `3d-bj-icon-512.png` | App icon / favicon (dark rounded square); copied to `assets/images/favicon.svg` |
| `3d-bj-logo-sheet.png` | Overview of all variants + color palette |
| `3d-bj-horizontal-mono.svg` | Single-color white version (engraving, printing on colored backgrounds) |

**Concept:** an isometric cube built from visible print layers (navy sides) with a red top layer and a
white dot for the nozzle, which is a part being printed seen from above. The wordmark uses custom geometric lettering
with chamfered corners, drawn as paths so it needs no font. "3D" is light, "-BJ" is red.

**Colors:** red `#e11d2e` / `#b3121f`, navy `#2f4f9a` / `#1b2d55`, text `#e7ecf6`, background `#070b14`.
Tagline and name use the system UI font.
