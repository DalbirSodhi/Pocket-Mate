const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertPositiveCents,
  assertSplitsMatchParent,
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
  assert.throws(() => assertSplitsMatchParent(10000, []), /at least one split/);
  assert.throws(
    () => assertSplitsMatchParent(10000, [{ amountCents: 0 }]),
    /positive safe integer/,
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
