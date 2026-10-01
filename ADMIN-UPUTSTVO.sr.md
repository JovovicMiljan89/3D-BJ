# Uputstvo za Bojana — uređivanje sajta

Zdravo Bojane! Ovo je kratko uputstvo kako da sam menjaš tekstove, cene, usluge,
opremu i slike na sajtu — bez ičije pomoći i bez ikakvog znanja programiranja.

## Kako se ulogujem?

Miljan će ti poslati **email pozivnicu**. Klikneš na link u tom emailu i uloguješ
se — ne treba ti nikakav poseban nalog niti lozinka koju pamtiš, samo pristup
tom emailu.

Kasnije, za sledeća logovanja, najlakše je da otvoriš
**https://trebami3d.rs/admin** — ta adresa te vodi pravo na
uređivanje sajta u Pages CMS-u. Ako nisi ulogovan, prijaviš se istim putem
(preko emaila). Sačuvaj je u omiljene (bookmark).

## Šta vidim kad se ulogujem?

Vidiš listu sekcija sajta — sve na srpskom: Brend, Meni, Naslovna sekcija, Usluge,
Za firme, Galerija, Kako radi, Rezervni delovi, Radionica, O vlasniku, Kontakt i
forma za upit, Podnožje. Klikneš na sekciju, menjaš tekst u poljima, i sačuvaš.

## Kako sakrijem sekciju „Za firme“, „Rezervni delovi“ ili „Radionica“?

Sve tri sekcije imaju polje **„Prikaži sekciju na sajtu“**. Isključi ga i sačuvaj —
sekcija nestaje sa sajta, a tekst ostaje sačuvan za kasnije. Uključi ga ponovo
da se sekcija vrati. Kad je Radionica isključena, nestaje i njen link u meniju,
a kartica „O vlasniku“ ostaje na sajtu.

## Kako menjam tekst?

1. Otvori sekciju koju želiš da izmeniš (npr. **Usluge** ili **Radionica**).
2. Klikni u polje (npr. "Naslov" ili "Opis") i prekuci tekst.
3. Kad završiš, klikni **Save** (Sačuvaj) — obično gore desno.
4. Gotovo — nova verzija sajta se automatski objavljuje.

## Kako menjam/dodajem sliku?

1. Otvori sekciju gde je slika (npr. **Galerija** za slike radova, ili **Radionica**
   za sliku opreme).
2. Klikni na polje sa slikom → **Upload** (Otpremi) → izaberi fotografiju sa svog
   računara ili telefona.
3. Sačuvaj.

**Savet:** koristi slike razumne veličine (do par MB, JPG ili PNG) — sajt će biti
brži za posetioce. Najbolje izgledaju slike u formatu: oprema položeno 4:3,
galerija uspravno 4:5.

## Privremene (stock) fotografije — zameni ih svojim

Dok ne otpremiš svoje fotografije, na karticama opreme i u galeriji stoje
privremene fotografije sa Pexels-a. Takve stavke imaju uključeno polje
**„Privremena (stock) slika: zameniti pravom fotografijom“**. Na sajtu se to
nigde ne vidi, to je samo podsetnik za tebe i Miljana.

Kad otpremiš svoju fotografiju za neku stavku:

1. Zameni sliku (Upload) i po potrebi ispravi **Opis slike (alt tekst)** da
   opisuje tvoju fotografiju.
2. **Isključi** polje „Privremena (stock) slika…“.
3. Sačuvaj.

## Izgled sajta: boja akcenta

Sajt je crno-beo, sa jednom **bojom akcenta**. U toj boji su ikonice, brojevi
koraka, sitni naslovi i aktivna stavka u meniju. Dugmad ostaju bela. Logo se ne
menja: uvek je u svojoj narandžastoj (`#fd6a0a`), koja je i podrazumevana boja
akcenta (**Narandžasta**).

**Kako promeniti boju akcenta:** **Izgled sajta → Boja akcenta** → izaberi
(Crvena, Narandžasta, Žuta, Limeta, Plava) → **Save**. Sajt se ažurira za 1–2 minuta.

**Svoja boja:** u **Boja akcenta** izaberi **Prilagođena**, pa u polje
**„Prilagođena boja“** nalepi kod boje, npr. `#fd6a0a` (tarabica + 6 znakova).
Boju možeš da izabereš na https://htmlcolorcodes.com/color-picker/ (kopiraj
„HEX“ vrednost). Ako kod nije ispravan, nova verzija se ne objavljuje i stara
ostaje uživo.

- Biraj **svetle, jake boje**. Vrlo tamne boje se slabo vide na crnoj pozadini.

Ostala polja u **Izgled sajta**:

