import type { FeatureAvailability } from "@/lib/config/site";

/**
 * Slovenian homepage copy. Edit texts here; components only handle layout.
 * Rule of thumb: describe current demo functionality as such ("V demonstraciji
 * si oglejte …") and future capabilities as planned ("Predvidena funkcionalnost …").
 */

export const hero = {
  eyebrow: "Digitalno upravljanje medicinske opreme",
  title: "Vaša oprema, servisi in nove priložnosti. Na enem mestu.",
  text: "Razvijamo platformo, ki povezuje evidenco medicinske opreme, načrtovanje servisov in pregled dokumentacije. Na podlagi potreb vaše ustanove bo pomagala tudi pri raziskovanju ustreznih nadgradenj in novih rešitev.",
  primaryCta: "Oglejte si demo",
  signupTitle: "Prijavite interes za pilot",
  status: "Platforma je v razvoju. Demo prikazuje predvidene delovne tokove z izmišljenimi podatki.",
};

export const problem = {
  title: "Manj razpršenih evidenc. Več preglednosti.",
  intro:
    "Pri upravljanju medicinske opreme pogosto ne manjka truda, temveč skupnega pregleda. Podatki, dogovori in dokumenti so razdeljeni med ljudi, oddelke in orodja.",
  points: [
    {
      icon: "sheet",
      title: "Podatki o opremi v preglednicah in mapah",
      text: "Model, serijska številka in lokacija so zapisani v različnih preglednicah, ki jih je težko sproti posodabljati.",
    },
    {
      icon: "mail",
      title: "Servisni dogovori v e-pošti",
      text: "Termini, potrditve in vprašanja se izgubljajo v dolgih e-poštnih nitih med oddelki in serviserji.",
    },
    {
      icon: "user",
      title: "Nejasna odgovornost za naslednji korak",
      text: "Ni vedno jasno, kdo potrdi termin, pripravi napravo ali preveri, ali je bil servis izveden.",
    },
    {
      icon: "file",
      title: "Dokumentacija, ki jo je težko najti",
      text: "Servisna poročila, navodila in garancijski listi so shranjeni ločeno od naprave, na katero se nanašajo.",
    },
    {
      icon: "alert",
      title: "Zamenjava šele po izpadu",
      text: "O nadomestni ali dodatni opremi se pogosto začne razmišljati šele, ko naprava ni na voljo.",
    },
    {
      icon: "inbox",
      title: "Ponudbe brez razumevanja potreb",
      text: "Ponudbe izdelkov prihajajo ne glede na storitve, opremo in dejanske potrebe ustanove.",
    },
  ],
} as const;

export const institutions = {
  eyebrow: "Za zdravstvene ustanove",
  title: "Pregled nad opremo skozi njen življenjski cikel",
  intro:
    "Platforma je zasnovana za ekipe, ki skrbijo za opremo, servisne dogovore in načrtovanje nabav. Štirje povezani deli sledijo napravi od evidence do odločitve o naslednjem koraku.",
  benefits: [
    {
      icon: "register",
      title: "Evidenca opreme",
      text: "Model, serijska številka, lokacija, garancija in pripadajoča dokumentacija v skupnem pregledu.",
    },
    {
      icon: "calendar",
      title: "Načrtovanje servisov",
      text: "Pregled prihajajočih aktivnosti, odgovornosti in dogovorjenih terminov.",
    },
    {
      icon: "chat",
      title: "Usklajevanje na enem mestu",
      text: "Prijava napake, pogovor o izvedbi in servisna zgodovina ob posamezni napravi.",
    },
    {
      icon: "spark",
      title: "Premišljene nadgradnje",
      text: "Predlogi za nadaljnji pregled glede na stanje opreme, potrebe ustanove in razpoložljive rešitve.",
    },
  ],
  note: "Platforma podpira organizacijo dela. Vzdrževanje izvajajo usposobljeni serviserji, razpoložljivost opreme pa je odvisna od dogovorov in postopkov vaše ustanove.",
} as const;

export const howItWorks = {
  eyebrow: "Kako deluje",
  title: "Od evidence do naslednjega koraka",
  steps: [
    {
      title: "Dodajte opremo in dokumentacijo.",
      text: "Osnovni podatki o napravi, lokacija, garancija in pripadajoči dokumenti na enem mestu.",
    },
    {
      title: "Določite servisne aktivnosti in odgovorne osebe.",
      text: "Roki iz navodil proizvajalca, internih postopkov ali servisnih pogodb, z jasno odgovornostjo.",
    },
    {
      title: "Spremljajte dogovore, izvedbo in zgodovino.",
      text: "Prijave napak, predlagani in potrjeni termini ter ločeno zabeležena izvedba.",
    },
    {
      title: "Preglejte potrebe po nadgradnji ali dopolnitvi.",
      text: "Ko je smiselno, presodite popravilo, zamenjavo ali dodatno opremo na podlagi zbranih podatkov.",
    },
  ],
  note: "Servisne zahteve morajo slediti navodilom proizvajalca in veljavnim postopkom vaše ustanove. Platforma jih pomaga evidentirati in spremljati, ne določa pa jih sama.",
} as const;

