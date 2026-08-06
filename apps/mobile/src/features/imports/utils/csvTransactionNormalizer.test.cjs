const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDuplicateFingerprint,
  normalizeCsvTransactions,
  normalizeDate,
  parseSignedAmount,
} = require('./csvTransactionNormalizer.cjs');

test('normalizes common bank headers and signed amounts', () => {
  const result = normalizeCsvTransactions([
    {
      'Transaction Date': '2026-08-04',
      Description: '  Corner   Market  ',
      Amount: '-12.34',
    },
    {
      'Posted Date': '08/05/2026',
      Merchant: 'Employer payroll',
      'Transaction Amount': 'CAD 1,250.50 CR',
    },
  ]);

  assert.deepEqual(
    result.transactions.map(({ date, amountCents, description, type, sourceRowNumber }) => ({
      date,
      amountCents,
      description,
      type,
      sourceRowNumber,
    })),
    [
      {
        date: '2026-08-04',
        amountCents: 1234,
        description: 'Corner Market',
        type: 'expense',
        sourceRowNumber: 2,
      },
      {
        date: '2026-08-05',
        amountCents: 125050,
        description: 'Employer payroll',
        type: 'income',
        sourceRowNumber: 3,
      },
    ],
  );
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.rejectedCount, 0);
});

test('custom aliases extend defaults and normalize header spelling', () => {
  const result = normalizeCsvTransactions(
    [{ WHEN: '06-08-2026', Narrative: 'Hydro', Net_Value: '84.09', Flow: 'debit' }],
    {
      dateOrder: 'dmy',
      headerAliases: {
        date: ['when'],
        description: ['narrative'],
        amount: ['net value'],
        type: ['flow'],
      },
    },
  );

  assert.deepEqual(
    result.transactions.map(({ date, amountCents, description, type }) => ({
      date,
      amountCents,
      description,
      type,
    })),
    [{ date: '2026-08-06', amountCents: 8409, description: 'Hydro', type: 'expense' }],
  );
});

test('separate debit and credit columns determine transaction type', () => {
  const result = normalizeCsvTransactions([
    { Date: '2026/08/01', Payee: 'Rent', Debit: '$2,000.00', Credit: '' },
    { Date: '2026/08/02', Payee: 'Refund', Debit: '', Credit: '25.75' },
  ]);

  assert.deepEqual(
    result.transactions.map(({ amountCents, type }) => ({ amountCents, type })),
    [
      { amountCents: 200000, type: 'expense' },
      { amountCents: 2575, type: 'income' },
    ],
  );
});

test('amount parser handles currencies, grouping, decimals, and parentheses', () => {
  assert.deepEqual(parseSignedAmount('(€1.234,56)'), {
    amountCents: 123456,
    signedAmountCents: -123456,
    directionHint: null,
  });
  assert.deepEqual(parseSignedAmount('2,500 DR'), {
    amountCents: 250000,
    signedAmountCents: 250000,
    directionHint: 'expense',
  });
  assert.deepEqual(parseSignedAmount('+19.5'), {
    amountCents: 1950,
    signedAmountCents: 1950,
    directionHint: null,
  });
  assert.deepEqual(parseSignedAmount('-$19.50'), {
    amountCents: 1950,
    signedAmountCents: -1950,
    directionHint: null,
  });
  assert.deepEqual(parseSignedAmount('(-19.50)'), {
    amountCents: 1950,
    signedAmountCents: -1950,
    directionHint: null,
  });
  assert.equal(parseSignedAmount('1.2345'), null);
  assert.equal(parseSignedAmount('0.00'), null);
  assert.equal(parseSignedAmount('not money'), null);
});

test('date parser validates calendar dates and configurable day order', () => {
  assert.equal(normalizeDate('2024-02-29T12:30:00Z'), '2024-02-29');
  assert.equal(normalizeDate('31/07/2026', { dateOrder: 'dmy' }), '2026-07-31');
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('31/07/2026'), null);
  assert.throws(() => normalizeDate('2026-08-01', { dateOrder: 'ymd' }), /dateOrder/);
});

test('malformed rows are rejected with row-level field errors', () => {
  const result = normalizeCsvTransactions(
    [
      null,
      { Date: 'not-a-date', Description: '', Amount: '0', Type: 'unknown' },
      { Date: '2026-08-01', Description: 'Ambiguous', Debit: '10', Credit: '12' },
    ],
    { startingRowNumber: 10 },
  );

  assert.equal(result.acceptedCount, 0);
  assert.equal(result.rejectedCount, 3);
  assert.deepEqual(result.errors.map(({ rowNumber }) => rowNumber), [10, 11, 12]);
  assert.deepEqual(
    result.errors[1].issues.map(({ code }) => code),
    ['invalid_date', 'invalid_amount', 'invalid_description', 'invalid_type'],
  );
  assert.equal(result.errors[2].issues[0].code, 'conflicting_amounts');
});

