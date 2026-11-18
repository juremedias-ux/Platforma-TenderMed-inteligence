export const productTypes = ["device", "accessory", "consumable", "spare_part", "service"] as const;
export type ProductType = (typeof productTypes)[number];

export const productTypeLabels: Record<ProductType, string> = {
  device: "Naprava",
  accessory: "Dodatna oprema",
  consumable: "Potrošni material",
  spare_part: "Rezervni del",
  service: "Storitev",
};

export const productStatuses = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const productStatusLabels: Record<ProductStatus, string> = {
  draft: "Osnutek",
  published: "Objavljeno",
  archived: "Arhivirano",
};

export const supplierKinds = ["distributor", "service_provider", "manufacturer"] as const;

export type CommercialRelationship =
  "none_declared" | "platform_operator_distributes" | "partner_listing" | "sponsored";

/** Disclosure shown next to every product. Rankings never use this value. */
export const relationshipLabels: Record<CommercialRelationship, string> = {
  none_declared: "Brez prijavljenega komercialnega odnosa z upravljavcem platforme",
  platform_operator_distributes: "Upravljavec platforme (Tender Med d.o.o.) je distributer tega dobavitelja",
  partner_listing: "Partnerska objava",
  sponsored: "Plačana objava",
};

export const inquiryStatusLabels: Record<string, string> = {
  sent: "Poslano",
  answered: "Odgovorjeno",
  closed: "Zaprto",
};
