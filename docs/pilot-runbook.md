# Priročnik za zagon pilota

Ta priročnik je namenjen upravljavcu platforme (Tender Med d.o.o.). Opisuje, kako platformo pod `/app`
povežete s Supabase projektom `tendermed-web` in Vercel projektom
`https://platforma-tender-med-inteligence.vercel.app`, kako ustvarite prvo organizacijo in kako preverite, da
vse deluje.

> Ključev in gesel nikoli ne pošiljajte v klepet ali po e-pošti. Vpisujete jih samo v nadzorni plošči Supabase
> ali Vercel oziroma v lokalno datoteko `.env.local`, ki je ni v repozitoriju.

## 0. Pred začetkom

- Platforma ni namenjena podatkom o pacientih. V opombe, sporočila in dokumente ne vpisujte osebnih zdravstvenih
  podatkov.
- Spletna stran in platforma uporabljata isti Supabase projekt (vaša odločitev). Migracije so dodajne: obstoječih
  tabel spletne strani ne spreminjajo.
- Priporočilo pred vnosom pravih podatkov: zamenjajte Supabase skrivni ključ, ker je bil prej viden na posnetku
  zaslona (navodila v koraku 3).

## 1. Uveljavitev migracij v Supabase

Migracije so v mapi `supabase/migrations/`. Uveljavite jih **enkrat in po vrsti**.

1. Odprite <https://supabase.com/dashboard> → projekt `tendermed-web` → **SQL Editor** → **New query**.
2. Prvi dve migraciji spletne strani sta že uveljavljeni, če obrazec za pilot na spletni strani deluje
   (`20261108120000_inquiries.sql`, `20261109120000_email_only_pilot_signup.sql`). Teh ne poganjajte znova.
3. Za vsako od naslednjih datotek odprite datoteko na GitHubu (veja `claude/nice-hamilton-ydnbp2` ali `main` po
   združitvi), kliknite **Raw**, kopirajte celotno vsebino v SQL Editor in kliknite **Run**. Počakajte na
   »Success«, preden nadaljujete:
   1. `20261110120000_platform_foundation.sql`
   2. `20261110120100_equipment.sql`
   3. `20261110120200_service_collaboration.sql`
   4. `20261110120300_documents.sql`
   5. `20261110120400_notifications.sql`
   6. `20261110120500_catalog.sql`
   7. `20261110120600_hardening.sql`
4. Če kateri korak javi napako, se ustavite in ne nadaljujte z naslednjo datoteko. Sporočite besedilo napake
   (brez ključev).
5. Preverite: **Storage** mora prikazati zasebno vedro `documents`; **Table Editor** mora prikazati tabele, kot so
   `organizations`, `equipment`, `service_requests`.

Alternativa za tehnične uporabnike: Supabase CLI (`npx supabase link --project-ref <ref>` in
`npx supabase db push`).

## 2. Nastavitve prijave v Supabase (Authentication)

V nadzorni plošči → **Authentication** → **URL Configuration**:

- **Site URL:** `https://platforma-tender-med-inteligence.vercel.app`
- **Redirect URLs:** dodajte `https://platforma-tender-med-inteligence.vercel.app/auth/callback`

V **Authentication** → **Sign In / Providers** (ime razdelka se lahko razlikuje):

- **Allow new users to sign up:** izklopite. Aplikacija ne potrebuje javne registracije; računi se ustvarijo ob
  sprejemu povabila na strežniku.
- Prijava z e-pošto in geslom mora biti vklopljena.

E-pošta za ponastavitev gesla se pošilja prek vgrajene e-pošte Supabase, ki ima nizko omejitev števila
sporočil na uro in je namenjena preizkušanju. Za zanesljivo pošiljanje nastavite lasten SMTP
(**Authentication** → **Emails** → **SMTP Settings**), ko boste imeli domeno.

## 3. Spremenljivke okolja v Vercelu

Vercel → projekt → **Settings** → **Environment Variables**. Za okolje **Production**:

| Spremenljivka                          | Vrednost                                              | Opomba                                            |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL projekta                                          | že nastavljeno                                    |
| `SUPABASE_SECRET_KEY`                  | skrivni ključ (`sb_secret_…`)                         | že nastavljeno; samo strežnik                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | javni ključ (`sb_publishable_…`)                      | **novo** — Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SITE_URL`                 | `https://platforma-tender-med-inteligence.vercel.app` | povezave v e-pošti in povabilih                   |
| `CRON_SECRET`                          | naključen niz, vsaj 32 znakov                         | **novo** — ustvarite ga z upraviteljem gesel      |
| `RESEND_API_KEY`, `EMAIL_FROM`         | —                                                     | pustite prazno, dokler nimate preverjene domene   |

