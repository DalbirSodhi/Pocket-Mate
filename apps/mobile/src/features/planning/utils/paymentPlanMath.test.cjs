const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildEqualInstallments,
  getPaymentPlanWindow,
  getPeriodStartDateString,
  hasEqualInstallmentAmounts,
  rebalancePaymentAmounts,
  splitAmount,
  spreadDates,
  validatePaymentPlan,
} = require('./paymentPlanMath.cjs');

test('splitAmount preserves every cent across installments', () => {
  assert.deepEqual(splitAmount(10000, 3), [3334, 3333, 3333]);
});

test('spreadDates includes the start and end of the planning window', () => {
  assert.deepEqual(spreadDates('2026-07-29', '2026-08-16', 3), [
    '2026-07-29',
    '2026-08-07',
    '2026-08-16',
  ]);
});

test('buildEqualInstallments creates editable money values', () => {
  assert.deepEqual(
    buildEqualInstallments({
      totalAmountCents: 280000,
      count: 2,
      startDate: '2026-07-29',
      endDate: '2026-08-16',
    }),
    [
      { amount: '1400.00', plannedOn: '2026-07-29' },
      { amount: '1400.00', plannedOn: '2026-08-16' },
    ],
  );
});

test('payment window supports a user-selected schedule for twelve months', () => {
  assert.deepEqual(
    getPaymentPlanWindow({
      dueOn: '2026-08-16',
      date: new Date(2026, 6, 29),
    }),
    {
      startDate: '2026-07-29',
      endDate: '2027-07-29',
      suggestedEndDate: '2026-08-16',
    },
  );
  assert.equal(getPeriodStartDateString('2026-08-16'), '2026-08-01');
});

test('rebalancePaymentAmounts updates unpaid chunks and preserves paid ones', () => {
  assert.deepEqual(
    rebalancePaymentAmounts({
      installments: [
        {
          amount: '100.00',
          isPaid: true,
          plannedOn: '2026-07-15',
        },
        { amount: '100.00', plannedOn: '2026-08-15' },
        { amount: '100.00', plannedOn: '2026-09-15' },
      ],
      totalAmountCents: 45000,
    }),
    [
      {
        amount: '100.00',
        isPaid: true,
        plannedOn: '2026-07-15',
      },
      { amount: '175.00', plannedOn: '2026-08-15' },
      { amount: '175.00', plannedOn: '2026-09-15' },
    ],
  );
});

test('hasEqualInstallmentAmounts recognizes cent-balanced plans', () => {
  assert.equal(
    hasEqualInstallmentAmounts([
      { amount_cents: 3334 },
      { amount_cents: 3333 },
      { amount_cents: 3333 },
    ]),
    true,
  );
  assert.equal(
    hasEqualInstallmentAmounts([
      { amount_cents: 5000 },
      { amount_cents: 2500 },
    ]),
    false,
  );
});

test('validatePaymentPlan rejects totals and dates outside the window', () => {
  const result = validatePaymentPlan({
    installments: [
      { amount: '100.00', plannedOn: '2026-07-28' },
      { amount: '100.00', plannedOn: '2026-08-17' },
    ],
    totalAmountCents: 30000,
    startDate: '2026-07-29',
    endDate: '2026-08-16',
  });

  assert.equal(result.isValid, false);
  assert.match(result.errors.total, /total 300.00/);
  assert.equal(result.errors.installments[0].date, 'Payment cannot be before today.');
  assert.equal(result.errors.installments[1].date, 'Schedule by 2026-08-16.');
});

test('validatePaymentPlan allows a preserved paid installment in the past', () => {
  const result = validatePaymentPlan({
    installments: [
      {
        amount: '100.00',
        isPaid: true,
        plannedOn: '2026-07-15',
      },
      { amount: '200.00', plannedOn: '2026-08-17' },
    ],
    totalAmountCents: 30000,
    startDate: '2026-07-29',
    endDate: '2027-07-29',
  });

  assert.equal(result.isValid, true);
});
