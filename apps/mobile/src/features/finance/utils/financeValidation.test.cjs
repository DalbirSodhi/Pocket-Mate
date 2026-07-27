const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getLocalDateString,
  isValidDateString,
  parseAmountToCents,
  validateEntry,
} = require('./financeValidation.cjs');

test('parseAmountToCents accepts common money input', () => {
  assert.equal(parseAmountToCents('19.95'), 1995);
  assert.equal(parseAmountToCents('$1,250'), 125000);
  assert.equal(parseAmountToCents('0.01'), 1);
});

test('parseAmountToCents rejects invalid amounts', () => {
  assert.equal(parseAmountToCents(''), null);
  assert.equal(parseAmountToCents('0'), null);
  assert.equal(parseAmountToCents('12.999'), null);
  assert.equal(parseAmountToCents('-4'), null);
});

test('isValidDateString rejects impossible calendar dates', () => {
  assert.equal(isValidDateString('2026-02-28'), true);
  assert.equal(isValidDateString('2026-02-29'), false);
  assert.equal(isValidDateString('07/26/2026'), false);
});

test('getLocalDateString returns an ISO local date', () => {
  assert.equal(getLocalDateString(new Date(2026, 6, 26, 12)), '2026-07-26');
});

test('validateEntry reports amount and date errors together', () => {
  assert.deepEqual(validateEntry({ amount: 'free', date: 'tomorrow' }), {
    amount: 'Enter an amount greater than zero with up to two decimals.',
    date: 'Use a valid date in YYYY-MM-DD format.',
  });
});
