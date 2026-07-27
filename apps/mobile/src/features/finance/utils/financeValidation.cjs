const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const {
  getLocalDateString,
  isValidDateString,
} = require('../../../utils/date.cjs');

function getNextMonthlyDateString(sourceDate, date = new Date()) {
  const chargeDay = Number(String(sourceDate).split('-')[2]);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const lastDay = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth() + 1,
    0,
  ).getDate();

  nextMonth.setDate(Math.min(chargeDay, lastDay));
  return getLocalDateString(nextMonth);
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
  getNextMonthlyDateString,
  isValidDateString,
  parseAmountToCents,
  validateCardBill,
  validateEntry,
};
