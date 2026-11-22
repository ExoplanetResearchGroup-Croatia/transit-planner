# Upute za korištenje (HR)

*English version: [user-guide.md](user-guide.md)*

**Video upute (2:43):** [video/transitplanner-upute-hr.mp4](video/transitplanner-upute-hr.mp4). Prvi dio prikazuje rad sa zadanim postavkama, drugi podešavanje postavki.

TransitPlanner planira promatranja tranzita egzoplaneta: iz vaše lokacije, opreme i odabranih noći izračuna koji su tranziti vidljivi, složi raspored bez preklapanja i izveze ga za Ekos/KStars, N.I.N.A., tablicu ili kalendar.

Sučelje je na engleskom, pa su nazivi gumbi i polja ovdje navedeni točno kako piše na ekranu (npr. **Export**, **Location**).

Aplikacija ima **dvije stranice**:

| Stranica | Što je |
|---|---|
| **Plan** | Vremenska crta noći. Ovdje čitate plan, mijenjate ga i izvozite. Najčešće vam treba samo ona. |
| **Setup** | Pregled svega što je planer pretpostavio (lokacija, oprema, noći, filtri, postavke izvoza). Svaka stavka otvara svoj prozor. |

Sve postavke ostaju u vašem pregledniku: nema računa, kolačića ni praćenja. Svaka promjena postavki odmah ponovno izračunava plan, pa gumb „Izračunaj“ ne postoji.

> **Napomena o točnosti.** Predviđanja služe za planiranje. Neposredno prije promatranja provjerite efemeride (ExoClock, ETD, NASA). Prikazana nesigurnost (±σ) izračunata je iz objavljenih pogrešaka. Stvarno odstupanje kod starih efemerida može biti veće.

---

## 1. Prvo pokretanje: zadane postavke

1. Otvorite aplikaciju. Preglednik pita smije li koristiti vašu lokaciju; **dopustite** jednom. Vremenska zona određuje se iz koordinata.
2. Planer automatski uzme **večeras i sljedeće 2 noći** (ukupno 3), astronomski mrak (Sunce ispod −18°) i zadane filtre načina **Photometry**.
3. Izračuna sve tranzite, **sam odabere najbolji raspored bez preklapanja** i prikaže stranicu Plan.

Ako ne dopustite lokaciju, otvara se stranica Setup s prozorom **Location**. Upišite geografsku širinu i dužinu jednom; plan se pojavi sam.

Bez odabrane opreme pretpostavlja se generička njemačka ekvatorijalna montaža.

### Što vidite na stranici Plan

**Gornja traka**:

| Element | Opis |
|---|---|
| **Photometry / Showcase** | Način rada. **Photometry**: znanstvena vrijednost, ExoClock prioriteti, sva upozorenja. **Showcase**: duboki tranziti sjajnih zvijezda za javna promatranja. |
| **Local / UTC** | Vremena po lokalnom vremenu lokacije ili u UTC-u |

**Traka postavki:** **Location · Equipment · Nights · Filters**. Svaka stavka pokazuje trenutnu vrijednost, a klik otvara njezin prozor.

**Veliki broj** je broj zakazanih tranzita. Uz njega piše:

- koliko noći plan obuhvaća;
- vrijeme prvog ulaska u tranzit;
- koliko je kandidata na grafu.

Desno je gumb **Export**.

**Noći.** Svaka noć je jedan graf:

- Veliki broj lijevo je datum. Uz njega piše trajanje mraka (od–do) i osvijetljenost Mjeseca.
- Upozorenja koja vrijede za cijelu noć (npr. Mjesec osvijetljen više od 70 %) stoje u zaglavlju noći.
- Tanka traka iznad redaka prikazuje sumrak (svjetlije = svjetlije nebo) i visinu Mjeseca (točkasta crta).
- Svaki kandidat je **tanka crta preko cijele noći s udubljenjem na mjestu tranzita**. Dubina udubljenja prikazuje dubinu tranzita (logaritamski, pa se duboki tranziti ističu).
  - **Bijelo podebljano** = zakazano.
  - **Sivo** = kandidat.
  - **Sivo isprekidano** = kandidat koji se preklapa sa zakazanim tranzitom (uključujući vrijeme navođenja teleskopa).
  - Kratka točkasta crta prije zakazanog tranzita = vrijeme za navođenje, centriranje i fokusiranje.
  - **Crvena crtica** = prekretanje meridijana (meridian flip).
- Desni stupac: vrijeme ulaska i izlaska iz tranzita.

**Lijevi rub (rail):**

- popis noći po danima; klik skače na tu noć, a aktivna noć je uokvirena crveno;
- na dnu: **Plan**, **Setup**, **Equipment Builder** i crveni noćni način.

---

## 2. Rad s planom

- **Klik na crtu** (ili kvadratić uz ime) zakazuje ili uklanja tranzit.
  - Sve što se s njim preklapa samo izlazi iz plana.
  - Ostatak plana ponovno se optimizira oko vašeg izbora.
