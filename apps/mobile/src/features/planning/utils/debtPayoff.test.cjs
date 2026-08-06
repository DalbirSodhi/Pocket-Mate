const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEBT_PAYOFF_STRATEGIES,
  MAX_SIMULATION_MONTHS,
  calculateDebtPayoff,
  calculateMonthlyInterestCents,
  getPriorityOrder,
} = require('./debtPayoff.cjs');

function buildDebt(overrides = {}) {
  return {
    id: 'card-a',
    name: 'Card A',
    balanceCents: 100000,
    aprBasisPoints: 2400,
    minimumPaymentCents: 5000,
    ...overrides,
  };
}

test('monthly interest uses integer half-up rounding without losing cents', () => {
  assert.equal(calculateMonthlyInterestCents(10005, 1200), 100);
  assert.equal(calculateMonthlyInterestCents(10050, 1200), 101);
});

test('validates debt values and monthly extra payment as positive integers', () => {
  const validInput = {
    debts: [buildDebt()],
    monthlyExtraPaymentCents: 1000,
    startDate: '2026-08-31',
  };

  assert.throws(
    () =>
      calculateDebtPayoff({
        ...validInput,
        debts: [buildDebt({ balanceCents: 0 })],
      }),
    /balanceCents must be a positive safe integer/,
  );
  assert.throws(
    () =>
      calculateDebtPayoff({
        ...validInput,
        debts: [buildDebt({ aprBasisPoints: 12.5 })],
      }),
    /aprBasisPoints must be a positive safe integer/,
  );
  assert.throws(
    () =>
      calculateDebtPayoff({
        ...validInput,
        debts: [buildDebt({ minimumPaymentCents: -1 })],
      }),
    /minimumPaymentCents must be a positive safe integer/,
  );
  assert.throws(
    () =>
      calculateDebtPayoff({
        ...validInput,
        monthlyExtraPaymentCents: 0,
      }),
    /monthlyExtraPaymentCents must be a positive safe integer/,
  );
});

test('avalanche targets the highest APR after all minimum payments', () => {
  const result = calculateDebtPayoff({
    debts: [
      buildDebt({ id: 'high-apr', balanceCents: 10000, minimumPaymentCents: 1000 }),
      buildDebt({
        id: 'small-balance',
        balanceCents: 5000,
        aprBasisPoints: 1200,
        minimumPaymentCents: 500,
      }),
    ],
    monthlyExtraPaymentCents: 500,
    strategy: DEBT_PAYOFF_STRATEGIES.AVALANCHE,
    startDate: '2026-08-15',
  });

  assert.deepEqual(
    result.schedule[0].payments.map(({ debtId, extraPaymentCents }) => ({
      debtId,
      extraPaymentCents,
    })),
    [
      { debtId: 'high-apr', extraPaymentCents: 500 },
      { debtId: 'small-balance', extraPaymentCents: 0 },
    ],
  );
});

test('snowball targets the lowest current balance after minimum payments', () => {
  const result = calculateDebtPayoff({
    debts: [
      buildDebt({ id: 'high-apr', balanceCents: 10000, minimumPaymentCents: 1000 }),
      buildDebt({
        id: 'small-balance',
        balanceCents: 5000,
        aprBasisPoints: 1200,
        minimumPaymentCents: 500,
      }),
    ],
    monthlyExtraPaymentCents: 500,
    strategy: DEBT_PAYOFF_STRATEGIES.SNOWBALL,
    startDate: '2026-08-15',
  });

  assert.deepEqual(
    result.schedule[0].payments.map(({ debtId, extraPaymentCents }) => ({
      debtId,
      extraPaymentCents,
    })),
    [
      { debtId: 'high-apr', extraPaymentCents: 0 },
      { debtId: 'small-balance', extraPaymentCents: 500 },
    ],
  );
});

