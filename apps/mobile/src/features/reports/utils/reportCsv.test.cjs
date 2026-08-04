const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildTransactionCsv,
  escapeCsvCell,
  getReportFileName,
  protectSpreadsheetText,
} = require('./reportCsv.cjs');

test('CSV cells quote commas, quotes, and line breaks', () => {
  assert.equal(escapeCsvCell('Food, dining'), '"Food, dining"');
  assert.equal(escapeCsvCell('A "quoted" note'), '"A ""quoted"" note"');
  assert.equal(escapeCsvCell('two\nlines'), '"two\nlines"');
});

test('spreadsheet formulas in user text are neutralized', () => {
  assert.equal(protectSpreadsheetText('=HYPERLINK("bad")'), "'=HYPERLINK(\"bad\")");
  assert.equal(protectSpreadsheetText('+SUM(1,2)'), "'+SUM(1,2)");
  assert.equal(protectSpreadsheetText('Coffee shop'), 'Coffee shop');
});

test('transaction CSV preserves signed amounts and reconciled types', () => {
  const csv = buildTransactionCsv({
    currencyCode: 'CAD',
    transactions: [
      {
        date: '2026-08-02',
        type: 'income',
        title: 'Salary',
        subtitle: 'Money received',
        note: 'Payday',
        amountCents: 100050,
      },
      {
        date: '2026-08-03',
        type: 'expense',
        title: '=Unsafe merchant',
        subtitle: 'Food',
        note: 'Lunch, team',
        amountCents: 2550,
      },
      {
        date: '2026-08-04',
        type: 'bill_payment',
        title: 'Visa payment',
        subtitle: 'Payment completed',
        amountCents: 10000,
      },
    ],
  });

  assert.equal(
    csv,
    [
      'Date,Type,Description,Category,Note,Amount,Currency',
      '2026-08-02,Income,Salary,,Payday,1000.50,CAD',
      '2026-08-03,Expense,\'=Unsafe merchant,Food,"Lunch, team",-25.50,CAD',
      '2026-08-04,Bill payment,Visa payment,Bill payments,,-100.00,CAD',
    ].join('\r\n'),
  );
});

test('report filenames are deterministic and reject invalid months', () => {
  assert.equal(getReportFileName('2026-08'), 'pocket-mate-2026-08.csv');
  assert.throws(() => getReportFileName('August'), /YYYY-MM/);
});
