const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertValidPayCycleSettings,
  getDefaultPayCycleAnchorDate,
  getInitialPayCycleFormValues,
  getPayCycleAnchorHint,
  validatePayCycleSettings,
} = require('./payCycleProfile.cjs');

const TODAY = new Date(2026, 7, 13, 12);

test('defaults new profiles to the first day of the current month', () => {
  assert.equal(getDefaultPayCycleAnchorDate(TODAY), '2026-08-01');
  assert.deepEqual(getInitialPayCycleFormValues({}, TODAY), {
    payCycle: 'monthly',
    payCycleAnchorDate: '2026-08-01',
  });
});

test('preserves stored pay cycle and anchor date when editing a profile', () => {
  assert.deepEqual(
    getInitialPayCycleFormValues(
      {
        pay_cycle: 'bi_weekly',
        pay_cycle_anchor_date: '2026-08-07',
      },
      TODAY,
    ),
    {
      payCycle: 'bi_weekly',
      payCycleAnchorDate: '2026-08-07',
    },
  );
});

test('recovers a valid anchor from the legacy start day without choosing a future date', () => {
  assert.deepEqual(
    getInitialPayCycleFormValues({ pay_cycle_start_day: 31 }, TODAY),
    {
      payCycle: 'monthly',
      payCycleAnchorDate: '2026-07-31',
    },
  );
});

test('validates supported cycles, real calendar dates, and non-future anchors', () => {
  assert.deepEqual(
    validatePayCycleSettings({
      payCycle: 'semi_monthly',
      payCycleAnchorDate: '2026-08-01',
      today: TODAY,
    }),
    {},
  );
  assert.deepEqual(
    validatePayCycleSettings({
      payCycle: 'monthly',
      payCycleAnchorDate: '2026-02-31',
      today: TODAY,
    }),
    { payCycleAnchorDate: 'Enter a valid payday date in YYYY-MM-DD format.' },
  );
  assert.deepEqual(
    validatePayCycleSettings({
      payCycle: 'weekly',
      payCycleAnchorDate: '2026-08-14',
      today: TODAY,
    }),
    { payCycleAnchorDate: 'The most recent payday cannot be in the future.' },
  );
  assert.deepEqual(
    validatePayCycleSettings({
      payCycle: 'yearly',
      payCycleAnchorDate: '2026-08-01',
      today: TODAY,
    }),
    { payCycle: 'Choose a valid pay cycle.' },
  );
  assert.throws(
    () =>
      assertValidPayCycleSettings({
        payCycle: 'monthly',
        payCycleAnchorDate: '2026-08-14',
        today: TODAY,
      }),
    /cannot be in the future/,
  );
});

test('explains how each selected cycle uses the anchor date', () => {
  assert.match(getPayCycleAnchorHint('weekly'), /7 days/);
  assert.match(getPayCycleAnchorHint('bi_weekly'), /14 days/);
  assert.match(getPayCycleAnchorHint('semi_monthly'), /15 days/);
  assert.match(getPayCycleAnchorHint('monthly'), /shorter months/);
});