test('fingerprints are deterministic across harmless description formatting', () => {
  const base = {
    date: '2026-08-04',
    amountCents: 1099,
    type: 'expense',
  };
  const first = buildDuplicateFingerprint({ ...base, description: 'Caf\u00e9 Market' });
  const second = buildDuplicateFingerprint({ ...base, description: '  CAFE\u0301   MARKET ' });

  assert.equal(first, second);
  assert.match(first, /^pm-tx-v1:/);
  assert.notEqual(
    first,
    buildDuplicateFingerprint({ ...base, amountCents: 1100, description: 'Caf\u00e9 Market' }),
  );
});

test('duplicate rows are rejected within one file', () => {
  const rows = [
    { Date: '2026-08-01', Description: 'Coffee', Amount: '-4.25' },
    { Date: '2026-08-01', Description: ' coffee ', Amount: '-4.25' },
  ];
  const result = normalizeCsvTransactions(rows);

  assert.equal(result.acceptedCount, 1);
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.errors[0].rowNumber, 3);
  assert.equal(result.errors[0].issues[0].code, 'duplicate_in_file');
});

test('duplicates are rejected against an existing fingerprint set', () => {
  const transaction = {
    date: '2026-08-01',
    amountCents: 425,
    description: 'Coffee',
    type: 'expense',
  };
  const result = normalizeCsvTransactions(
    [{ Date: transaction.date, Description: transaction.description, Amount: '-4.25' }],
    { existingFingerprints: new Set([buildDuplicateFingerprint(transaction)]) },
  );

  assert.equal(result.acceptedCount, 0);
  assert.equal(result.errors[0].issues[0].code, 'duplicate_existing');
});

test('dangerous and inherited row keys cannot provide finance fields', () => {
  let getterWasRead = false;
  let coercionWasAttempted = false;
  const prototype = {
    Date: '2026-08-01',
    Description: 'Inherited transaction',
    Amount: '-10.00',
  };
  const row = Object.create(prototype);

  Object.defineProperty(row, '__proto__', {
    configurable: true,
    enumerable: true,
    value: 'ignored',
  });
  Object.defineProperty(row, 'Date', {
    enumerable: true,
    get() {
      getterWasRead = true;
      return '2026-08-01';
    },
  });
  row.Description = 'Own description';
  row.Amount = {
    toString() {
      coercionWasAttempted = true;
      return '-10.00';
    },
  };

  const result = normalizeCsvTransactions([row]);

  assert.equal(getterWasRead, false);
  assert.equal(coercionWasAttempted, false);
  assert.equal(result.acceptedCount, 0);
  assert.equal(result.errors[0].issues[0].code, 'invalid_date');
  assert.equal(Object.prototype.polluted, undefined);
});

test('unsafe or unknown alias configuration is rejected', () => {
  const unsafeAliases = JSON.parse('{"__proto__":["date"]}');

  assert.throws(
    () => normalizeCsvTransactions([], { headerAliases: unsafeAliases }),
    /Unsupported header alias field/,
  );
  assert.throws(
    () => normalizeCsvTransactions([], { headerAliases: { date: ['constructor'] } }),
    /unsafe alias/,
  );
  assert.throws(
    () => normalizeCsvTransactions([], { headerAliases: { date: ['__proto__'] } }),
    /unsafe alias/,
  );
  assert.throws(
    () => normalizeCsvTransactions([], { headerAliases: { category: ['group'] } }),
    /Unsupported header alias field/,
  );
});

test('explicit type supports positive expense exports without changing cents', () => {
  const result = normalizeCsvTransactions([
    { Date: '2026-08-01', Description: 'Groceries', Amount: '42.25', Type: 'Purchase' },
    { Date: '2026-08-02', Description: 'Salary', Amount: '900', Type: 'Deposit' },
  ]);

  assert.deepEqual(
    result.transactions.map(({ amountCents, type }) => ({ amountCents, type })),
    [
      { amountCents: 4225, type: 'expense' },
      { amountCents: 90000, type: 'income' },
    ],
  );
});

test('unsafe integer amounts and invalid global options are rejected', () => {
  const result = normalizeCsvTransactions([
    {
      Date: '2026-08-01',
      Description: 'Too large',
      Amount: '90071992547409.92',
    },
  ]);

  assert.equal(result.errors[0].issues[0].code, 'invalid_amount');
  assert.throws(() => normalizeCsvTransactions('rows'), /rows must be an array/);
  assert.throws(
    () => normalizeCsvTransactions([], { startingRowNumber: 0 }),
    /startingRowNumber/,
  );
  assert.throws(
    () => normalizeCsvTransactions([], { existingFingerprints: 42 }),
    /must be iterable/,
  );
});
