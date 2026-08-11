const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addDays,
  addMonthsClamped,
  getCalendarDayDifference,
  getLocalDateString,
  isValidDateString,
  parseLocalDateString,
} = require('./date.cjs');

test('parseLocalDateString anchors valid dates at local noon', () => {
  const parsed = parseLocalDateString('2026-08-10');

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 10);
  assert.equal(parsed.getHours(), 12);
});

test('addMonthsClamped preserves month-end intent across short months', () => {
  const result = addMonthsClamped(
    parseLocalDateString('2026-01-31'),
    1,
    31,
  );

  assert.equal(getLocalDateString(result), '2026-02-28');
});

test('calendar day difference ignores daylight-saving hour changes', () => {
  assert.equal(
    getCalendarDayDifference(
      new Date(2026, 2, 7, 12),
      new Date(2026, 2, 9, 12),
    ),
    2,
  );
  assert.equal(
    getCalendarDayDifference(
      new Date(2026, 9, 31, 12),
      new Date(2026, 10, 2, 12),
    ),
    2,
  );
});

test('addDays advances calendar days over leap day boundaries', () => {
  assert.equal(
    getLocalDateString(addDays(parseLocalDateString('2028-02-28'), 1)),
    '2028-02-29',
  );
});

test('date validation rejects impossible month-end values', () => {
  assert.equal(isValidDateString('2026-04-31'), false);
  assert.equal(isValidDateString('2028-02-29'), true);
});