Za okolje **Preview** Supabase spremenljivk ne nastavljajte (ali jih usmerite v ločen testni projekt), da
predogledi ne dostopajo do produkcijskih podatkov.

Po spremembi spremenljivk naredite **Redeploy** zadnje produkcijske različice.

**Zamenjava skrivnega ključa (priporočeno pred pravimi podatki):** Supabase → Project Settings → API Keys →
ustvarite nov skrivni ključ → v Vercelu zamenjajte `SUPABASE_SECRET_KEY` → Redeploy → v Supabase prekličite
stari ključ.

## 4. Objava platforme

Platforma je na veji `claude/nice-hamilton-ydnbp2` (osnutek PR #2). Ko ga pregledate:

1. Na GitHubu označite PR kot pripravljen in ga združite v `main`.
2. Vercel samodejno objavi novo produkcijsko različico.
3. Preverite, da `https://platforma-tender-med-inteligence.vercel.app/prijava` prikaže obrazec za prijavo
   (in ne sporočila »platforma še ni konfigurirana«).

Migracije iz koraka 1 morajo biti uveljavljene pred objavo ali takoj po njej; sicer strani platforme prikažejo
napako pri nalaganju podatkov (javna spletna stran deluje naprej).

## 5. Prva organizacija in njen lastnik

### Možnost A: SQL Editor (brez namestitve programov)

V SQL Editorju zamenjajte ime, vrsto in e-pošto ter poženite:

```sql
with t as (
  select translate(rtrim(encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_') as token
)
select b.status, b.organization_id,
  'https://platforma-tender-med-inteligence.vercel.app/povabilo/' || t.token as povezava
from t, public.bootstrap_organization(
  'Ime organizacije',        -- ime
  'healthcare_provider',     -- healthcare_provider | distributor | service_provider | manufacturer
  'lastnik@domena.si',       -- e-pošta prvega lastnika
  sha256(convert_to(t.token, 'UTF8'))
) b;
```

- Rezultat `invitation_created` vrne povezavo. **Povezava je prikazana samo enkrat** (v bazi je shranjen le
  njen izvleček). Kopirajte jo in jo pošljite lastniku po zanesljivem kanalu.
- Rezultat `already_owner` pomeni, da ima organizacija tega lastnika že; nič se ne spremeni.
- Ponovni zagon za isto e-pošto prekliče prejšnjo nesprejeto povezavo in ustvari novo.
- Povezava velja 7 dni in jo je mogoče uporabiti enkrat.

### Možnost B: ukaz v terminalu (za tehnične uporabnike)

V lokalni kopiji repozitorija z datoteko `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`):

```bash
node --env-file=.env.local scripts/bootstrap-organization.mjs --name "Ime organizacije" --kind healthcare_provider --owner-email lastnik@domena.si --site-url https://platforma-tender-med-inteligence.vercel.app
```

### Kaj naredi lastnik

1. Odpre povezavo, nastavi ime in geslo (vsaj 10 znakov) ali se prijavi z obstoječim računom na isti e-pošti.
2. V **Nastavitve** preveri ime organizacije, pravilo potrjevanja izvedb in prejemnike opomnikov.
3. Povabi sodelavce (**Nastavitve → Povabila**). Povezavo kopira in pošlje sam, ker e-pošta še ni nastavljena.

## 6. Dobavitelji za katalog (neobvezno)

Organizacija vrste distributer, serviser ali proizvajalec lahko objavlja izdelke šele po odobritvi:

```sql
insert into public.supplier_approvals (organization_id, status, commercial_relationship, note)
values ('<uuid organizacije>', 'approved', 'none_declared', 'Odobreno za pilot')
on conflict (organization_id) do update
  set status = excluded.status, commercial_relationship = excluded.commercial_relationship, note = excluded.note;
```

- `commercial_relationship`: `none_declared` (ni prijavljenega odnosa), `platform_operator_distributes`
  (Tender Med d.o.o. je distributer tega dobavitelja), `partner_listing`, `sponsored`. Vrednost je prikazana ob
  vsakem izdelku tega dobavitelja.
- Začasna onemogočitev: isti ukaz s `'suspended'`; izdelki takoj niso več vidni.
- Enako naredi ukaz `scripts/approve-supplier.mjs`.

