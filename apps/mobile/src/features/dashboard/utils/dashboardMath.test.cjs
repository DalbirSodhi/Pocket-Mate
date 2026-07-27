const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculatePlanTotals,
  getMonthRange,
  getPlanHealth,
  sumCents,
} = require('./dashboardMath.cjs');

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
