# Puštanje sajta uživo — uputstvo za Miljana

Ovo su koraci koje **ti** radiš jednom, da bi sajt bio uživo i da bi Bojan mogao
sam da menja sadržaj. Sve u kodu je već pripremljeno (build skripta, `.pages.yml`,
forma) — ostaje samo da napraviš naloge i da ih povežeš.

Ništa od ovoga nije automatski urađeno umesto tebe — namerno, jer zahteva tvoje
naloge (GitHub, Cloudflare, Pages CMS, Web3Forms).

## 0. Preduslovi

- Node.js 18+ (preporuka 20+) i git instalirani lokalno — proveri sa `node -v` i `git --version`.
- Nalog na GitHub-u (besplatan).
- Nalog na Cloudflare-u (besplatan).

## 1. Napravi GitHub repozitorijum i pošalji kod

1. Na [github.com](https://github.com) klikni **New repository**. Ime npr. `print3d-mockup` ili `3d-bj-sajt`. Ostavi ga **privatnim ili javnim** — oboje radi (Cloudflare Pages besplatno gradi i sa privatnog repoa).
2. Ne dodaj README/`.gitignore` iz GitHub čarobnjaka — repo iz koda ih već ima.
3. U terminalu, iz foldera projekta (na `static-cms` grani, ili nakon što je ova grana spojena u `main`/`master`):
   ```bash
   git remote add origin https://github.com/<tvoj-nalog>/<ime-repoa>.git
   git push -u origin static-cms
   ```
   Ako želiš da ova grana bude glavna grana repozitorijuma, na GitHub-u u **Settings → Branches** promeni default granu na `static-cms` (ili je prvo spoji u `main` lokalno pa pošalji `main`).

## 2. Poveži Cloudflare Pages

1. Uloguj se na [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → tab **Pages** → **Connect to Git**.
2. Izaberi GitHub repo koji si napravio.
3. Podešavanja builda:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** ostavi prazno (osim ako si repo stavio u podfolder).
   - Node verzija se automatski čita iz `.node-version` fajla (već je u repou, podešen na `20`) — ne moraš ništa dodatno da podešavaš, ali ako Cloudflare pita, upiši `NODE_VERSION=20` kao env varijablu.
4. Klikni **Save and Deploy**. Prvi build traje par minuta. Kad završi, dobijaš besplatnu adresu oblika `https://<ime-projekta>.pages.dev`.
5. Svaki naredni `git push` (uključujući izmene koje Bojan sačuva kroz Pages CMS — vidi dole) automatski pokreće novi build i sajt se ažurira za otprilike 1–2 minuta.

**Napomena:** ako `content/site.json` ima grešku (npr. nedostaje slika ili obavezno polje), `npm run build` će vratiti grešku i Cloudflare build će **pasti** — što znači da će **stara verzija sajta ostati uživo**, a nova (pokvarena) verzija se neće objaviti. Detalji greške se vide u Cloudflare Pages → tvoj projekat → **Deployments** → poslednji failed deploy → **View build log**.

## 3. Poveži Pages CMS i pozovi Bojana

1. Idi na [pagescms.org](https://pagescms.org) i uloguj se svojim GitHub nalogom.
2. Klikni **Add new site**, izaberi isti GitHub repo. Pages CMS automatski prepoznaje `.pages.yml` iz repoa.
3. U podešavanjima sajta na Pages CMS-u nađi **Collaborators** (saradnici) i pozovi Bojana preko njegove email adrese. Bojanu **nije potreban GitHub nalog** — dobija email sa linkom, klikne i uloguje se direktno kroz Pages CMS.
4. Bojan sada vidi samo formu za uređivanje sadržaja (definisanu u `.pages.yml`, sve na srpskom) — ne vidi kod, ne vidi GitHub. Kad sačuva izmenu, Pages CMS pravi commit u repo, što automatski pokreće novi Cloudflare build.

Za detalje uputstva koje šalješ Bojanu, vidi `ADMIN-UPUTSTVO.sr.md`.

## 4. Napravi Web3Forms ključ za kontakt formu

1. Idi na [web3forms.com](https://web3forms.com), unesi email na koji žele da stižu upiti sa sajta (npr. Bojanov email) i klikni **Create Access Key**. Nije potreban nalog — ključ stiže na email.
2. Otvori `content/site.json` (lokalno ili kroz Pages CMS, polje **"Web3Forms pristupni ključ (access key)"** unutar sekcije **"Kontakt i forma za upit"**) i zameni `YOUR_WEB3FORMS_ACCESS_KEY` stvarnim ključem.
3. Sačuvaj (commit i push, ili Save u Pages CMS-u) — sledeći build će ugraditi ključ u formu.
4. Ovaj ključ je **namerno javan** (vidi se u izvornom kodu stranice) — tako Web3Forms radi, ključ samo određuje na koji email stižu poruke, ne daje pristup ničemu drugom. Preporuka: u Web3Forms podešavanjima ograniči ključ na tvoj domen (**Restrict to domain**) kad sajt bude uživo, da spreči zloupotrebu sa drugih sajtova.
5. Testiraj: pošalji upit kroz formu na sajtu i proveri da li stiže email.

## 5. (Opciono) Sopstveni domen

1. U Cloudflare Pages → tvoj projekat → **Custom domains** → **Set up a custom domain**.
2. Ukucaj domen (npr. `3d-bj.rs` ili `3dbj.com`) koji si prethodno kupio.
3. Ako je domen već na Cloudflare-u (DNS), povezivanje je automatsko. Ako nije, Cloudflare će tražiti da dodaš CNAME/A zapis kod tvog registrara domena.
4. HTTPS sertifikat se izdaje automatski, besplatno.

## Sažetak — šta je gde

| Alat | Uloga | Nalog treba |
|---|---|---|
| GitHub | čuva kod i `content/site.json` | tebi |
| Cloudflare Pages | hostuje sajt, gradi ga na svaki push (besplatno) | tebi |
| Pages CMS | admin panel za Bojana, piše direktno u GitHub | tebi (Bojan se loguje preko poziva, bez svog naloga) |
| Web3Forms | prosleđuje poruke iz kontakt forme na email | nije obavezan (ključ se pravi samo sa email adresom) |

## Ako nešto zapne

- **Build pada na Cloudflare-u:** pogledaj build log (korak 2, poslednja napomena) — poruka greške iz `scripts/build.mjs` će tačno reći koje polje ili slika nedostaje.
- **Bojan ne može da se uloguje:** proveri da li je pozivnica poslata na tačnu email adresu u Pages CMS → Collaborators, i da nije završila u spam folderu.
- **Kontakt forma ne šalje:** proveri da li je `contact.web3formsKey` u `content/site.json` stvarna vrednost (ne `YOUR_WEB3FORMS_ACCESS_KEY`), i da li je Web3Forms ključ ograničen na pogrešan domen.