- **Klik na ime** prikazuje detalje tranzita u desnom stupcu.
- **Reset to best plan** pojavljuje se nakon ručnih izmjena i vraća automatski najbolji plan.
- Po noći se prikazuje najviše 14 redaka. **Show all** prikazuje sve.

**Desni stupac** (na užim ekranima ispod grafa) za odabrani tranzit:

- gumb **Schedule / Remove from plan**;
- vremena:

  | Polje | Značenje |
  |---|---|
  | **Observe** | Prozor promatranja |
  | **Ingress** | Ulazak u tranzit |
  | **Mid** | Sredina tranzita |
  | **Egress** | Izlazak iz tranzita |

- **Uncertainty** (±σ efemeride), **Depth** (dubina), **Duration** (trajanje) i **Magnitude**;
- **Altitude** (visina) i **Moon** (udaljenost i osvijetljenost Mjeseca), uz pokazivač od 10 kvadratića; crveni kvadratići znače da je Mjesec osvijetljen više od 70 % i iznad obzora;
- **Coverage** (pokrivenost) i vrijeme prekretanja meridijana;
- ExoClock prioritet i izvor efemeride;
- upozorenja;
- **predviđena svjetlosna krivulja**: trapezni model; osjenčani pojas je ±σ oko sredine, a crvena crta je planirani prozor promatranja;
- **putanja po nebu** (polarni graf: sredina = zenit, rub = obzor). Dio za vrijeme tranzita je podebljan, s ulaskom (puna točka) i izlaskom (kružić). Vaš lokalni obzor je ucrtan ako ste ga upisali;
- **Sky view**: snimke neba (Aladin Lite, DSS) s vidnim poljem vaše kamere. Učitavaju se s poslužitelja CDS-a tek kad kliknete.

---

## 3. Izvoz: jedan klik

Kliknite **Export** i odaberite format; datoteka se odmah preuzima.

| Stavka | Što dobijete |
|---|---|
| **Ekos / KStars** `.esl` | Popis za Ekos Scheduler. Svaki posao (job) kreće i završava u točno zadano vrijeme. |
| **Ekos capture sequence** `.esq` | Početna sekvenca snimanja s preporučenom ekspozicijom. Ditheriranje i ponovno fokusiranje su isključeni jer kvare fotometriju. Otvorite je jednom u Ekosu i spremite. |
| **N.I.N.A.** `.json` | Jedna datoteka po noći, iz ugrađenog ili vašeg predloška. NINA sprema vrijeme bez datuma, pa datoteku učitajte na dan promatranja, nakon izlaska Sunca. |
| **Spreadsheet** `.csv` | Sva vremena, u UTC-u i lokalno |
| **Calendar** `.ics` | Jedan događaj po tranzitu |
| **Plan file** `.json` | Sve izračunate vrijednosti |
| **Copy share link** | Poveznica koja vraća isti plan u drugom pregledniku |
| **Print summary** | Tablica plana za ispis |

**Export settings** (na dnu izbornika ili na stranici Setup):

- vremenska zona računala uz teleskop (Ekos i NINA koriste lokalno vrijeme tog računala);
- verzija KStarsa (3.8 ili 3.7), Ekos profil i putanja do `.esq` datoteke;
- naziv filtra, mapa za snimke i temperatura kamere za početnu sekvencu;
- NINA predložak (ugrađeni ili vaš) i hoće li se ekspozicija postaviti iz tablice preporuka.

Zadane vrijednosti rade bez mijenjanja.

Pametni teleskopi kojima upravlja aplikacija proizvođača (Seestar) ne mogu se voditi iz Ekosa ili NINA-e. Za njih koristite **Spreadsheet** ili **Calendar**.

---

## 4. Podešavanje postavki

Svi prozori otvaraju se iz trake postavki na stranici Plan ili sa stranice **Setup**. Promjene vrijede odmah; **Done** samo zatvara prozor.

### Location (lokacija)

- **Use my location** ponovno uzima položaj iz preglednika.
- **Name**, **Latitude**, **Longitude**, **Elevation**, **Time zone**: zona se sama postavi iz koordinata; mijenjajte je samo ako sat u zvjezdarnici radi u drugoj zoni.
- **New location**: više spremljenih lokacija, između kojih se prebacujete u izborniku **Saved locations**.
- **Local horizon** (sklopivi dio na dnu prozora): prepreke poput drveća i zgrada, kao parovi `azimut,visina` u stupnjevima, jedan po retku, upisani ili uvezeni iz CSV datoteke. Tranzit se smatra vidljivim samo iznad obzora i iznad minimalne visine iz filtara.

### Equipment (oprema)

