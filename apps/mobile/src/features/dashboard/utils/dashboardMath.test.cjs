const assert = require('node:assert/strict');
const test = require('node:test');

const { getMonthRange, sumCents } = require('./dashboardMath.cjs');

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
