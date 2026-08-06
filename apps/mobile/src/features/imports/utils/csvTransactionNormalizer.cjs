const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const NORMALIZED_FIELDS = new Set([
  'date',
  'amount',
  'debit',
  'credit',
  'description',
  'type',
]);

const DEFAULT_HEADER_ALIASES = Object.freeze({
  date: Object.freeze([
    'date',
    'transaction date',
    'posted date',
    'posting date',
    'value date',
  ]),
  amount: Object.freeze([
    'amount',
    'transaction amount',
    'signed amount',
    'value',
  ]),
  debit: Object.freeze(['debit', 'withdrawal', 'money out', 'outflow']),
  credit: Object.freeze(['credit', 'deposit', 'money in', 'inflow']),
  description: Object.freeze([
    'description',
    'merchant',
    'payee',
    'memo',
    'details',
    'name',
  ]),
  type: Object.freeze([
    'type',
    'transaction type',
    'debit credit',
    'direction',
  ]),
});

const INCOME_TYPES = new Set([
  'income',
  'credit',
  'deposit',
  'inflow',
  'money in',
  'received',
]);
const EXPENSE_TYPES = new Set([
  'expense',
  'debit',
  'withdrawal',
  'purchase',
  'payment',
  'outflow',
  'money out',
]);

