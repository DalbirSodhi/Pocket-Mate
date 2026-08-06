const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ROLLOVER_MODES,
  calculateBudgetAllocation,
  calculateBudgetRolloverChain,
  calculateRolloverOut,
  normalizeCents,
} = require('./budgetRollover.cjs');

test('normalizeCents returns finite integer cents', () => {
  assert.equal(normalizeCents(100.6), 101);
  assert.equal(normalizeCents('-25.4'), -25);
  assert.equal(normalizeCents(Number.NaN), 0);
  assert.equal(normalizeCents(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeCents(null), 0);
});

test('none mode discards both positive and negative remaining amounts', () => {
  assert.equal(calculateRolloverOut(2500, ROLLOVER_MODES.NONE), 0);
  assert.equal(calculateRolloverOut(-2500, ROLLOVER_MODES.NONE), 0);
});

test('positive-only mode carries surplus but not overspending', () => {
  assert.equal(
    calculateRolloverOut(2500, ROLLOVER_MODES.POSITIVE_ONLY),
    2500,
  );
  assert.equal(
    calculateRolloverOut(-2500, ROLLOVER_MODES.POSITIVE_ONLY),
    0,
  );
});

test('full mode carries signed surplus and overspending', () => {
  assert.equal(calculateRolloverOut(2500, ROLLOVER_MODES.FULL), 2500);
  assert.equal(calculateRolloverOut(-2500, ROLLOVER_MODES.FULL), -2500);
});

test('allocation calculates available, remaining, and signed rollover values', () => {
  assert.deepEqual(
    calculateBudgetAllocation({
      plannedAmountCents: 10000.4,
      spentAmountCents: 13000.6,
      rolloverInCents: 2000.5,
      rolloverMode: ROLLOVER_MODES.FULL,
    }),
    {
      plannedAmountCents: 10000,
      spentAmountCents: 13001,
      rolloverMode: ROLLOVER_MODES.FULL,
      rolloverInCents: 2001,
      availableCents: 12001,
      remainingCents: -1000,
      rolloverOutCents: -1000,
    },
  );
});

test('chain orders months and feeds each signed rollover into the next month', () => {
  assert.deepEqual(
    calculateBudgetRolloverChain([
      {
        id: 'mar',
        monthStart: '2026-03-01',
        plannedAmountCents: 10000,
        spentAmountCents: 9000,
        rolloverMode: ROLLOVER_MODES.NONE,
      },
      {
        id: 'jan',
        monthStart: '2026-01-01',
        plannedAmountCents: 10000,
        spentAmountCents: 7000,
        rolloverMode: ROLLOVER_MODES.POSITIVE_ONLY,
      },
      {
        id: 'feb',
        monthStart: '2026-02-01',
        plannedAmountCents: 10000,
        spentAmountCents: 15000,
        rolloverMode: ROLLOVER_MODES.FULL,
      },
    ]).map(({ id, rolloverInCents, availableCents, remainingCents, rolloverOutCents }) => ({
      id,
      rolloverInCents,
      availableCents,
      remainingCents,
      rolloverOutCents,
    })),
    [
      {
        id: 'jan',
        rolloverInCents: 0,
        availableCents: 10000,
        remainingCents: 3000,
        rolloverOutCents: 3000,
      },
      {
        id: 'feb',
        rolloverInCents: 3000,
        availableCents: 13000,
        remainingCents: -2000,
        rolloverOutCents: -2000,
      },
      {
        id: 'mar',
        rolloverInCents: -2000,
        availableCents: 8000,
        remainingCents: -1000,
        rolloverOutCents: 0,
      },
    ],
  );
});

test('editing an earlier month deterministically recomputes every later month', () => {
  const allocations = [
    {
      monthStart: '2026-01-01',
      plannedAmountCents: 10000,
      spentAmountCents: 8000,
      rolloverMode: ROLLOVER_MODES.FULL,
    },
    {
      monthStart: '2026-02-01',
      plannedAmountCents: 10000,
      spentAmountCents: 9000,
      rolloverMode: ROLLOVER_MODES.FULL,
    },
    {
      monthStart: '2026-03-01',
      plannedAmountCents: 10000,
      spentAmountCents: 10000,
      rolloverMode: ROLLOVER_MODES.FULL,
    },
  ];
  const original = calculateBudgetRolloverChain(allocations);
  const edited = calculateBudgetRolloverChain([
    { ...allocations[0], spentAmountCents: 13000 },
    ...allocations.slice(1),
  ]);
  const repeated = calculateBudgetRolloverChain([
    { ...allocations[0], spentAmountCents: 13000 },
    ...allocations.slice(1),
  ]);

  assert.deepEqual(
    original.map((month) => month.rolloverOutCents),
    [2000, 3000, 3000],
  );
  assert.deepEqual(
    edited.map((month) => month.rolloverOutCents),
    [-3000, -2000, -2000],
  );
  assert.deepEqual(edited, repeated);
});

test('chain accepts an explicit signed opening rollover', () => {
  const [month] = calculateBudgetRolloverChain(
    [
      {
        planned_amount_cents: 10000,
        spent_amount_cents: 4000,
        rollover_mode: ROLLOVER_MODES.FULL,
      },
    ],
    { openingRolloverInCents: -1500 },
  );

  assert.equal(month.rolloverInCents, -1500);
  assert.equal(month.availableCents, 8500);
  assert.equal(month.remainingCents, 4500);
  assert.equal(month.rolloverOutCents, 4500);
});

test('invalid rollover modes throw', () => {
  assert.throws(
    () => calculateRolloverOut(1000, 'surplus_and_magic'),
    /Invalid rollover mode/,
  );
  assert.throws(
    () =>
      calculateBudgetAllocation({
        rolloverMode: '',
      }),
    /Invalid rollover mode/,
  );
});
