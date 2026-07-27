const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function parseLocalDateString(value) {
  if (!isValidDateString(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date, numberOfDays) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + numberOfDays,
    12,
  );
}

function addMonthsClamped(date, numberOfMonths, preferredDay = date.getDate()) {
  const monthStart = new Date(
    date.getFullYear(),
    date.getMonth() + numberOfMonths,
    1,
    12,
  );
  const lastDay = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    12,
  ).getDate();

  monthStart.setDate(Math.min(preferredDay, lastDay));
  return monthStart;
}

function getCalendarDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDifference(startDate, endDate) {
  return Math.round(
    (getCalendarDayNumber(endDate) - getCalendarDayNumber(startDate)) /
      MILLISECONDS_PER_DAY,
  );
}

module.exports = {
  addDays,
  addMonthsClamped,
  getCalendarDayDifference,
  getLocalDateString,
  isValidDateString,
  parseLocalDateString,
};