function canonicalizeHeader(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getOwnDataValue(object, key) {
  if (!object || typeof object !== 'object') return undefined;

  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function buildAliasMap(headerAliases) {
  const aliasesByField = new Map();

  for (const field of NORMALIZED_FIELDS) {
    aliasesByField.set(field, [...DEFAULT_HEADER_ALIASES[field]]);
  }

  if (headerAliases === undefined) return aliasesByField;
  if (!headerAliases || typeof headerAliases !== 'object' || Array.isArray(headerAliases)) {
    throw new TypeError('headerAliases must be an object.');
  }

  for (const field of Object.keys(headerAliases)) {
    if (DANGEROUS_KEYS.has(field) || !NORMALIZED_FIELDS.has(field)) {
      throw new RangeError(`Unsupported header alias field: ${field}.`);
    }

    const aliases = getOwnDataValue(headerAliases, field);

    if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string')) {
      throw new TypeError(`headerAliases.${field} must be an array of strings.`);
    }

    if (
      aliases.some((alias) => DANGEROUS_KEYS.has(alias.trim().toLowerCase()))
    ) {
      throw new RangeError(`headerAliases.${field} contains an unsafe alias.`);
    }

    const normalizedAliases = aliases.map(canonicalizeHeader);

    if (
      normalizedAliases.some(
        (alias) => !alias || DANGEROUS_KEYS.has(alias),
      )
    ) {
      throw new RangeError(`headerAliases.${field} contains an unsafe alias.`);
    }

    aliasesByField.set(
      field,
      [...new Set([...normalizedAliases, ...aliasesByField.get(field)])],
    );
  }

  return aliasesByField;
}

function buildSafeRowMap(row) {
  const values = new Map();

  if (!row || typeof row !== 'object' || Array.isArray(row)) return values;

  for (const key of Object.keys(row)) {
    if (DANGEROUS_KEYS.has(key.trim().toLowerCase())) continue;

    const header = canonicalizeHeader(key);

    if (!header || DANGEROUS_KEYS.has(header) || values.has(header)) continue;

    const descriptor = Object.getOwnPropertyDescriptor(row, key);

    if (descriptor && Object.hasOwn(descriptor, 'value')) {
      values.set(header, descriptor.value);
    }
  }

  return values;
}

function findFieldValue(rowMap, aliases) {
  for (const alias of aliases) {
    if (!rowMap.has(alias)) continue;

    const value = rowMap.get(alias);

    if (
      value !== null &&
      value !== undefined &&
      (typeof value !== 'string' || value.trim() !== '')
    ) {
      return value;
    }
  }

  return undefined;
}

function isValidCalendarDate(year, month, day) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDate(year, month, day) {
  if (!isValidCalendarDate(year, month, day)) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDate(value, { dateOrder = 'mdy' } = {}) {
  if (!['mdy', 'dmy'].includes(dateOrder)) {
    throw new RangeError('dateOrder must be "mdy" or "dmy".');
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return formatDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  if (typeof value !== 'string') return null;

  const text = value.trim();
  const yearFirst = /^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)(?:[T\s].*)?$/.exec(text);

  if (yearFirst) {
    return formatDate(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
    );
  }

  const local = /^([0-3]?\d)[-/]([0-3]?\d)[-/](\d{4})$/.exec(text);

  if (!local) return null;

  const first = Number(local[1]);
  const second = Number(local[2]);
  const year = Number(local[3]);
  const month = dateOrder === 'mdy' ? first : second;
  const day = dateOrder === 'mdy' ? second : first;

  return formatDate(year, month, day);
}

function parseGroupedNumber(text) {
  const separators = [...text].filter((character) => character === '.' || character === ',');

  if (separators.length === 0) {
    return /^\d+$/.test(text) ? { whole: text, fraction: '' } : null;
  }

  const hasDot = text.includes('.');
  const hasComma = text.includes(',');

  if (hasDot && hasComma) {
    const decimal = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    const grouping = decimal === '.' ? ',' : '.';

    if (text.split(decimal).length !== 2) return null;

    const [integerPart, fraction] = text.split(decimal);
    const groups = integerPart.split(grouping);

    if (
      !/^\d{1,2}$/.test(fraction) ||
      !/^\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((group) => !/^\d{3}$/.test(group))
    ) {
      return null;
    }

    return { whole: groups.join(''), fraction };
  }

  const separator = hasDot ? '.' : ',';
  const groups = text.split(separator);

  if (groups.some((group) => !/^\d+$/.test(group))) return null;

  if (groups.length === 2 && groups[1].length <= 2) {
    return { whole: groups[0], fraction: groups[1] };
  }

  if (
    !/^\d{1,3}$/.test(groups[0]) ||
    groups.slice(1).some((group) => !/^\d{3}$/.test(group))
  ) {
    return null;
  }

  return { whole: groups.join(''), fraction: '' };
}

function parseSignedAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;

  let text = String(value).trim();
  let negative = false;
  let directionHint = null;

  if (!text) return null;

  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  const direction = /\s+(CR|DR)$/i.exec(text);

  if (direction) {
    directionHint = direction[1].toUpperCase() === 'CR' ? 'income' : 'expense';
    text = text.slice(0, direction.index).trim();
  }

  let signWasRead = false;

  if (text.startsWith('+') || text.startsWith('-')) {
    negative = text[0] === '-' || negative;
    signWasRead = true;
    text = text.slice(1).trim();
  }

  text = text
    .replace(/^(?:[A-Z]{3}\s+|[$€£¥₹]\s*)/i, '')
    .replace(/(?:\s+[A-Z]{3}|\s*[$€£¥₹])$/i, '')
    .replace(/[\s']/g, '');

  if (text.startsWith('+') || text.startsWith('-')) {
    if (signWasRead) return null;
    negative = text[0] === '-' || negative;
    text = text.slice(1);
  }

  const parsed = parseGroupedNumber(text);

  if (!parsed) return null;

  const cents = Number(parsed.whole) * 100 + Number(parsed.fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents) || cents === 0) return null;

  return {
    amountCents: cents,
    signedAmountCents: negative ? -cents : cents,
    directionHint,
  };
}

function normalizeDescription(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const description = String(value).trim().replace(/\s+/g, ' ');
  return description && description.length <= 500 ? description : null;
}

function normalizeType(value) {
  if (typeof value !== 'string') return null;

  const type = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

  if (INCOME_TYPES.has(type)) return 'income';
  if (EXPENSE_TYPES.has(type)) return 'expense';
  return null;
}

function buildDuplicateFingerprint({ date, amountCents, description, type }) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    !['income', 'expense'].includes(type) ||
    typeof description !== 'string' ||
    !description.trim()
  ) {
    throw new TypeError('A fingerprint requires normalized finance fields.');
  }

  const canonicalDescription = description
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const parts = [date, type, String(amountCents), canonicalDescription];

  return `pm-tx-v1:${parts.map((part) => `${part.length}:${part}`).join('|')}`;
}

function issue(field, code, message) {
  return { field, code, message };
}

