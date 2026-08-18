const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProjectedIncomeEvents,
  getRecurringIncomeDates,
} = require('./recurringIncomeMath.cjs');

test('projects weekly and biweekly income from the next expected date', () => {
  assert.deepEqual(
    getRecurringIncomeDates({ cadence: 'weekly', next_expected_on: '2026-08-03' }, '2026-08'),
    ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'],
  );
  assert.deepEqual(
    getRecurringIncomeDates({ cadence: 'biweekly', next_expected_on: '2026-08-05' }, '2026-08'),
    ['2026-08-05', '2026-08-19'],
  );
});

test('projects semi-monthly income using two anchored dates', () => {
  assert.deepEqual(
    getRecurringIncomeDates({ cadence: 'semi_monthly', next_expected_on: '2026-08-15' }, '2026-08'),
    ['2026-08-15', '2026-08-30'],
  );
});

test('does not project received occurrences twice', () => {
  const events = buildProjectedIncomeEvents({
    month: '2026-08',
    schedules: [{ id: 'schedule-1', source: 'Salary', amount_cents: 250000, cadence: 'monthly', next_expected_on: '2026-08-01' }],
    occurrences: [{ schedule_id: 'schedule-1', expected_on: '2026-08-01' }],
  });

  assert.deepEqual(events, []);
});

test('preserves a month-end anchor after a short month', () => {
  assert.deepEqual(
    getRecurringIncomeDates(
      { cadence: 'monthly', anchor_day: 31, next_expected_on: '2026-02-28' },
      '2026-03',
    ),
    ['2026-03-31'],
  );
});
