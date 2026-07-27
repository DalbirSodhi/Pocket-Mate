const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseAmountToCents(value) {
  const normalized = String(value || '')
    .replace(/[$,\s]/g, '')
    .trim();

  if (!MONEY_PATTERN.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  const cents = Math.round(amount * 100);

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}

function isValidDateString(value) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateEntry({ amount, date }) {
  const errors = {};

  if (parseAmountToCents(amount) === null) {
    errors.amount = 'Enter an amount greater than zero with up to two decimals.';
  }

  if (!isValidDateString(date)) {
    errors.date = 'Use a valid date in YYYY-MM-DD format.';
  }

  return errors;
}

function validateCardBill({ amount, statementDate, dueDate, lastFour = '' }) {
  const errors = validateEntry({ amount, date: statementDate });

  if (!isValidDateString(dueDate)) {
    errors.dueDate = 'Use a valid due date in YYYY-MM-DD format.';
  } else if (
    isValidDateString(statementDate) &&
    dueDate.localeCompare(statementDate) < 0
  ) {
    errors.dueDate = 'Due date cannot be before the statement date.';
  }

  if (lastFour && !/^\d{4}$/.test(lastFour)) {
    errors.lastFour = 'Enter exactly four digits.';
  }

  return errors;
}

module.exports = {
  getLocalDateString,
  isValidDateString,
  parseAmountToCents,
  validateCardBill,
  validateEntry,
};
