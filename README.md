# 3D-BJ — 3D Printing Webapp

A small commercial webapp for **3D-BJ**, a 3D print / scan / model service run by **Bojan Jovović**.

- **Public site**: hero, services, workshop/about, **products** (image + description, click for details), how-it-works, and a contact form.
- **Admin panel** (`/admin/`): a single admin login to upload/edit/delete product photos & descriptions, edit the site's text (headline, about, phone, email, footer), and read contact-form inquiries.

## Tech

- Backend: Node.js + Express, session-based auth (bcrypt-hashed password), Multer for image uploads.
- Data storage: a single JSON file (`data/db.json`), auto-created on first run. No database server to install — fine for one admin and a product catalog of this size.
- Front end: plain HTML/CSS/vanilla JS (no build step), same dark theme as before.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your `.env` from the example and fill in real values:
   ```bash
   cp .env.example .env
   ```
   - `SESSION_SECRET` — generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used **only the first time** the server runs, to create the admin account. Change the password afterwards from the admin panel (Account tab) — after that, `.env`'s password is no longer read.
3. Start the server:
   ```bash
   npm start
   ```
   Or with auto-restart on file changes: `npm run dev`
4. Open:
   - Public site: http://localhost:3000/
   - Admin panel: http://localhost:3000/admin/ (also linked at the bottom of the public site footer)

## Project structure

```
print3d-mockup/
├── server/
│   ├── index.js             # Express app, sessions, static files, routes
│   ├── store.js              # JSON-file data layer (products, site text, admin account, messages)
│   ├── middleware/auth.js    # requireAuth guard for admin-only routes
│   └── routes/
│       ├── auth.js           # login / logout / me / change-password
│       ├── products.js       # product CRUD + image upload (multer)
│       ├── content.js        # site text get/update
│       └── contact.js        # public inquiry submit + admin message list
├── data/
│   └── db.json               # auto-created on first run — NOT committed to git
├── public/
│   ├── index.html            # public site
│   ├── admin/                # admin panel (login + dashboard)
│   ├── css/styles.css
│   ├── js/main.js            # fetches content/products from the API, submits contact form
│   ├── assets/                # logo + seed illustrations
│   └── uploads/               # product photos uploaded via the admin panel — NOT committed
├── .env.example
├── package.json
└── SPEC.md                    # original mockup spec (kept for reference)
```

## Admin panel features

- **Log in** with the single admin account (username/password).
- **Products** tab — add a product (image + title + description), edit or delete existing ones. These are exactly what visitors see under "Products" on the public site.
- **Site text** tab — edit business name, tagline, hero headline/text, about/maker text, phone, email, footer note. Saved instantly and reflected on the public site on next load.
- **Messages** tab — every contact-form submission from visitors, with a "mark read/unread" and delete action. Unread count shown as a badge on the tab.
- **Account** tab — change the admin password (requires the current password).

## Security notes

- Only one admin account exists by design (as requested) — there's no sign-up flow.
- Passwords are hashed with bcrypt; sessions use an `httpOnly` cookie.
- Login is rate-limited (5 attempts / 15 min per IP) to slow down brute-forcing.
- Before deploying publicly: set `NODE_ENV=production` (enables secure cookies over HTTPS), use a strong random `SESSION_SECRET`, and put the app behind HTTPS (e.g. a reverse proxy like Nginx/Caddy, or a platform that terminates TLS for you).
- `data/db.json` and `public/uploads/` hold your real business data — back them up; they're intentionally excluded from git.

## Notes

- The contact form now submits directly to the backend (`POST /api/contact`) and is stored for the admin to read in the Messages tab, instead of the old `mailto:` mockup behavior. The phone/email contact tiles still use `tel:`/`mailto:` links, built from whatever you set in the Site text tab.
- `SPEC.md` documents the original static-mockup design and is kept for reference; some of it (e.g. "no backend") no longer applies now that the admin panel exists.
