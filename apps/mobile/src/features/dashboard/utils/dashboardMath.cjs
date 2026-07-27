function sumCents(rows, fieldName) {
  return rows.reduce((total, row) => total + Number(row[fieldName] || 0), 0);
}

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthNumber = String(month + 1).padStart(2, '0');

  return {
    startDate: `${year}-${monthNumber}-01`,
    endDate: `${year}-${monthNumber}-${String(lastDay).padStart(2, '0')}`,
    label: date.toLocaleDateString('en-CA', {
      month: 'long',
      year: 'numeric',
    }),
  };
}

function calculatePlanTotals({
  incomeCents,
  expenseCents,
  fixedExpenseCents,
  cardBillCents,
}) {
  const committedCents = fixedExpenseCents + cardBillCents;
  const totalOutflowCents = expenseCents + committedCents;

  return {
    committedCents,
    totalOutflowCents,
    availableCents: Math.max(incomeCents - totalOutflowCents, 0),
    shortfallCents: Math.max(totalOutflowCents - incomeCents, 0),
  };
}

module.exports = {
  calculatePlanTotals,
  getMonthRange,
  sumCents,
};
