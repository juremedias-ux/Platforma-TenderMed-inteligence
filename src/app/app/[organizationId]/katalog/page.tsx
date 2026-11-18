import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  InquiryDialog,
  PrivateNoteForm,
  ProductEditorDialog,
  ProductStatusButtons,
} from "@/components/app/catalog/catalog-forms";
import { ProductDetails } from "@/components/app/catalog/product-details";
import { PageHeader } from "@/components/app/page-header";
import { LoadError, NoAccess, StateMessage } from "@/components/app/state-message";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { can } from "@/lib/auth/permissions";
import { requireOrgPage } from "@/lib/auth/session";
import { productTypeLabels, productTypes, relationshipLabels, supplierKinds } from "@/lib/catalog/domain";
import { equipmentCategories, equipmentCategoryLabels, isOneOf } from "@/lib/equipment/domain";
import { getSupplierApproval, listPrivateNotes, listProducts, listSuppliers } from "@/lib/repositories/catalog";

export const metadata: Metadata = { title: "Katalog" };

type Props = PageProps<"/app/[organizationId]/katalog">;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Catalog({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { organizationId } = await params;
  const context = await requireOrgPage(organizationId, `/app/${organizationId}/katalog`);
  if (!context) return <NoAccess />;
  const { supabase, role, organization } = context;
  const query = await searchParams;
  const q = first(query.q)
    .replace(/[,()*%\\:"'.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const category = isOneOf(equipmentCategories, first(query.kategorija)) ? first(query.kategorija) : null;
  const type = isOneOf(productTypes, first(query.vrsta)) ? first(query.vrsta) : null;
  const isSupplier = isOneOf(supplierKinds, organization.kind);
  const canInquire = can(role, "supplier.inquire");

  let loaded;
  try {
    const [suppliers, products, approval, ownProducts, notes, equipment] = await Promise.all([
      listSuppliers(supabase),
      listProducts(supabase, { publishedOnly: true, q, category, type }),
      isSupplier ? getSupplierApproval(supabase, organizationId) : Promise.resolve(null),
      isSupplier ? listProducts(supabase, { supplierId: organizationId }) : Promise.resolve([]),
      listPrivateNotes(supabase, organizationId),
      canInquire
        ? supabase
            .from("equipment")
            .select("id, name, manufacturer_name, model")
            .eq("organization_id", organizationId)
            .neq("status", "archived")
            .order("name")
            .limit(300)
            .then(({ data, error }) => {
              if (error) throw error;
              return data ?? [];
            })
        : Promise.resolve([]),
    ]);
    loaded = { suppliers, products, approval, ownProducts, notes, equipment };
  } catch {
    return <LoadError />;
  }
  const supplierById = new Map(loaded.suppliers.map((s) => [s.organization_id, s]));
  const visible = loaded.products.filter((p) => supplierById.has(p.supplier_organization_id));
  const approved = loaded.approval?.status === "approved";
  const canManage = isSupplier && approved && can(role, "catalog.manage");
  const equipmentOptions = loaded.equipment.map((e) => ({
    id: e.id as string,
    label: [e.name, e.manufacturer_name, e.model].filter(Boolean).join(" · "),
  }));

  return (
    <>
      <PageHeader
        title="Katalog"
        description="Izdelki in storitve odobrenih dobaviteljev. Vrstni red ni plačljiv; komercialni odnos z upravljavcem platforme je naveden ob vsakem dobavitelju."
        actions={
          <Link
            href={`/app/${organizationId}/katalog/povprasevanja`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Povpraševanja
          </Link>
        }
      />

      {isSupplier ? (
        <section className="mb-8 space-y-4" aria-labelledby="own-catalog">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="own-catalog" className="text-base font-semibold text-ink">
              Vaš katalog
            </h2>
            {canManage ? <ProductEditorDialog organizationId={organizationId} /> : null}
          </div>
          {!approved ? (
            <StateMessage kind="forbidden" title="Organizacija ni odobren dobavitelj">
              Izdelke lahko objavljajo samo dobavitelji, ki jih odobri upravljavec platforme. Za odobritev se obrnite na
              Tender Med d.o.o.
            </StateMessage>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                Status: odobren dobavitelj · {relationshipLabels[loaded.approval!.commercial_relationship]}
              </p>
              {loaded.ownProducts.length === 0 ? (
                <p className="text-sm text-ink-muted">V katalogu še nimate izdelkov.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {loaded.ownProducts.map((product) => (
                    <ProductDetails key={product.id} product={product} showStatus>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <ProductEditorDialog organizationId={organizationId} product={product} />
                          <ProductStatusButtons organizationId={organizationId} product={product} />
                        </div>
                      ) : null}
                    </ProductDetails>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      <section aria-labelledby="published" className="space-y-4">
        <h2 id="published" className="text-base font-semibold text-ink">
          Objavljeni izdelki
        </h2>
        <form
          method="get"
          role="search"
          aria-label="Iskanje v katalogu"
          className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_14rem_12rem_auto] sm:items-end"
        >
          <div>
            <Label htmlFor="catalog-q">Iskanje</Label>
            <Input id="catalog-q" name="q" type="search" defaultValue={q} maxLength={80} className="mt-1.5 h-10" />
          </div>
          <div>
            <Label htmlFor="catalog-category">Kategorija</Label>
            <Select id="catalog-category" name="kategorija" defaultValue={category ?? ""} className="mt-1.5">
              <option value="">Vse</option>
              {equipmentCategories.map((c) => (
                <option key={c} value={c}>
                  {equipmentCategoryLabels[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="catalog-type">Vrsta</Label>
            <Select id="catalog-type" name="vrsta" defaultValue={type ?? ""} className="mt-1.5">
              <option value="">Vse</option>
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {productTypeLabels[t]}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonVariants({ variant: "primary" })}>
            Prikaži
          </button>
        </form>
        {visible.length === 0 ? (
          <StateMessage kind="empty" title="Ni objavljenih izdelkov">
            {q || category || type
              ? "Noben izdelek ne ustreza izbranim filtrom."
              : "Odobreni dobavitelji še niso objavili izdelkov. Katalog se polni samo z resničnimi objavami dobaviteljev."}
          </StateMessage>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((product) => {
              const supplier = supplierById.get(product.supplier_organization_id)!;
              const own = product.supplier_organization_id === organizationId;
              return (
                <ProductDetails key={product.id} product={product} supplier={supplier}>
                  {!own && canInquire ? (
                    <>
                      <InquiryDialog
                        organizationId={organizationId}
                        product={{
                          id: product.id,
                          name: product.name,
                          supplierId: supplier.organization_id,
                          supplierName: supplier.name,
                        }}
                        equipment={equipmentOptions}
                      />
                      <PrivateNoteForm
                        organizationId={organizationId}
                        productId={product.id}
                        body={loaded.notes.get(product.id) ?? ""}
                      />
                    </>
                  ) : loaded.notes.get(product.id) ? (
                    <p className="text-sm text-ink-soft">Interni zapisek: {loaded.notes.get(product.id)}</p>
                  ) : null}
                </ProductDetails>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default function CatalogPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Nalagam katalog …</p>}>
      <Catalog params={params} searchParams={searchParams} />
    </Suspense>
  );
}