export interface ModuleCopy {
  id: string;
  icon: "register" | "wrench" | "file" | "spark" | "gavel";
  title: string;
  description: string;
  availability: FeatureAvailability;
  demoLink?: { href: string; label: string };
  futureNote?: string;
}

export const modules: { eyebrow: string; title: string; intro: string; items: ModuleCopy[] } = {
  eyebrow: "Funkcionalnosti",
  title: "Moduli platforme",
  intro:
    "Oznake jasno ločijo, kaj si lahko že ogledate v interaktivnem demu, kaj razvijamo in kaj je načrtovano za poznejše faze.",
  items: [
    {
      id: "evidenca",
      icon: "register",
      title: "Evidenca opreme",
      description:
        "Pregled naprav z lokacijo, serijsko številko, garancijo, servisnim stanjem in povezano dokumentacijo. Iskanje in filtriranje po kategoriji, lokaciji in stanju.",
      availability: "interactive_demo",
      demoLink: { href: "/demo?pogled=oprema", label: "Odprite evidenco v demu" },
      futureNote: "Predvideno: trajna evidenca za posamezno ustanovo z uvozom obstoječih podatkov.",
    },
    {
      id: "servisi",
      icon: "wrench",
      title: "Servisi in usklajevanje",
      description:
        "Prijava napake s strukturiranimi podatki, predlog in potrditev termina, časovnica dogovora ter ločeno beleženje izvedenega vzdrževanja.",
      availability: "interactive_demo",
      demoLink: { href: "/demo?pogled=servisi", label: "Preizkusite servisni zahtevek" },
      futureNote: "Predvideno: sodelovanje s pooblaščenimi serviserji in opomniki po e-pošti.",
    },
    {
      id: "dokumentacija",
      icon: "file",
      title: "Dokumentacija",
      description:
        "Navodila, servisna in kalibracijska poročila ter garancijski listi ob posamezni napravi. Demo prikazuje le metapodatke dokumentov, brez datotek.",
      availability: "in_development",
      demoLink: { href: "/demo?pogled=oprema", label: "Oglejte si metapodatke v demu" },
      futureNote: "Predvideno: varna zasebna hramba dokumentov z nadzorom dostopa.",
    },
    {
      id: "priporocila",
      icon: "spark",
      title: "Priporočene rešitve",
      description:
        "Predlogi izdelkov z razlago relevantnosti, razpoložljivimi dokazi, manjkajočimi podatki in razkritjem komercialne povezave ponudnika.",
      availability: "interactive_demo",
      demoLink: { href: "/demo?pogled=priporocila", label: "Oglejte si priporočila v demu" },
      futureNote: "Predvideno: preverjeni podatki proizvajalcev in obvezen človeški pregled.",
    },
    {
      id: "razpisi",
      icon: "gavel",
      title: "Razpisna inteligenca",
      description:
        "Primerjava zahtev javnih naročil s profilom dobavitelja: izpolnjene zahteve, manjkajoči dokazi in točke za človeški pregled. V demu le ponazoritveni razpisi.",
      availability: "interactive_demo",
      demoLink: { href: "/demo?pogled=razpisi", label: "Oglejte si ponazoritvene razpise" },
      futureNote: "Načrtovano: povezava z viri objav javnih naročil.",
    },
  ],
};

export const plannedCapabilities: { label: string; availability: FeatureAvailability }[] = [
  { label: "Prijava uporabnikov in vabila v organizacijo", availability: "in_development" },
  { label: "Trajna evidenca opreme za posamezno ustanovo", availability: "in_development" },
  { label: "Opomniki po e-pošti pred servisnimi roki", availability: "planned" },
  { label: "Varna hramba dokumentov", availability: "planned" },
  { label: "Dostop za pooblaščene serviserje", availability: "planned" },
  { label: "Povezava z viri objav javnih naročil", availability: "planned" },
];

