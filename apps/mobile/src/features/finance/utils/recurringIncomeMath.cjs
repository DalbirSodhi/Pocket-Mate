const {
  addDays,
  addMonthsClamped,
  getCalendarDayDifference,
  getLocalDateString,
  isValidDateString,
  parseLocalDateString,
} = require('../../../utils/date.cjs');

const CADENCES = Object.freeze({
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  SEMI_MONTHLY: 'semi_monthly',
  MONTHLY: 'monthly',
});

function getMonthRange(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1, 12);
  const end = new Date(year, monthNumber, 0, 12);

  if (!/^\d{4}-\d{2}$/.test(String(month)) || !isValidDateString(getLocalDateString(start))) {
    throw new RangeError('Month must use YYYY-MM format.');
  }

  return {
    start,
    end,
    startDate: getLocalDateString(start),
    endDate: getLocalDateString(end),
  };
}

function read(row, snakeCaseName, camelCaseName) {
  return row?.[snakeCaseName] ?? row?.[camelCaseName];
}

function inRange(date, range) {
  return date >= range.startDate && date <= range.endDate;
}

function getIntervalDates(anchor, range, intervalDays) {
  const elapsed = getCalendarDayDifference(anchor, range.start);
  const offset = Math.max(0, Math.ceil(elapsed / intervalDays) * intervalDays);
  const dates = [];

  for (let cursor = addDays(anchor, offset); cursor <= range.end; cursor = addDays(cursor, intervalDays)) {
    const value = getLocalDateString(cursor);
    if (inRange(value, range)) dates.push(value);
  }

  return dates;
}

function getMonthlyDates(anchor, range, semiMonthly, storedAnchorDay) {
  if (getLocalDateString(anchor) > range.endDate) return [];

  const anchorDay = Number(storedAnchorDay) || anchor.getDate();
  const baseDay = semiMonthly
    ? anchorDay > 15 ? anchorDay - 15 : anchorDay
    : anchorDay;
  const days = semiMonthly ? [baseDay, baseDay + 15] : [baseDay];
  const dates = days.map((day) => getLocalDateString(addMonthsClamped(range.start, 0, day)));

  return [...new Set(dates)].filter(
    (date) => inRange(date, range) && date >= getLocalDateString(anchor),
  );
}

function getRecurringIncomeDates(schedule, month) {
  const nextExpectedOn = read(schedule, 'next_expected_on', 'nextExpectedOn');
  const anchor = parseLocalDateString(nextExpectedOn);
  if (!anchor) return [];

  const range = getMonthRange(month);
  const cadence = read(schedule, 'cadence', 'cadence') || CADENCES.MONTHLY;
  let dates;

  if (cadence === CADENCES.WEEKLY) {
    dates = getIntervalDates(anchor, range, 7);
  } else if (cadence === CADENCES.BIWEEKLY || cadence === 'bi_weekly') {
    dates = getIntervalDates(anchor, range, 14);
  } else {
    dates = getMonthlyDates(
      anchor,
      range,
      cadence === CADENCES.SEMI_MONTHLY || cadence === 'semi-monthly',
      read(schedule, 'anchor_day', 'anchorDay'),
    );
  }

  const endsOn = read(schedule, 'ends_on', 'endsOn');
  return dates.filter((date) => !endsOn || date <= endsOn);
}

function buildProjectedIncomeEvents({ month, schedules = [], occurrences = [] } = {}) {
  const receivedKeys = new Set(
    occurrences.map((occurrence) => `${read(occurrence, 'schedule_id', 'scheduleId')}:${read(occurrence, 'expected_on', 'expectedOn')}`),
  );

  return schedules.flatMap((schedule) => {
    const scheduleId = read(schedule, 'id', 'id');
    const source = read(schedule, 'source', 'source') || 'Expected income';
    const amountCents = Number(read(schedule, 'amount_cents', 'amountCents') || 0);

    return getRecurringIncomeDates(schedule, month)
      .filter((date) => !receivedKeys.has(`${scheduleId}:${date}`))
      .map((date) => ({
        id: `recurring_income:${scheduleId}:${date}`,
        type: 'projected_income',
        sourceId: scheduleId,
        date,
        title: source,
        amountCents,
        direction: 'inflow',
        isPaid: false,
        status: 'projected',
        projected: true,
        recurringIncomeScheduleId: scheduleId,
        expectedOn: date,
        canRecord: date === read(schedule, 'next_expected_on', 'nextExpectedOn'),
        accountId: read(schedule, 'account_id', 'accountId') || null,
      }));
  });
}

module.exports = {
  CADENCES,
  buildProjectedIncomeEvents,
  getRecurringIncomeDates,
};
