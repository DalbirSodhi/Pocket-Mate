const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertPositiveCents,
  assertSplitsMatchParent,
  buildCategorizedAdjustments,
  getRemainingRefundableCents,
  summarizeTransactions,
} = require('./transactionMath.cjs');

test('positive cents must be safe integers greater than zero', () => {
  assert.equal(assertPositiveCents(1), 1);
  assert.equal(assertPositiveCents(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);

  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => assertPositiveCents(value), /positive safe integer/);
  }
});

test('split amounts must exactly reconcile with the parent amount', () => {
  assert.equal(
    assertSplitsMatchParent(10000, [
      { amountCents: 2500 },
      { amountCents: 7500 },
    ]),
    10000,
  );

  assert.throws(
    () => assertSplitsMatchParent(10000, [2500, 7499]),
    /must equal parent amount/,
  );
  assert.throws(() => assertSplitsMatchParent(10000, []), /at least two splits/);
  assert.throws(() => assertSplitsMatchParent(10000, [10000]), /at least two splits/);
  assert.throws(
    () => assertSplitsMatchParent(10000, [{ amountCents: 0 }, { amountCents: 10000 }]),
    /positive safe integer/,
  );
});

test('splits replace parent categories and preserve expense dates', () => {
  const result = buildCategorizedAdjustments({
    expenses: [{ id: 'expense', category_id: 'other', amount_cents: 10001, spent_on: '2026-08-03' }],
    splits: [
      { expense_id: 'expense', category_id: 'food', amount_cents: 5001 },
      { expense_id: 'expense', category_id: 'travel', amount_cents: 5000 },
    ],
  });

  assert.deepEqual(
    result.categorizedExpenses.map(({ id, category_id, amount_cents, spent_on }) => ({ id, category_id, amount_cents, spent_on })),
    [
      { id: 'expense', category_id: 'food', amount_cents: 5001, spent_on: '2026-08-03' },
      { id: 'expense', category_id: 'travel', amount_cents: 5000, spent_on: '2026-08-03' },
    ],
  );
});

test('refunds are allocated across splits without losing cents', () => {
  const result = buildCategorizedAdjustments({
    expenses: [{ id: 'expense', category_id: 'other', amount_cents: 10000 }],
    splits: [
      { expense_id: 'expense', category_id: 'food', amount_cents: 7000 },
      { expense_id: 'expense', category_id: 'travel', amount_cents: 3000 },
    ],
    refunds: [{ id: 'refund', expense_id: 'expense', amount_cents: 3333 }],
  });

  assert.deepEqual(
    result.categorizedRefunds.map(({ category_id, amount_cents }) => ({ category_id, amount_cents })),
    [
      { category_id: 'food', amount_cents: 2333 },
      { category_id: 'travel', amount_cents: 1000 },
    ],
  );
  assert.equal(
    result.categorizedRefunds.reduce((total, refund) => total + refund.amount_cents, 0),
    3333,
  );
});

test('remaining refundable cents account for partial refunds', () => {
  assert.equal(getRemainingRefundableCents(10000), 10000);
  assert.equal(
    getRemainingRefundableCents(10000, [
      { amountCents: 1250 },
      { amountCents: 3750 },
    ]),
    5000,
  );
  assert.equal(getRemainingRefundableCents(10000, [4000, 6000]), 0);
});

test('refund totals cannot exceed the original expense', () => {
  assert.throws(
    () => getRemainingRefundableCents(10000, [6000, 4001]),
    /cannot exceed the original amount/,
  );
  assert.throws(
    () => getRemainingRefundableCents(10000, [0]),
    /positive safe integer/,
  );
});

test('posted transaction summary preserves accounting semantics', () => {
  assert.deepEqual(
    summarizeTransactions([
      { kind: 'income', status: 'posted', amountCents: 100000 },
      { kind: 'expense', status: 'posted', amountCents: 30000 },
      { kind: 'refund', status: 'posted', amountCents: 5000 },
      {
        kind: 'transfer',
        status: 'posted',
        amountCents: 12000,
        cashDirection: 'in',
      },
      {
        kind: 'card_payment',
        status: 'posted',
        amountCents: 20000,
        cashDirection: 'out',
      },
    ]),
    {
      incomeCents: 100000,
      expenseCents: 30000,
      refundCents: 5000,
      spentCents: 25000,
      netCents: 75000,
      cashAccountMovementCents: 67000,
    },
  );
});

test('unposted and void transactions are excluded', () => {
  assert.deepEqual(
    summarizeTransactions([
      { kind: 'income', status: 'pending', amountCents: 90000 },
      { kind: 'expense', status: 'void', amountCents: 20000 },
      { kind: 'income', status: 'posted', amountCents: 50000 },
    ]),
    {
      incomeCents: 50000,
      expenseCents: 0,
      refundCents: 0,
      spentCents: 0,
      netCents: 50000,
      cashAccountMovementCents: 50000,
    },
  );
});

test('posted transfers and card payments require account direction', () => {
  assert.throws(
    () =>
      summarizeTransactions([
        { kind: 'transfer', status: 'posted', amountCents: 1000 },
      ]),
    /cashDirection "in" or "out"/,
  );
});
