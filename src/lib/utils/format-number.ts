const currencyFormatter = new Intl.NumberFormat("sl-SI", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Slovenian euro amount, e.g. `1.650 €`. */
export function formatEur(amount: number): string {
  return currencyFormatter.format(amount);
}
