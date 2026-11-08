import type { Metadata } from "next";
import { ConfiguredOrMissing, LegalPage, MissingInfo } from "@/components/marketing/legal-page";
import { buildPageMetadata } from "@/lib/config/seo";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Pogoji uporabe (osnutek)",
  description: "Osnutek pogojev uporabe spletne strani in interaktivnega dema TenderMed Intelligence.",
  path: "/pogoji",
  noindex: true,
});

export default function TermsPage() {
  return (
    <LegalPage title="Pogoji uporabe" draftVersion="2026-11-osnutek-1" draftDate="2026-11-08">
      <section>
        <h2>1. Upravljavec spletne strani</h2>
        <p>
          Spletno stran upravlja <ConfiguredOrMissing value={siteConfig.legalOperator.name} label="naziv upravljavca" />
          , <ConfiguredOrMissing value={siteConfig.legalOperator.address} label="naslov sedeža" />.
        </p>
      </section>

      <section>
        <h2>2. Namen spletne strani</h2>
        <p>
          Spletna stran predstavlja platformo TenderMed Intelligence, ki je v razvoju, ter omogoča ogled interaktivnega
          dema in oddajo povpraševanja. Predstavljene funkcionalnosti so označene kot interaktivni demo, v razvoju ali
          načrtovane in ne pomenijo zaveze, da bodo na voljo v opisani obliki ali v določenem roku.
        </p>
      </section>

      <section>
        <h2>3. Interaktivni demo</h2>
        <ul>
          <li>Vsi podatki v demu so izmišljeni. Ustanove, proizvajalci, izdelki in razpisi ne obstajajo.</li>
          <li>Ponazoritveni razpisi niso dejanske objave javnih naročil.</li>
          <li>
            V demo ne vnašajte resničnih osebnih, zdravstvenih ali poslovno zaupnih podatkov. Vnosi ostanejo le v vašem
            brskalniku in se ob osvežitvi izbrišejo.
          </li>
          <li>
            Priporočila in primerjave v demu so rezultat preprostih pravil in služijo zgolj ponazoritvi delovnih tokov.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Omejitve uporabe vsebin</h2>
        <p>
          Platforma je namenjena organizaciji podatkov, servisnih postopkov in podpori poslovnim odločitvam. Ne
          nadomešča navodil proizvajalca, strokovne presoje ali kliničnega odločanja. Priporočila zahtevajo preverjanje
          ustreznosti pred uporabo ali nabavo. Vsebine na tej strani niso medicinski nasvet.
        </p>
      </section>

      <section>
        <h2>5. Intelektualna lastnina</h2>
        <p>
          Besedila, oblikovanje in programska koda spletne strani so last upravljavca, razen kjer je navedeno drugače.{" "}
          <MissingInfo>potrditev imetnika pravic</MissingInfo>
        </p>
      </section>

      <section>
        <h2>6. Odgovornost</h2>
        <p>
          Spletna stran in demo sta na voljo brez jamstev glede razpoložljivosti ali popolnosti. Obseg odgovornosti
          upravljavca je treba opredeliti v skladu z veljavno zakonodajo.{" "}
          <MissingInfo>pravno pregledana določba</MissingInfo>
        </p>
      </section>

      <section>
        <h2>7. Varstvo osebnih podatkov</h2>
        <p>Obdelava osebnih podatkov je opisana v izjavi o zasebnosti.</p>
      </section>

      <section>
        <h2>8. Veljavno pravo</h2>
        <p>
          Za te pogoje se predvidoma uporablja pravo Republike Slovenije.{" "}
          <MissingInfo>potrditev pristojnosti</MissingInfo>
        </p>
      </section>
    </LegalPage>
  );
}