test('priority ties retain the original debt order', () => {
  const debts = [
    { ...buildDebt({ id: 'first' }), originalIndex: 0 },
    { ...buildDebt({ id: 'second' }), originalIndex: 1 },
  ];

  assert.deepEqual(
    getPriorityOrder(debts, DEBT_PAYOFF_STRATEGIES.AVALANCHE).map(
      (debt) => debt.id,
    ),
    ['first', 'second'],
  );
  assert.deepEqual(
    getPriorityOrder(debts, DEBT_PAYOFF_STRATEGIES.SNOWBALL).map(
      (debt) => debt.id,
    ),
    ['first', 'second'],
  );
});

test('freed minimum payments roll into the next priority debt', () => {
  const result = calculateDebtPayoff({
    debts: [
      buildDebt({
        id: 'first',
        balanceCents: 1000,
        aprBasisPoints: 1,
        minimumPaymentCents: 600,
      }),
      buildDebt({
        id: 'second',
        balanceCents: 5000,
        aprBasisPoints: 1,
        minimumPaymentCents: 500,
      }),
    ],
    monthlyExtraPaymentCents: 100,
    strategy: DEBT_PAYOFF_STRATEGIES.AVALANCHE,
    startDate: '2026-01-31',
  });

  assert.equal(result.monthlyPaymentBudgetCents, 1200);
  assert.equal(result.schedule[0].payments[0].paymentCents, 700);
  assert.equal(result.schedule[1].payments[0].paymentCents, 300);
  assert.equal(result.schedule[1].payments[1].paymentCents, 900);
  assert.equal(result.schedule[1].paymentCents, 1200);
  assert.equal(result.schedule[1].paymentDate, '2026-02-28');
});

test('returns an exact schedule, payoff date, and total interest', () => {
  const result = calculateDebtPayoff({
    debts: [
      buildDebt({
        balanceCents: 10000,
        aprBasisPoints: 1200,
        minimumPaymentCents: 4000,
      }),
    ],
    monthlyExtraPaymentCents: 1000,
    startDate: '2026-01-31',
  });

  assert.equal(result.isPaidOff, true);
  assert.equal(result.payoffMonth, 3);
  assert.equal(result.payoffDate, '2026-03-31');
  assert.equal(result.totalInterestCents, 153);
  assert.equal(result.remainingBalanceCents, 0);
  assert.deepEqual(
    result.schedule.map(({ paymentCents, closingBalanceCents }) => ({
      paymentCents,
      closingBalanceCents,
    })),
    [
      { paymentCents: 5000, closingBalanceCents: 5100 },
      { paymentCents: 5000, closingBalanceCents: 151 },
      { paymentCents: 153, closingBalanceCents: 0 },
    ],
  );
  assert.equal(result.schedule[2].unusedPaymentCents, 4847);
});

test('warns and safely caps a non-amortizing simulation', () => {
  const result = calculateDebtPayoff({
    debts: [
      buildDebt({
        balanceCents: 100000,
        aprBasisPoints: 1200,
        minimumPaymentCents: 500,
      }),
    ],
    monthlyExtraPaymentCents: 100,
    startDate: '2026-01-01',
    maxMonths: MAX_SIMULATION_MONTHS + 5000,
  });

  assert.equal(result.isPaidOff, false);
  assert.equal(result.payoffMonth, null);
  assert.equal(result.payoffDate, null);
  assert.equal(result.simulationLimitMonths, MAX_SIMULATION_MONTHS);
  assert.equal(result.schedule.length, MAX_SIMULATION_MONTHS);
  assert.ok(
    result.warnings.some(
      ({ code }) => code === 'MINIMUM_PAYMENT_NOT_AMORTIZING',
    ),
  );
  assert.ok(
    result.warnings.some(({ code }) => code === 'SIMULATION_LIMIT_REACHED'),
  );
  assert.ok(result.warnings.some(({ code }) => code === 'PLAN_NOT_AMORTIZING'));
});