export const recommendations = {
  eyebrow: "Priporočene rešitve",
  title: "Nove rešitve, povezane z vašimi dejanskimi potrebami",
  positioning: "Ne več ponudb za vsakogar, temveč manj predlogov z jasno razlago njihove relevantnosti.",
  intro: "Pravočasno spoznajte rešitve, ki bi lahko podprle razvoj vaših storitev.",
  factorsTitle: "Predvidena priporočila bodo lahko upoštevala",
  factors: [
    "storitve, ki jih izvaja ustanova,",
    "obstoječe kategorije opreme,",
    "znane zahteve glede združljivosti,",
    "servisno zgodovino in zabeležene stroške,",
    "izrecno navedene operativne potrebe,",
    "razpoložljiva sredstva, če se ustanova odloči ta podatek deliti,",
    "relevantno dokumentacijo proizvajalcev.",
  ],
  disclaimer:
    "Priporočilo pomeni, da je izdelek smiselno pregledati, ne pa, da je primeren za vašo uporabo. Ustreznost mora pred uporabo ali nabavo preveriti ustanova.",
} as const;

export const partners = {
  eyebrow: "Za partnerje",
  title: "Boljše razumevanje potreb. Bolj relevantne ponudbe.",
  intro:
    "Platforma bo distributerjem, serviserjem in proizvajalcem pomagala ponuditi podporo tam, kjer je dejansko potrebna – brez nepovabljenih ponudb.",
  cards: [
    {
      icon: "truck",
      title: "Za distributerje in serviserje",
      items: [
        "Boljše usklajevanje servisov s strankami.",
        "Jasnejši pregled opreme, za katero vam je ustanova odobrila dostop.",
        "Kontekst servisne zgodovine ob vsakem posegu.",
        "Prepoznavanje priložnosti za dodatno podporo ali zamenjavo.",
        "Predvideno: ujemanje z ustreznimi javnimi naročili.",
      ],
    },
    {
      icon: "factory",
      title: "Za proizvajalce in inovativna podjetja",
      items: [
        "Strukturirana predstavitev izdelkov.",
        "Vidnost tehnične dokumentacije.",
        "Povezovanje z relevantnimi operativnimi potrebami.",
        "Možne povezave z lokalnimi distribucijskimi partnerji.",
        "Predvideno: signali povpraševanja iz dovoljenih in ustrezno združenih podatkov.",
      ],
    },
  ],
  accessNote:
    "Distributerji in proizvajalci ne bodo imeli splošnega vpogleda v opremo ali notranje podatke ustanov. Dostop bo mogoč le z izrecnim dovoljenjem ustanove in za vnaprej določen namen, na primer izvedbo servisa.",
} as const;

export const serviceModels = {
  eyebrow: "Storitve partnerjev",
  title: "Podpora tudi po dobavi",
  intro: "Primeri storitev, ki jih lahko ponujajo posamezni partnerji:",
  items: [
    { icon: "shield", label: "Preventivno vzdrževanje" },
    { icon: "headset", label: "Tehnična podpora" },
    { icon: "graduation", label: "Usposabljanje uporabnikov" },
    { icon: "replace", label: "Nadomestna oprema med servisnim posegom" },
    { icon: "calendar-range", label: "Najem" },
    { icon: "key", label: "Najem z možnostjo odkupa" },
  ],
  qualification:
    "Obseg storitev, odzivni časi, nadomestna oprema in možnosti najema so odvisni od posameznega ponudnika ter pogodbenega dogovora.",
} as const;

export const pilot = {
  eyebrow: "Pilot",
  title: "Sodelujte pri razvoju platforme",
  text: "Iščemo ustanove in partnerje, ki želijo poenostaviti evidenco opreme, servisno usklajevanje in načrtovanje prihodnjih potreb. Pustite svoj e-poštni naslov, da vas lahko kontaktiramo glede možnosti vključitve v pilot.",
  sideTitle: "Kaj pomeni prijava interesa",
  sidePoints: [
    "Prijava ni obvezujoča in ne vključuje naročila ali plačila.",
    "Vaš e-poštni naslov uporabimo samo za odgovor in morebiten dogovor o predstavitvi.",
    "Pogoji, obseg in časovnica pilota še niso določeni.",
  ],
} as const;

export const contact = {
  eyebrow: "Kontakt",
  title: "Pogovorimo se o vašem načinu dela",
  intro: "Imate vprašanje o platformi, demonstraciji ali sodelovanju? Pišite nam prek obrazca.",
} as const;

export const footer = {
  description:
    "Platforma v razvoju za evidenco medicinske opreme, servisno usklajevanje in pregled relevantnih rešitev za zdravstvene ustanove in njihove partnerje.",
  stage: "Razvojna faza: javna predstavitev in interaktivni demo z izmišljenimi podatki.",
  disclaimer:
    "Platforma je namenjena organizaciji podatkov, servisnih postopkov in podpori poslovnim odločitvam. Ne nadomešča navodil proizvajalca, strokovne presoje ali kliničnega odločanja. Priporočila zahtevajo preverjanje ustreznosti pred uporabo ali nabavo.",
} as const;
