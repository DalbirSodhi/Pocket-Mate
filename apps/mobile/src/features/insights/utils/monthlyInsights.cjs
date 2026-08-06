function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(monthKey || ''));

  if (!match) {
    throw new Error('Month must use YYYY-MM format.');
  }

  return { year: Number(match[1]), month: Number(match[2]) };
}

function getMonthRangeForKey(monthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const endDay = new Date(year, month, 0).getDate();
  const paddedMonth = String(month).padStart(2, '0');

  return {
    monthKey: `${year}-${paddedMonth}`,
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(endDay).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-CA', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1)),
  };
}

function shiftMonthKey(monthKey, offset) {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(year, month - 1 + offset, 1);

  return getMonthKey(shifted);
}

function toCents(value) {
  const cents = Number(value || 0);
  return Number.isFinite(cents) ? Math.max(Math.round(cents), 0) : 0;
}

function buildCategoryInsights({
  expenses = [],
  categories = [],
  budgetCaps = [],
  billPaymentCents = 0,
}) {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const capByCategoryId = new Map(
    budgetCaps.map((cap) => [cap.category_id, toCents(cap.amount_cents)]),
  );
  const totalsByCategoryId = new Map();

  for (const expense of expenses) {
    const categoryId = expense.category_id || 'uncategorized';
    totalsByCategoryId.set(
      categoryId,
      (totalsByCategoryId.get(categoryId) || 0) + toCents(expense.amount_cents),
    );
  }

  const normalizedBillPaymentCents = toCents(billPaymentCents);
  if (normalizedBillPaymentCents > 0) {
    totalsByCategoryId.set('bill-payments', normalizedBillPaymentCents);
  }

  const totalSpentCents = [...totalsByCategoryId.values()].reduce(
    (total, amountCents) => total + amountCents,
    0,
  );
  const rows = [...totalsByCategoryId.entries()]
    .map(([categoryId, amountCents]) => {
      const category = categoryById.get(categoryId);
      const capCents = capByCategoryId.get(categoryId) || 0;
      const capProgress = capCents > 0 ? amountCents / capCents : 0;

      return {
        categoryId,
        name:
          categoryId === 'bill-payments'
            ? 'Bill payments'
            : category?.name || 'Uncategorized',
        color:
          categoryId === 'bill-payments'
            ? '#657180'
            : category?.color || '#7A6957',
        amountCents,
        sharePercent:
          totalSpentCents > 0
            ? Math.round((amountCents / totalSpentCents) * 100)
            : 0,
        capCents,
        capRemainingCents: capCents > 0 ? capCents - amountCents : null,
        capPercent: capCents > 0 ? Math.round(capProgress * 100) : null,
        capTone:
          capCents === 0
            ? 'none'
            : capProgress > 1
              ? 'danger'
              : capProgress >= 0.8
                ? 'warning'
                : 'success',
      };
    })
    .sort(
      (left, right) =>
        right.amountCents - left.amountCents || left.name.localeCompare(right.name),
    );

  return {
    totalSpentCents,
    rows,
    largestCategory: rows[0] || null,
  };
}

function filterTransactions(
  transactions,
  { type = 'all', categoryId = 'all', query = '' } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return transactions.filter((transaction) => {
    if (type !== 'all' && transaction.type !== type) {
      return false;
    }

    if (categoryId !== 'all' && transaction.categoryId !== categoryId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [transaction.title, transaction.subtitle, transaction.note]
      .filter(Boolean)
      .some((value) =>
        String(value).toLocaleLowerCase().includes(normalizedQuery),
      );
  });
}

function summarizeTransactions(transactions) {
  return transactions.reduce(
    (summary, transaction) => {
      const amountCents = toCents(transaction.amountCents);

      if (transaction.type === 'income') {
        summary.incomeCents += amountCents;
      } else if (transaction.type !== 'transfer' && !transaction.isTransfer) {
        summary.spentCents += amountCents;
      }

      summary.netCents = summary.incomeCents - summary.spentCents;
      return summary;
    },
    { incomeCents: 0, spentCents: 0, netCents: 0 },
  );
}

module.exports = {
  buildCategoryInsights,
  filterTransactions,
  getMonthKey,
  getMonthRangeForKey,
  shiftMonthKey,
  summarizeTransactions,
};