| Kartica | Sadržaj |
|---|---|
| **Catalog** | Gotovi postavi (presets), pametni teleskopi (Seestar S30/S50…) ili vlastita kombinacija: teleskop, kamera, način očitanja i montaža |
| **My equipment** | Vaši unosi; **Download my equipment** ih sprema kao JSON |
| **Import** | Uvoz JSON datoteke, provjerene prema shemi; greške su opisane riječima |
| **New** | Isti obrazac kao u **Equipment Builderu** |

Izvedene vrijednosti (**Focal ratio**, **Plate scale**, **Field of view**) uvijek se računaju iz senzora i žarišne duljine.

Pod **Mount, overheads and exposure**:

- tip montaže i nakon koliko minuta iza meridijana se montaža prekreće;
- vrijeme navođenja i centriranja te vrijeme fokusiranja (zajedno čine razmak između tranzita u planu);
- tablica preporučenih ekspozicija po magnitudi (za otvor 200 mm, preračunava se na vaš otvor).

### Nights (noći)

- **First night**: prva noć, ili kvačica **Tonight** za večeras;
- **Number of nights**: 1–14;
- **Darkness**: definicija mraka, −18° (astronomski), −12° (nautički) ili −6° (građanski);
- popis noći s trajanjem mraka i osvijetljenošću Mjeseca.

### Filters (filtri)

| Filtar | Opis |
|---|---|
| Način rada | **Photometry** ili **Showcase** |
| **Magnitude** | Raspon sjaja zvijezde: V ako je poznat, inače Gaia G ili TESS T |
| **Transit depth (ppt)** | Dubina tranzita u promilima |
| **Minimum altitude** | Najmanja visina |
| **Coverage** | **Full**: tranzit i osnovna linija s obje strane. **Transit**: cijeli tranzit. **Partial**: dopušten i djelomični tranzit. |
| **Meridian flip** | **Avoid**: izbaci tranzite s prekretanjem. **Flag**: zadrži ih s upozorenjem. **Allow**: zanemari prekretanje. |
| Izvori | ExoClock, NASA Exoplanet Archive, TESS kandidati (TOI) |
| ExoClock prioritet | Samo ExoClock ciljevi kojima trebaju promatranja |

Pod **More filters**:

- trajanje i najveća zračna masa;
- udaljenost i osvijetljenost Mjeseca;
- najveća nesigurnost efemeride;
- udio djelomičnog tranzita;
- osnovna linija (fiksno ili × trajanje);
- proširenje prozora za k·σ;
- ciljevi bez objavljene nesigurnosti.

**Filtered out in the current plan** pokazuje koliko je događaja koji filtar izbacio, pa vidite što olabaviti ako cilj nedostaje.

**Reset to mode defaults** vraća zadane filtre trenutnog načina rada.

### Stranica Setup

Pregled svih pretpostavki na jednom mjestu: lokacija, oprema, noći, način i filtri, postavke izvoza. Svaka stavka ima gumb **Change** koji otvara isti prozor kao na stranici Plan. **View plan** vraća na plan.

---

## 5. Crveni noćni način

Ikona Mjeseca na dnu lijevog ruba prebacuje sve boje u prigušeno crvenu, da ne kvari prilagodbu oka na mrak uz teleskop. Ikona Sunca vraća normalni prikaz.

## 6. Equipment Builder

Zasebna stranica (ikona ključa na lijevom rubu):

- izrada i provjera opreme u JSON formatu TransitPlannera;
- provjere se pojavljuju dok upisujete, a izvedene vrijednosti pomažu uhvatiti greške (npr. µm umjesto mm);
- **Save to My equipment** sprema opremu za planer;
- za doprinos službenom katalogu označite **Catalog contribution**, dodajte poveznice na izvore i otvorite unaprijed ispunjen GitHub issue.

## 7. Česta pitanja

**Moj cilj nije na popisu.** Pogledajte **Filtered out in the current plan** u prozoru **Filters**. Najčešći razlozi:

- magnituda ili dubina izvan raspona;
- cilj je prenisko za vašu geografsku širinu;
- **Coverage** = Full traži i osnovnu liniju s obje strane;
- prekretanje meridijana uz pravilo **Avoid**;
- kandidati TOI su isključeni.

**Vremena se razlikuju od ETD-a ili ExoClocka za nekoliko minuta.** Najčešće zbog različitih efemerida; usporedite T0 i P na dnu desnog stupca. Ili je vremenska zona različita (prekidač **Local / UTC**).

**Ekos počinje u krivo vrijeme.** Vremena u `.esl` datoteci su lokalno vrijeme računala na kojem radi KStars. Ako ono radi u UTC-u, postavite **Export settings → clock time zone** na UTC.

**NINA čeka do sutra ili kreće odmah.** Datoteku učitajte na dan promatranja, nakon izlaska Sunca, i provjerite da je vremenska zona računala ista kao u **Export settings**.

Više: [faq-troubleshooting.md](faq-troubleshooting.md) (EN), [methodology.md](methodology.md) (EN, kako se sve računa).
