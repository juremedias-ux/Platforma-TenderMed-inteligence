/** Slovenian labels for audit history (column names only; values are never stored). */

const entityLabels: Record<string, string> = {
  equipment: "Oprema",
  maintenance_plans: "Servisni načrt",
  locations: "Lokacija",
  organizations: "Organizacija",
  organization_memberships: "Članstvo",
  invitations: "Povabilo",
};

const actionLabels: Record<string, string> = {
  insert: "ustvarjeno",
  update: "spremenjeno",
  delete: "izbrisano",
};

const columnLabels: Record<string, string> = {
  name: "naziv",
  category: "kategorija",
  asset_tag: "inventarna številka",
  manufacturer_name: "proizvajalec",
  model: "model",
  serial_number: "serijska številka",
  location_id: "lokacija",
  responsible_user_id: "odgovorna oseba",
  purchase_date: "datum nakupa",
  commissioning_date: "datum zagona",
  warranty_end_date: "garancija",
  status: "status",
  notes: "opombe",
  activity_type: "aktivnost",
  activity_label: "opis aktivnosti",
  schedule_mode: "način rokov",
  interval_months: "interval",
  anchor_date: "začetni rok",
  due_date: "rok",
  next_due_date: "naslednji rok",
  last_completed_on: "zadnja izvedba",
  reminder_days: "opomniki",
  source_basis: "podlaga",
  source_note: "sklic na vir",
  archived_at: "arhiviranje",
  role: "vloga",
  revoked_at: "preklic",
  require_completion_acknowledgment: "potrditev izvedbe",
};

const hiddenColumns = new Set(["updated_by", "updated_at", "version"]);

export function describeAuditEvent(entityType: string, action: string, changedColumns: string[]): string {
  const entity = entityLabels[entityType] ?? entityType;
  const verb = actionLabels[action] ?? action;
  const columns = changedColumns.filter((c) => !hiddenColumns.has(c)).map((c) => columnLabels[c] ?? c);
  return columns.length > 0 ? `${entity}: ${verb} (${columns.join(", ")})` : `${entity}: ${verb}`;
}
