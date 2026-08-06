const { getMonthRangeForKey, shiftMonthKey } = require('./monthlyInsights.cjs');

function buildCashFlowTrend(transactions = [], endMonthKey, monthCount = 6) {
  const count = Math.min(Math.max(Number(monthCount) || 6, 2), 24);
  const months = Array.from({ length: count }, (_, index) => {
    const monthKey = shiftMonthKey(endMonthKey, index - count + 1);
    return { ...getMonthRangeForKey(monthKey), incomeCents: 0, spentCents: 0 };
  });
  const byMonth = new Map(months.map((month) => [month.monthKey, month]));

  transactions.forEach((transaction) => {
    const month = byMonth.get(String(transaction.date || '').slice(0, 7));
    if (!month) return;
    const amountCents = Math.max(Math.round(Number(transaction.amountCents) || 0), 0);
    if (transaction.type === 'income') month.incomeCents += amountCents;
    else if (transaction.type === 'refund') month.spentCents -= amountCents;
    else if (transaction.type !== 'transfer' && !transaction.isTransfer) {
      month.spentCents += amountCents;
    }
  });

  months.forEach((month) => {
    month.spentCents = Math.max(month.spentCents, 0);
    month.netCents = month.incomeCents - month.spentCents;
    month.savingsRate = month.incomeCents > 0
      ? Math.round((month.netCents / month.incomeCents) * 100)
      : null;
  });

  const current = months.at(-1);
  const previous = months.at(-2);
  const averageNetCents = Math.round(
    months.reduce((total, month) => total + month.netCents, 0) / months.length,
  );

  return {
    months,
    current,
    averageNetCents,
    netChangeCents: current.netCents - previous.netCents,
    positiveMonths: months.filter((month) => month.netCents >= 0).length,
  };
}

module.exports = { buildCashFlowTrend };