function readAmount(rowMap, aliasesByField) {
  const amountValue = findFieldValue(rowMap, aliasesByField.get('amount'));

  if (amountValue !== undefined) return parseSignedAmount(amountValue);

  const debitValue = findFieldValue(rowMap, aliasesByField.get('debit'));
  const creditValue = findFieldValue(rowMap, aliasesByField.get('credit'));

  if (debitValue !== undefined && creditValue !== undefined) {
    return { conflict: true };
  }

  if (debitValue !== undefined) {
    const parsed = parseSignedAmount(debitValue);
    return parsed ? { ...parsed, directionHint: 'expense' } : null;
  }

  if (creditValue !== undefined) {
    const parsed = parseSignedAmount(creditValue);
    return parsed ? { ...parsed, directionHint: 'income' } : null;
  }

  return null;
}

function normalizeCsvTransactions(rows, options = {}) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object.');
  }

  const aliasesByField = buildAliasMap(getOwnDataValue(options, 'headerAliases'));
  const dateOrder = getOwnDataValue(options, 'dateOrder') ?? 'mdy';
  const startingRowNumber = getOwnDataValue(options, 'startingRowNumber') ?? 2;
  const existingInput = getOwnDataValue(options, 'existingFingerprints') ?? [];

  if (!Number.isSafeInteger(startingRowNumber) || startingRowNumber < 1) {
    throw new RangeError('startingRowNumber must be a positive safe integer.');
  }

  if (!existingInput || typeof existingInput[Symbol.iterator] !== 'function') {
    throw new TypeError('existingFingerprints must be iterable.');
  }

  // Validate global configuration before processing any row.
  normalizeDate('2000-01-01', { dateOrder });

  const existingFingerprints = new Set(existingInput);
  const fileFingerprints = new Set();
  const transactions = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = startingRowNumber + index;

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({
        rowNumber,
        issues: [issue('row', 'invalid_row', 'Row must be a parsed object.')],
      });
      return;
    }

    const rowMap = buildSafeRowMap(row);
    const rowIssues = [];
    const dateValue = findFieldValue(rowMap, aliasesByField.get('date'));
    const descriptionValue = findFieldValue(
      rowMap,
      aliasesByField.get('description'),
    );
    const typeValue = findFieldValue(rowMap, aliasesByField.get('type'));
    const date = normalizeDate(dateValue, { dateOrder });
    const amount = readAmount(rowMap, aliasesByField);
    const description = normalizeDescription(descriptionValue);
    const explicitType = typeValue === undefined ? undefined : normalizeType(typeValue);

    if (!date) {
      rowIssues.push(issue('date', 'invalid_date', 'Date is missing or invalid.'));
    }

    if (amount?.conflict) {
      rowIssues.push(
        issue(
          'amount',
          'conflicting_amounts',
          'A row cannot contain both debit and credit amounts.',
        ),
      );
    } else if (!amount) {
      rowIssues.push(
        issue('amount', 'invalid_amount', 'Amount is missing, zero, or invalid.'),
      );
    }

    if (!description) {
      rowIssues.push(
        issue(
          'description',
          'invalid_description',
          'Description is missing, invalid, or longer than 500 characters.',
        ),
      );
    }

    if (typeValue !== undefined && !explicitType) {
      rowIssues.push(
        issue('type', 'invalid_type', 'Type must describe income or expense.'),
      );
    }

    if (rowIssues.length > 0) {
      errors.push({ rowNumber, issues: rowIssues });
      return;
    }

    const type = explicitType ?? amount.directionHint ??
      (amount.signedAmountCents < 0 ? 'expense' : 'income');
    const transaction = {
      date,
      amountCents: amount.amountCents,
      description,
      type,
    };
    const fingerprint = buildDuplicateFingerprint(transaction);

    if (existingFingerprints.has(fingerprint)) {
      errors.push({
        rowNumber,
        issues: [
          issue(
            'row',
            'duplicate_existing',
            'Transaction already exists.',
          ),
        ],
      });
      return;
    }

    if (fileFingerprints.has(fingerprint)) {
      errors.push({
        rowNumber,
        issues: [
          issue(
            'row',
            'duplicate_in_file',
            'Transaction is duplicated within this file.',
          ),
        ],
      });
      return;
    }

    fileFingerprints.add(fingerprint);
    transactions.push({ ...transaction, fingerprint, sourceRowNumber: rowNumber });
  });

  return {
    transactions,
    errors,
    acceptedCount: transactions.length,
    rejectedCount: errors.length,
  };
}

module.exports = {
  DEFAULT_HEADER_ALIASES,
  buildDuplicateFingerprint,
  normalizeCsvTransactions,
  normalizeDate,
  parseSignedAmount,
};