- **Boje sajta:** **Crno-bela** (sa akcentom) ili stara **Teget (crvena)**.
  Uz teget temu, boja akcenta se ne koristi.
- **Istakni aktivnu sekciju u meniju:** dok posetilac skroluje, u meniju se
  bojom akcenta ističe sekcija koju gleda.
- **Crno-bele fotografije radionice i opreme:** važi uz crno-belu temu. Galerija
  uvek ostaje u boji.

## Logo i naziv brenda (TrebaMi3D)

Sve u vezi sa brendom je u sekciji **Brend**:

| Polje | Gde se vidi |
|---|---|
| **Naziv brenda** (sada „TrebaMi3D“) | naslov u tabu browsera, pregled linka na Viberu/Facebooku, podnožje, naslov emaila sa upitom („TrebaMi3D upit: …“), kratko ime aplikacije na telefonu |
| **Tekst logoa** (sada „treba mi 3d“) | opis logoa za čitače ekrana, puno ime aplikacije na telefonu |
| **Logo (zaglavlje i podnožje)** | logo gore levo i u podnožju (verzija za tamnu pozadinu) |
| **Logo za Google** | koristi ga Google u rezultatima pretrage |
| **Znak (samo štampač)** | u kartici „O vlasniku“, dok nema tvoje fotografije |
| **Favikona** (SVG, ICO, PNG) | mala ikonica u tabu browsera |
| **Ikonica za iPhone** / **Ikonica aplikacije** | ikonica kad se sajt doda na početni ekran telefona |

Svi fajlovi novog logoa su u folderu `assets/logo/trebami3d/` (PNG verzije u `png/`).
Na sajtu se koriste verzije sa `-dark` u imenu, jer je sajt taman.

Slika koja se vidi kad se link ka sajtu podeli (Viber, Facebook…) je u sekciji
**SEO / deljenje na društvenim mrežama → Slika za deljenje**.

- **Promena naziva:** menjaš samo polje **Naziv brenda** — sajt ga sam ubacuje
  svuda. U polju **Meta podaci → Naslov stranice** naziv ne pišeš, on se dodaje
  automatski na kraj.
- **Stari logoi (3D-BJ, 3D-MDL)** su i dalje na sajtu, u `assets/logo/` (fajlovi
  koji počinju sa `3d-bj-` i `3d-mdl-`), ako ikad zatrebaju.
- **Pregled linka na društvenim mrežama** se ne menja odmah jer Facebook i Viber
  pamte staru sliku. Posle promene logoa ili slike za deljenje javi Miljanu da
  osveži pregled.

## Kako dodajem novi rad u Galeriju?

1. Otvori sekciju **Galerija (radovi)**.
2. Klikni **Add item** (Dodaj stavku) — pojaviće se novi red sa poljima: Slika,
   Alt tekst (kratak opis slike za pristupačnost), Natpis (tekst ispod slike na
   sajtu, npr. "Vaza · PLA").
3. Popuni sva tri polja i otpremi sliku.
4. Sačuvaj.

Isti princip važi za dodavanje nove **usluge**, nove **opreme** u radionici, ili
novog **koraka** u "Kako radi".

## Za koliko vremena se izmena vidi na sajtu?

Obično **1–2 minuta** nakon što sačuvaš. Sajt se u pozadini ponovo generiše i
objavljuje — ne moraš ništa dodatno da radiš, samo osveži stranicu (F5) nakon
minut-dva.

## Šta ako nešto pokvarim ili se sajt ne ažurira?

Ne brini — **ne možeš da "srušiš" sajt**. Ako neko polje ostane prazno na način
koji sistem ne dozvoljava, nova verzija se jednostavno neće objaviti i **stara
verzija ostaje uživo** dok se greška ne ispravi. Posetioci ništa neće primetiti.

Ako sačekaš 5-ak minuta i izmena se i dalje ne vidi na sajtu, ili nisi siguran
šta se desilo — **javi se Miljanu**, on ima uvid u tačnu poruku o grešci i
može brzo da je ispravi ili ti kaže šta da promeniš.

## Kratak podsetnik

- Admin: **trebami3d.rs/admin** → prijava preko email linka, bez lozinke.
- Menjaš tekst → kucaš → Save.
- Menjaš/dodaješ sliku → Upload → Save.
- Otpremio si svoju fotografiju umesto stock slike → isključi „Privremena (stock) slika“.
- Logo i naziv brenda → sekcija **Brend**.
- Boja akcenta → **Izgled sajta → Boja akcenta** → Save.
- Izmena je uživo za 1–2 minuta.
- Ako nešto ne štima — stara verzija ostaje, javi se Miljanu.
