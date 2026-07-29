const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateActualBalance,
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
} = require('./dashboardMath.cjs');

test('actual balance is monthly income minus recorded spending', () => {
  assert.equal(
    calculateActualBalance({
      incomeCents: 82700,
      expenseCents: 26513,
    }),
    56187,
  );
});

test('getMonthRange returns the full leap-year month', () => {
  const result = getMonthRange(new Date(2028, 1, 10));

  assert.deepEqual(
    {
      startDate: result.startDate,
      endDate: result.endDate,
    },
    {
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    },
  );
});

test('getMonthRange resets on the first and counts the remaining month days', () => {
  const result = getMonthRange(new Date(2026, 6, 29));

  assert.equal(result.nextMonthStartDate, '2026-08-01');
  assert.equal(result.daysUntilReset, 3);
});

test('sumCents adds numeric and serialized database values', () => {
  const result = sumCents(
    [
      { amount_cents: 1200 },
      { amount_cents: '350' },
      { amount_cents: null },
    ],
    'amount_cents',
  );

  assert.equal(result, 1550);
});

test('calculatePlanTotals reserves fixed expenses and card bills', () => {
  assert.deepEqual(
    calculatePlanTotals({
      incomeCents: 500000,
      expenseCents: 75000,
      fixedExpenseCents: 180000,
      cardBillCents: 45000,
      savingsContributionCents: 25000,
    }),
    {
      committedCents: 250000,
      totalOutflowCents: 325000,
      availableCents: 175000,
      shortfallCents: 0,
    },
  );
});

test('getPlanHealth identifies healthy and overcommitted plans', () => {
  assert.equal(
    getPlanHealth({
      incomeCents: 100000,
      totalOutflowCents: 50000,
    }).label,
    'Healthy',
  );
  assert.equal(
    getPlanHealth({
      incomeCents: 100000,
      totalOutflowCents: 110000,
    }).label,
    'Overcommitted',
  );
});

test('getPlanHealth prioritizes breached budget caps', () => {
  assert.equal(
    getPlanHealth({
      incomeCents: 100000,
      totalOutflowCents: 50000,
      overBudgetCaps: 2,
    }).label,
    'Needs attention',
  );
});

test('calculatePlanTotals reports a plan shortfall', () => {
  assert.equal(
    calculatePlanTotals({
      incomeCents: 10000,
      expenseCents: 8000,
      fixedExpenseCents: 5000,
      cardBillCents: 2000,
    }).shortfallCents,
    5000,
  );
});

test('getPayCycleRange calculates weekly and bi-weekly boundaries from payday', () => {
  assert.deepEqual(
    getPayCycleRange({
      payCycle: 'weekly',
      anchorDate: '2026-07-03',
      date: new Date(2026, 6, 27),
    }),
    {
      startDate: '2026-07-24',
      endDate: '2026-07-30',
      nextPayday: '2026-07-31',
      daysUntilNextPayday: 4,
      label: 'Jul 24 - 30, 2026',
      isConfigured: true,
    },
  );

  assert.equal(
    getPayCycleRange({
      payCycle: 'bi_weekly',
      anchorDate: '2026-07-03',
      date: new Date(2026, 6, 27),
    }).nextPayday,
    '2026-07-31',
  );
});

test('getPayCycleRange clamps monthly payday at month end', () => {
  assert.deepEqual(
    getPayCycleRange({
      payCycle: 'monthly',
      anchorDate: '2026-01-31',
      date: new Date(2026, 1, 15),
    }),
    {
      startDate: '2026-01-31',
      endDate: '2026-02-27',
      nextPayday: '2026-02-28',
      daysUntilNextPayday: 13,
      label: 'Jan 31 - Feb 27, 2026',
      isConfigured: true,
    },
  );
});

test('getPayCycleRange supports semi-monthly payday pairs', () => {
  const result = getPayCycleRange({
    payCycle: 'semi_monthly',
    anchorDate: '2026-07-15',
    date: new Date(2026, 6, 27),
  });

  assert.equal(result.startDate, '2026-07-15');
  assert.equal(result.nextPayday, '2026-07-30');
  assert.equal(result.daysUntilNextPayday, 3);
});

test('safe-to-spend calculation divides available money across remaining days', () => {
  assert.equal(
    calculateSafeToSpend({
      availableCents: 10000,
      daysRemaining: 4,
    }),
    2500,
  );
  assert.equal(
    calculateSafeToSpend({
      availableCents: 10000,
      daysRemaining: 4,
      shortfallCents: 1,
    }),
    0,
  );
});

test('monthly savings are normalized to the selected pay cycle', () => {
  assert.equal(getCycleSavingsContribution(52000, 'weekly'), 12000);
  assert.equal(getCycleSavingsContribution(52000, 'bi_weekly'), 24000);
  assert.equal(getCycleSavingsContribution(52000, 'semi_monthly'), 26000);
  assert.equal(getCycleSavingsContribution(52000, 'monthly'), 52000);
});

test('monthly recurring charges are reserved only when due in the cycle', () => {
  assert.equal(
    isMonthlyChargeInRange({
      chargeDay: 31,
      startDate: '2026-02-20',
      endDate: '2026-03-05',
    }),
    true,
  );
  assert.equal(
    isMonthlyChargeInRange({
      chargeDay: 15,
      startDate: '2026-02-20',
      endDate: '2026-03-05',
    }),
    false,
  );
});

test('next monthly due date skips past charges and clamps month end', () => {
  assert.equal(
    getNextMonthlyDueDate({
      chargeDay: 2,
      date: new Date(2026, 6, 27),
      endDate: '2026-08-09',
    }),
    '2026-08-02',
  );
  assert.equal(
    getNextMonthlyDueDate({
      chargeDay: 31,
      date: new Date(2026, 1, 20),
      endDate: '2026-03-05',
    }),
    '2026-02-28',
  );
});

test('budget pressure reflects combined category-cap usage', () => {
  assert.deepEqual(
    getBudgetPressure([
      { amount_cents: 40000, spentCents: 20000 },
      { amount_cents: 60000, spentCents: 65000 },
    ]),
    {
      label: 'High',
      tone: 'warning',
      usagePercent: 85,
      detail: 'Little room remains in capped categories this month.',
    },
  );
  assert.equal(getBudgetPressure([]).label, 'No caps');
});