## 7. Dnevno opravilo (opomniki in čiščenje)

`vercel.json` določa dnevni klic `/api/cron/notifications` ob 05:17 UTC (Hobby paket dovoljuje en zagon na dan).
Opravilo ustvari opomnike o rokih, pošlje čakajoče e-pošte (ko je e-pošta nastavljena) in odstrani nedokončana
nalaganja dokumentov.

Preverjanje: Vercel → **Settings** → **Cron Jobs** mora prikazati opravilo; v **Logs** je po zagonu odgovor z
datumom in številom opomnikov. Brez `CRON_SECRET` opravilo vrne `503` in ne naredi ničesar.

Obvestila v aplikaciji delujejo brez e-pošte. Opomnik se ustvari, ko je do roka toliko dni, kot je nastavljeno v
servisnem načrtu (privzeto 30 in 7), in tedensko, ko rok zamuja.

## 8. E-pošta (kasneje)

Ko boste imeli domeno:

1. Ustvarite račun pri Resend, dodajte domeno in nastavite DNS zapise, ki jih Resend prikaže.
2. V Vercelu nastavite `RESEND_API_KEY` in `EMAIL_FROM` (npr. `TenderMed <obvestila@vasa-domena.si>`) → Redeploy.
3. Uporabnik lahko e-pošto izklopi v **Obvestila → Nastavitve**.

E-pošta, ki čaka več kot 7 dni, se ne pošlje (da ob vklopu ne pride do poplave starih opomnikov).

## 9. Preverjanje pred pilotom (ročni preizkus)

Avtomatski testi pokrivajo pravila baze in strani brez prijave. Spodnje poti preverite ročno na produkcijskem
projektu s testnimi podatki (brez fiktivne opreme v pravih organizacijah — testno organizacijo ustvarite posebej
in jo po preizkusu izbrišite v Table Editorju):

1. Lastnik sprejme povabilo, se odjavi in znova prijavi; ponastavitev gesla pošlje e-pošto.
2. Lastnik povabi upravljavca opreme in pregledovalca; pregledovalec ne vidi gumbov za urejanje.
3. Upravljavec doda opremo ročno in z uvozom CSV (prenesite predlogo na strani **Uvoz**); napačna datoteka
   ne uvozi ničesar.
4. Servisni načrt: fiksni koledar in »po zadnji izvedbi«; rok se prikaže v koledarju in na pregledu.
5. Servisni zahtevek: povabite zunanjega serviserja na drugo e-pošto; serviser vidi samo ta zahtevek in ne vidi
   internih sporočil.
6. Serviser predlaga termin, upravljavec ga potrdi; serviser zabeleži izvedbo; upravljavec jo potrdi; rok načrta
   se premakne.
7. Skrbnik razveljavi izvedbo z razlogom; rok se vrne; vnos popravka.
8. Dokument: nalaganje PDF na opremo in na zahtevek (delitev s serviserjem), prenos; datoteka s spremenjeno
   končnico (npr. `.exe` → `.pdf`) je zavrnjena.
9. Obvestila: nova obvestila po korakih 5–7; označi kot prebrano.
10. Izvoz CSV se odpre v Excelu brez izvajanja formul.
11. Druga organizacija (drug lastnik) ne vidi ničesar iz prve.

## 10. Delovanje in podpora

- **Odvzem dostopa:** Nastavitve → Člani → Odstrani; zunanjemu serviserju na strani zahtevka → Odvzemi dostop.
- **Preklic povabila:** Nastavitve → Aktivna povabila → Prekliči.
- **Revizijska sled:** tabela `audit_events` (kdo je kaj spremenil, brez vsebine); na strani opreme je prikazana
  zgodovina sprememb.
- **Varnostne kopije:** preverite, kakšne kopije vključuje vaš Supabase paket (Project Settings → Backups); na
  brezplačnem paketu obnovitev na točko v času ni na voljo.
- **Brisanje uporabnika:** Authentication → Users → Delete user. Članstva, dodelitve in nastavitve se izbrišejo
  samodejno; zapisi, ki jih je ustvaril, ostanejo z oznako »nekdanji udeleženec«. Zadnjega lastnika organizacije
  ni mogoče izbrisati, dokler lastništva ne prevzame drug član (pravilo »vsaj en lastnik«).
- **Incident (npr. izpostavljen ključ ali povezava):** prekličite povabilo oziroma zamenjajte ključ (korak 3) in
  preverite `audit_events`.
