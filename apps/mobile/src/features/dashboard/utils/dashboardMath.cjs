const {
  addDays,
  addMonthsClamped,
  getCalendarDayDifference,
  getLocalDateString,
  parseLocalDateString,
} = require('../../../utils/date.cjs');

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

function getFallbackAnchorDate(payCycle, date) {
  if (payCycle === 'monthly' || payCycle === 'semi_monthly') {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function getFixedDayCycleRange({ anchorDate, cycleLength, date }) {
  const elapsedDays = getCalendarDayDifference(anchorDate, date);
  const elapsedCycles = Math.floor(elapsedDays / cycleLength);
  const start = addDays(anchorDate, elapsedCycles * cycleLength);
  const nextStart = addDays(start, cycleLength);

  return { start, nextStart };
}

function getMonthlyCycleRange({ anchorDate, date }) {
  const preferredDay = anchorDate.getDate();
  let start = addMonthsClamped(date, 0, preferredDay);

  if (start > date) {
    start = addMonthsClamped(date, -1, preferredDay);
  }

  return {
    start,
    nextStart: addMonthsClamped(start, 1, preferredDay),
  };
}

function getSemiMonthlyBoundaries(anchorDate, date) {
  const anchorDay = anchorDate.getDate();
  const firstDay = anchorDay > 15 ? anchorDay - 15 : anchorDay;
  const secondDay = firstDay + 15;
  const boundaries = [];

  for (let monthOffset = -2; monthOffset <= 2; monthOffset += 1) {
    const month = new Date(
      date.getFullYear(),
      date.getMonth() + monthOffset,
      1,
      12,
    );
    boundaries.push(addMonthsClamped(month, 0, firstDay));
    boundaries.push(addMonthsClamped(month, 0, secondDay));
  }

  return boundaries
    .filter(
      (boundary, index, values) =>
        index ===
        values.findIndex(
          (value) => getLocalDateString(value) === getLocalDateString(boundary),
        ),
    )
    .sort((left, right) => left - right);
}

function getSemiMonthlyCycleRange({ anchorDate, date }) {
  const boundaries = getSemiMonthlyBoundaries(anchorDate, date);
  const start =
    [...boundaries].reverse().find((boundary) => boundary <= date) ||
    boundaries[0];
  const nextStart =
    boundaries.find((boundary) => boundary > date) ||
    addMonthsClamped(start, 1);

  return { start, nextStart };
}

function formatCycleLabel(startDate, endDate) {
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
  const startMonth = startDate.toLocaleDateString('en-CA', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-CA', { month: 'short' });

  if (sameMonth) {
    return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }

  if (sameYear) {
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
  }

  return `${startMonth} ${startDate.getDate()}, ${startDate.getFullYear()} - ${endMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
}

function getPayCycleRange({
  payCycle = 'monthly',
  anchorDate: anchorDateValue,
  date = new Date(),
}) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );
  const configuredAnchor = parseLocalDateString(anchorDateValue);
  const anchorDate =
    configuredAnchor || getFallbackAnchorDate(payCycle, normalizedDate);
  let range;

  if (payCycle === 'weekly') {
    range = getFixedDayCycleRange({
      anchorDate,
      cycleLength: 7,
      date: normalizedDate,
    });
  } else if (payCycle === 'bi_weekly') {
    range = getFixedDayCycleRange({
      anchorDate,
      cycleLength: 14,
      date: normalizedDate,
    });
  } else if (payCycle === 'semi_monthly') {
    range = getSemiMonthlyCycleRange({ anchorDate, date: normalizedDate });
  } else {
    range = getMonthlyCycleRange({ anchorDate, date: normalizedDate });
  }

  const end = addDays(range.nextStart, -1);

  return {
    startDate: getLocalDateString(range.start),
    endDate: getLocalDateString(end),
    nextPayday: getLocalDateString(range.nextStart),
    daysUntilNextPayday: Math.max(
      getCalendarDayDifference(normalizedDate, range.nextStart),
      1,
    ),
    label: formatCycleLabel(range.start, end),
    isConfigured: Boolean(configuredAnchor),
  };
}

function getCycleSavingsContribution(monthlyContributionCents, payCycle) {
  const monthlyAmount = Number(monthlyContributionCents || 0);

  if (payCycle === 'weekly') {
    return Math.round((monthlyAmount * 12) / 52);
  }

  if (payCycle === 'bi_weekly') {
    return Math.round((monthlyAmount * 12) / 26);
  }

  if (payCycle === 'semi_monthly') {
    return Math.round(monthlyAmount / 2);
  }

  return monthlyAmount;
}

function calculateSafeToSpend({
  availableCents,
  daysUntilNextPayday,
  shortfallCents = 0,
}) {
  if (shortfallCents > 0) {
    return 0;
  }

  return Math.floor(
    Math.max(Number(availableCents || 0), 0) /
      Math.max(Number(daysUntilNextPayday || 1), 1),
  );
}

function isMonthlyChargeInRange({ chargeDay, startDate, endDate }) {
  const start = parseLocalDateString(startDate);
  const end = parseLocalDateString(endDate);

  if (!start || !end || !Number.isInteger(Number(chargeDay))) {
    return false;
  }

  for (
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
    cursor <= end;
    cursor = addMonthsClamped(cursor, 1, 1)
  ) {
    const chargeDate = addMonthsClamped(cursor, 0, Number(chargeDay));

    if (chargeDate >= start && chargeDate <= end) {
      return true;
    }
  }

  return false;
}

function getNextMonthlyDueDate({ chargeDay, date = new Date(), endDate }) {
  const normalizedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  );

  for (let monthOffset = 0; monthOffset < 2; monthOffset += 1) {
    const month = new Date(
      normalizedDate.getFullYear(),
      normalizedDate.getMonth() + monthOffset,
      1,
      12,
    );
    const dueDate = addMonthsClamped(month, 0, Number(chargeDay));
    const dueDateString = getLocalDateString(dueDate);

    if (dueDate >= normalizedDate && dueDateString <= endDate) {
      return dueDateString;
    }
  }

  return null;
}

function getBudgetPressure(caps = []) {
  const capCents = sumCents(caps, 'amount_cents');
  const spentCents = sumCents(caps, 'spentCents');
  const usagePercent =
    capCents > 0 ? Math.round((spentCents / capCents) * 100) : 0;

  if (caps.length === 0) {
    return {
      label: 'No caps',
      tone: 'neutral',
      usagePercent: 0,
      detail: 'Set category limits to track budget pressure.',
    };
  }

  if (usagePercent >= 100) {
    return {
      label: 'Over limit',
      tone: 'danger',
      usagePercent,
      detail: 'Capped categories have reached their combined limit.',
    };
  }

  if (usagePercent >= 80) {
    return {
      label: 'High',
      tone: 'warning',
      usagePercent,
      detail: 'Little room remains in capped categories this month.',
    };
  }

  if (usagePercent >= 50) {
    return {
      label: 'Moderate',
      tone: 'neutral',
      usagePercent,
      detail: 'More than half of capped spending has been used.',
    };
  }

  return {
    label: 'Low',
    tone: 'success',
    usagePercent,
    detail: 'Capped categories still have comfortable room.',
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
      detail: "Planned outflow is higher than this cycle's income.",
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
  calculateSafeToSpend,
  calculatePlanTotals,
  getBudgetPressure,
  getCycleSavingsContribution,
  getMonthRange,
  getNextMonthlyDueDate,
  getPayCycleRange,
  getPlanHealth,
  isMonthlyChargeInRange,
  sumCents,
};
