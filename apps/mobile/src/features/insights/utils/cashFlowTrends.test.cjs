const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCashFlowTrend } = require('./cashFlowTrends.cjs');

test('builds ordered monthly cash flow and subtracts refunds', () => {
  const trend = buildCashFlowTrend([
    { type: 'income', amountCents: 100000, date: '2026-07-01' },
    { type: 'expense', amountCents: 60000, date: '2026-07-02' },
    { type: 'refund', amountCents: 10000, date: '2026-07-03' },
    { type: 'transfer', amountCents: 90000, date: '2026-07-04' },
    { type: 'income', amountCents: 120000, date: '2026-08-01' },
    { type: 'expense', amountCents: 50000, date: '2026-08-02' },
  ], '2026-08', 2);

  assert.deepEqual(trend.months.map((row) => row.monthKey), ['2026-07', '2026-08']);
  assert.equal(trend.months[0].spentCents, 50000);
  assert.equal(trend.months[1].netCents, 70000);
  assert.equal(trend.netChangeCents, 20000);
  assert.equal(trend.positiveMonths, 2);
});

test('returns null savings rate for a month without income', () => {
  const trend = buildCashFlowTrend([], '2026-08', 2);
  assert.equal(trend.current.savingsRate, null);
  assert.equal(trend.averageNetCents, 0);
});
