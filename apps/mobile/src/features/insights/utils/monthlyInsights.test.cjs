const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCategoryInsights,
  filterTransactions,
  getMonthRangeForKey,
  shiftMonthKey,
  summarizeTransactions,
} = require('./monthlyInsights.cjs');

test('month ranges handle leap years and year boundaries', () => {
  assert.deepEqual(getMonthRangeForKey('2028-02'), {
    monthKey: '2028-02',
    startDate: '2028-02-01',
    endDate: '2028-02-29',
    label: 'February 2028',
  });
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
});

test('category insights reconcile expenses, bill payments, and caps', () => {
  const result = buildCategoryInsights({
    expenses: [
      { category_id: 'food', amount_cents: 12000 },
      { category_id: 'food', amount_cents: 8000 },
      { category_id: 'travel', amount_cents: 10000 },
    ],
    categories: [
      { id: 'food', name: 'Food', color: '#111111' },
      { id: 'travel', name: 'Travel', color: '#222222' },
    ],
    budgetCaps: [{ category_id: 'food', amount_cents: 25000 }],
    billPaymentCents: 10000,
  });

  assert.equal(result.totalSpentCents, 40000);
  assert.equal(result.rows[0].name, 'Food');
  assert.equal(result.rows[0].sharePercent, 50);
  assert.equal(result.rows[0].capPercent, 80);
  assert.equal(result.rows[0].capTone, 'warning');
  assert.equal(result.rows[1].name, 'Bill payments');
});

test('transaction filters combine type, category, and text search', () => {
  const transactions = [
    {
      id: '1',
      type: 'expense',
      categoryId: 'food',
      title: 'Market',
      subtitle: 'Food',
    },
    {
      id: '2',
      type: 'expense',
      categoryId: 'travel',
      title: 'Train',
      subtitle: 'Transport',
    },
    {
      id: '3',
      type: 'income',
      categoryId: null,
      title: 'Salary',
      subtitle: 'Money received',
    },
  ];

  assert.deepEqual(
    filterTransactions(transactions, {
      type: 'expense',
      categoryId: 'food',
      query: 'market',
    }).map((item) => item.id),
    ['1'],
  );
  assert.deepEqual(
    filterTransactions(transactions, { query: 'salary' }).map((item) => item.id),
    ['3'],
  );
});

test('transaction summary calculates income, spent, and net', () => {
  assert.deepEqual(
    summarizeTransactions([
      { type: 'income', amountCents: 100000 },
      { type: 'expense', amountCents: 25000 },
      { type: 'bill_payment', amountCents: 10000 },
      { type: 'transfer', amountCents: 50000 },
      { type: 'bill_payment', amountCents: 25000, isTransfer: true },
      { type: 'refund', amountCents: 5000 },
    ]),
    { incomeCents: 100000, spentCents: 30000, netCents: 70000 },
  );
});
