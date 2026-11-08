import type { Metadata } from "next";
import Link from "next/link";
import { ConfiguredOrMissing, LegalPage, MissingInfo } from "@/components/marketing/legal-page";
import { buildPageMetadata } from "@/lib/config/seo";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Izjava o zasebnosti (osnutek)",
  description: "Osnutek izjave o zasebnosti spletne strani TenderMed Intelligence.",
  path: "/zasebnost",
  noindex: true,
});

export default function PrivacyPage() {
  const operator = siteConfig.legalOperator;
  return (
    <LegalPage title="Izjava o zasebnosti" draftVersion={siteConfig.privacyNoticeVersion} draftDate="2026-11-08">
      <section>
        <h2>1. Upravljavec osebnih podatkov</h2>
        <p>
          Upravljavec osebnih podatkov, zbranih prek te spletne strani, je{" "}
          <ConfiguredOrMissing value={operator.name} label="naziv upravljavca" />, s sedežem{" "}
          <ConfiguredOrMissing value={operator.address} label="naslov sedeža" />, matična številka{" "}
          <ConfiguredOrMissing value={operator.registrationNumber} label="matična številka" />.
        </p>
        <p>
          Kontakt za vprašanja o varstvu osebnih podatkov:{" "}
          <ConfiguredOrMissing value={operator.privacyContactEmail} label="kontaktni e-poštni naslov" />.
        </p>
      </section>

      <section>
        <h2>2. Katere podatke zbiramo</h2>
        <p>Ta spletna stran zbira osebne podatke samo prek dveh obrazcev:</p>
        <ul>
          <li>
            <strong>Obrazec za pilot ali predstavitev:</strong> ime in priimek, e-poštni naslov, izbrano področje
            zanimanja, neobvezno sporočilo ter neobvezno soglasje za prejemanje obvestil.
          </li>
          <li>
            <strong>Kontaktni obrazec:</strong> ime in priimek, e-poštni naslov in sporočilo.
          </li>
        </ul>
        <p>
          Ob oddaji shranimo tudi čas oddaje, različico te izjave in oznako obrazca. V obrazce ne vpisujte zdravstvenih
          podatkov pacientov ali drugih občutljivih informacij.
        </p>
        <p>
          Za zaščito pred zlorabami obrazcev se iz IP-naslova in e-poštnega naslova izračuna enosmerna, s ključem
          zaščitena zgoščena vrednost (HMAC), ki se uporablja za omejevanje števila poskusov. Neobdelanih IP-naslovov v
          bazi ne hranimo. Zgoščene vrednosti se samodejno izbrišejo najpozneje v približno 24 urah.
        </p>
      </section>

      <section>
        <h2>3. Interaktivni demo</h2>
        <p>
          Interaktivni demo uporablja izključno izmišljene podatke. Vaša dejanja v demu (npr. ustvarjeni servisni
          zahtevki) ostanejo samo v pomnilniku odprtega zavihka brskalnika. Ne shranjujemo jih na strežnik, v piškotke
          ali v lokalno shrambo brskalnika in jih ne pošiljamo zunanjim storitvam, vključno s storitvami umetne
          inteligence.
        </p>
      </section>

      <section>
        <h2>4. Namen in pravna podlaga obdelave</h2>
        <ul>
          <li>
            Odgovor na povpraševanje in morebiten dogovor o predstavitvi ali sodelovanju v pilotu. Predlagana pravna
            podlaga: ukrepi na zahtevo posameznika pred sklenitvijo pogodbe oziroma zakoniti interes upravljavca.{" "}
            <MissingInfo>pravna presoja podlage</MissingInfo>
          </li>
          <li>
            Pošiljanje obvestil o razvoju platforme, samo če ste to izrecno izbrali. Pravna podlaga: privolitev, ki jo
            lahko kadar koli prekličete.
          </li>
          <li>Zaščita obrazcev pred zlorabami. Predlagana pravna podlaga: zakoniti interes upravljavca.</li>
        </ul>
        <p>Podatkov ne uporabljamo za oglaševanje, profiliranje ali avtomatizirano odločanje.</p>
      </section>

      <section>
        <h2>5. Obdelovalci in prenosi</h2>
        <p>
          Spletna stran je predvidena za gostovanje pri ponudniku Vercel, podatki iz obrazcev pa se shranjujejo v
          podatkovni bazi pri ponudniku Supabase. Z obdelovalci morajo biti pred objavo sklenjene ustrezne pogodbe o
          obdelavi.
        </p>
        <p>
          Regija hrambe podatkov: <MissingInfo>izbrana regija baze in gostovanja</MissingInfo>. Morebitni prenosi v
          tretje države: <MissingInfo>opis prenosov in zaščitnih ukrepov</MissingInfo>
        </p>
        <p>
          Če je za zaščito obrazcev omogočena storitev Cloudflare Turnstile, je treba pred vklopom tukaj dopolniti opis
          obdelave podatkov s strani te storitve. <MissingInfo>opis, če je storitev vklopljena</MissingInfo>
        </p>
      </section>

      <section>
        <h2>6. Rok hrambe</h2>
        <p>
          Povpraševanja in sporočila hranimo, dokler je to potrebno za odgovor in morebitno nadaljnje sodelovanje.{" "}
          <MissingInfo>konkreten rok hrambe in postopek izbrisa</MissingInfo> Soglasje za obvestila hranimo do preklica.
          Zgoščene vrednosti za omejevanje poskusov se izbrišejo v približno 24 urah.
        </p>
      </section>

      <section>
        <h2>7. Piškotki in analitika</h2>
        <p>
          Spletna stran ne uporablja oglaševalskih sledilnikov in privzeto ne uporablja analitičnih orodij. Piškotkov za
          sledenje ne nastavljamo.
        </p>
      </section>

      <section>
        <h2>8. Vaše pravice</h2>
        <p>
          Imate pravico do dostopa do svojih osebnih podatkov, popravka, izbrisa, omejitve obdelave, prenosljivosti in
          ugovora ter pravico, da kadar koli prekličete privolitev. Zahtevo lahko pošljete prek{" "}
          <Link href="/#kontakt" className="font-medium text-accent-700 underline underline-offset-2">
            kontaktnega obrazca
          </Link>
          {operator.privacyContactEmail ? <> ali na naslov {operator.privacyContactEmail}</> : null}.
        </p>
        <p>
          Če menite, da obdelava vaših podatkov krši predpise, lahko vložite pritožbo pri Informacijskem pooblaščencu
          Republike Slovenije.
        </p>
      </section>

      <section>
        <h2>9. Spremembe izjave</h2>
        <p>Izjavo lahko posodobimo. Ob vsaki oddaji obrazca se shrani različica izjave, ki je veljala ob oddaji.</p>
      </section>
    </LegalPage>
  );
}
