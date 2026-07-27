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
  savingsContributionCents = 0,
}) {
  const committedCents =
    fixedExpenseCents + cardBillCents + savingsContributionCents;
  const totalOutflowCents = expenseCents + committedCents;

  return {
    committedCents,
    totalOutflowCents,
    availableCents: Math.max(incomeCents - totalOutflowCents, 0),
    shortfallCents: Math.max(totalOutflowCents - incomeCents, 0),
  };
}

function getPlanHealth({ incomeCents, totalOutflowCents, overBudgetCaps = 0 }) {
  if (incomeCents <= 0) {
    return {
      label: 'Add income',
      tone: 'neutral',
      allocationPercent: 0,
      detail: 'Income is needed before plan health can be calculated.',
    };
  }

  const allocationRatio = totalOutflowCents / incomeCents;
  const allocationPercent = Math.round(allocationRatio * 100);

  if (allocationRatio > 1) {
    return {
      label: 'Overcommitted',
      tone: 'danger',
      allocationPercent,
      detail: "Planned outflow is higher than this month's income.",
    };
  }

  if (overBudgetCaps > 0) {
    return {
      label: 'Needs attention',
      tone: 'warning',
      allocationPercent,
      detail: `${overBudgetCaps} budget ${overBudgetCaps === 1 ? 'cap is' : 'caps are'} over limit.`,
    };
  }

  if (allocationRatio >= 0.9) {
    return {
      label: 'Tight',
      tone: 'warning',
      allocationPercent,
      detail: 'Less than 10% of income remains unallocated.',
    };
  }

  if (allocationRatio >= 0.7) {
    return {
      label: 'Watch',
      tone: 'neutral',
      allocationPercent,
      detail: 'Most income is allocated, but the plan remains positive.',
    };
  }

  return {
    label: 'Healthy',
    tone: 'success',
    allocationPercent,
    detail: 'Committed costs leave room for flexible spending.',
  };
}

module.exports = {
  calculatePlanTotals,
  getMonthRange,
  getPlanHealth,
  sumCents,
};
