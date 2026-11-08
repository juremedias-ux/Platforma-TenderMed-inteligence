import { addDays, type IsoDate } from "@/lib/dates/date-only";
import type { SupplierProfile, Tender } from "@/types/domain";

/**
 * Illustrative tenders. None of them is a real procurement notice, no real
 * buyer is named and no source URL is stored. Live procurement sources are
 * not connected in this release.
 */
export function buildDemoTenders(reference: IsoDate): Tender[] {
  const day = (offset: number) => addDays(reference, offset);

  return [
    {
      id: "tn-01",
      isIllustrative: true,
      title: "Dobava monitorjev vitalnih funkcij z dodatno opremo",
      buyerName: "Vzorčna bolnišnica Sever",
      equipmentCategory: "patient_monitoring",
      publishedOn: day(-6),
      deadline: day(24),
      sourceUrl: null,
      requirements: [
        {
          id: "tn-01-r1",
          description: "Izjava o skladnosti za ponujeno opremo",
          rule: { kind: "document", documentType: "declaration_of_conformity" },
        },
        {
          id: "tn-01-r2",
          description: "Garancija najmanj 24 mesecev",
          rule: { kind: "min_value", attribute: "warrantyMonths", min: 24 },
        },
        {
          id: "tn-01-r3",
          description: "Odzivni čas servisa največ 48 ur",
          rule: { kind: "max_value", attribute: "serviceResponseHours", max: 48 },
        },
        {
          id: "tn-01-r4",
          description: "Usposabljanje uporabnikov ob dobavi",
          rule: { kind: "capability", capability: "user_training" },
        },
        {
          id: "tn-01-r5",
          description: "Povezljivost z bolnišničnim informacijskim sistemom naročnika",
          rule: {
            kind: "manual_review",
            reason: "tehnične zahteve povezljivosti je treba primerjati s specifikacijo naročnika",
          },
        },
      ],
    },
    {
      id: "tn-02",
      isIllustrative: true,
      title: "Najem fizioterapevtske opreme z možnostjo odkupa",
      buyerName: "Vzorčni zdravstveni dom Vzhod",
      equipmentCategory: "physiotherapy",
      publishedOn: day(-3),
      deadline: day(40),
      sourceUrl: null,
      requirements: [
        {
          id: "tn-02-r1",
          description: "Najem z možnostjo odkupa",
          rule: { kind: "capability", capability: "rental_with_purchase_option" },
        },
        {
          id: "tn-02-r2",
          description: "Dobava v največ 30 dneh",
          rule: { kind: "max_value", attribute: "deliveryDays", max: 30 },
        },
        {
          id: "tn-02-r3",
          description: "Navodila za uporabo v slovenskem jeziku",
          rule: { kind: "document", documentType: "instructions_for_use_sl" },
        },
        {
          id: "tn-02-r4",
          description: "Usposabljanje uporabnikov",
          rule: { kind: "capability", capability: "user_training" },
        },
      ],
    },
    {
      id: "tn-03",
      isIllustrative: true,
      title: "Redno vzdrževanje parnih sterilizatorjev",
      buyerName: "Vzorčni klinični center Jug",
      equipmentCategory: "sterilization",
      publishedOn: day(-9),
      deadline: day(12),
      sourceUrl: null,
      requirements: [
        {
          id: "tn-03-r1",
          description: "Pooblastilo proizvajalca za izvajanje servisa",
          rule: { kind: "capability", capability: "manufacturer_authorized_service" },
        },
        {
          id: "tn-03-r2",
          description: "Nadomestna oprema med servisnim posegom",
          rule: { kind: "capability", capability: "replacement_equipment_during_service" },
        },
        {
          id: "tn-03-r3",
          description: "Reference za primerljiva vzdrževanja",
          rule: { kind: "document", documentType: "service_references" },
        },
        {
          id: "tn-03-r4",
          description: "Odzivni čas servisa največ 24 ur",
          rule: { kind: "max_value", attribute: "serviceResponseHours", max: 24 },
        },
      ],
    },
  ];
}

/** The fictional supplier from whose perspective illustrative tenders are evaluated. */
export const demoSupplierProfile: SupplierProfile = {
  id: "org-omega",
  name: "Distributer Omega",
  capabilities: {
    user_training: true,
    rental_with_purchase_option: true,
    manufacturer_authorized_service: false,
    // replacement_equipment_during_service: not stated → evidence missing
  },
  attributes: {
    warrantyMonths: 36,
    deliveryDays: 21,
    // serviceResponseHours: not stated → evidence missing
  },
  documentTypes: ["declaration_of_conformity", "instructions_for_use", "instructions_for_use_sl"],
};
