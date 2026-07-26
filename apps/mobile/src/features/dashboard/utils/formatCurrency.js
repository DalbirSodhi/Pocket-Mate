export function formatCurrency(amountCents, currencyCode) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(Number(amountCents || 0) / 100);
}
