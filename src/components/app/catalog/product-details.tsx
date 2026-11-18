import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { productStatusLabels, productTypeLabels, relationshipLabels } from "@/lib/catalog/domain";
import { formatDate } from "@/lib/dates/format";
import { equipmentCategories, equipmentCategoryLabels, isOneOf } from "@/lib/equipment/domain";
import type { ProductRow, SupplierRow } from "@/lib/repositories/catalog";

export function ProductDetails({
  product,
  supplier,
  showStatus = false,
  children,
}: {
  product: ProductRow;
  supplier?: SupplierRow;
  showStatus?: boolean;
  children?: ReactNode;
}) {
  const category = isOneOf(equipmentCategories, product.category)
    ? equipmentCategoryLabels[product.category]
    : product.category;
  return (
    <article className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{product.name}</h3>
        <Badge size="sm" tone="neutral">
          {productTypeLabels[product.product_type]}
        </Badge>
        {showStatus ? (
          <Badge size="sm" tone={product.status === "published" ? "success" : "outline"}>
            {productStatusLabels[product.status]}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {category}
        {product.manufacturer_name || product.model
          ? ` · ${[product.manufacturer_name, product.model].filter(Boolean).join(" ")}`
          : ""}
      </p>
      {supplier ? (
        <p className="mt-1 text-xs text-ink-muted">
          Dobavitelj: <span className="font-medium text-ink-soft">{supplier.name}</span> ·{" "}
          {relationshipLabels[supplier.commercial_relationship]}
        </p>
      ) : null}
      {product.description ? <p className="mt-3 text-sm whitespace-pre-line text-ink">{product.description}</p> : null}
      {product.compatibility.length > 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          <span className="font-medium text-ink">Združljivo z:</span>{" "}
          {product.compatibility.map((c) => `${c.manufacturer_name} ${c.model}`).join(", ")}
        </p>
      ) : null}
      {product.sources.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {product.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-accent-700 hover:underline"
              >
                {s.title}
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(odpre se v novem oknu)</span>
              </a>
              {s.retrieved_on ? (
                <span className="text-xs text-ink-muted"> · vpogled {formatDate(s.retrieved_on)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="mt-4 space-y-3 border-t border-line pt-4">{children}</div> : null}
    </article>
  );
}
