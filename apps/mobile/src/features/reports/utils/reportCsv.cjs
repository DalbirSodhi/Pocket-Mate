function protectSpreadsheetText(value) {
  const text = String(value ?? '');

  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function escapeCsvCell(value, { protect = true } = {}) {
  const text = protect
    ? protectSpreadsheetText(value)
    : String(value ?? '');

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function getTransactionTypeLabel(type) {
  if (type === 'income') return 'Income';
  if (type === 'bill_payment') return 'Bill payment';
  return 'Expense';
}

function getTransactionCategory(transaction) {
  if (transaction.type === 'expense') {
    return transaction.subtitle || 'Uncategorized';
  }

  if (transaction.type === 'bill_payment') {
    return 'Bill payments';
  }

  return '';
}

function formatSignedAmount(transaction) {
  const amount = Math.abs(Number(transaction.amountCents || 0)) / 100;
  const sign = transaction.type === 'income' ? '' : '-';

  return `${sign}${amount.toFixed(2)}`;
}

function buildTransactionCsv({ transactions = [], currencyCode = 'CAD' }) {
  const header = [
    'Date',
    'Type',
    'Description',
    'Category',
    'Note',
    'Amount',
    'Currency',
  ];
  const rows = transactions.map((transaction) => [
    transaction.date,
    getTransactionTypeLabel(transaction.type),
    transaction.title,
    getTransactionCategory(transaction),
    transaction.note || '',
    { value: formatSignedAmount(transaction), protect: false },
    currencyCode,
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((cell) =>
          typeof cell === 'object'
            ? escapeCsvCell(cell.value, { protect: cell.protect })
            : escapeCsvCell(cell),
        )
        .join(','),
    )
    .join('\r\n');
}

function getReportFileName(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey || ''))) {
    throw new Error('Month must use YYYY-MM format.');
  }

  return `pocket-mate-${monthKey}.csv`;
}

module.exports = {
  buildTransactionCsv,
  escapeCsvCell,
  getReportFileName,
  protectSpreadsheetText,
};
