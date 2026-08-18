const {
  addDays,
  addMonthsClamped,
  getCalendarDayDifference,
  getLocalDateString,
  isValidDateString,
  parseLocalDateString,
} = require('../../../utils/date.cjs');

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const EVENT_TYPES = Object.freeze({
  INCOME: 'income',
  PROJECTED_INCOME: 'projected_income',
  PAYDAY: 'payday',
  RECURRING_EXPENSE: 'recurring_expense',
  CREDIT_CARD_BILL: 'credit_card_bill',
  BILL_INSTALLMENT: 'bill_installment',
});
const TYPE_ORDER = Object.freeze({
  [EVENT_TYPES.PAYDAY]: 0,
  [EVENT_TYPES.INCOME]: 1,
  [EVENT_TYPES.PROJECTED_INCOME]: 2,
  [EVENT_TYPES.RECURRING_EXPENSE]: 3,
  [EVENT_TYPES.CREDIT_CARD_BILL]: 4,
  [EVENT_TYPES.BILL_INSTALLMENT]: 5,
});

function normalizeCents(value) {
  const cents = Number(value ?? 0);

  return Number.isFinite(cents) ? Math.max(Math.round(cents), 0) : 0;
}

function getMonthRange(month) {
  if (!MONTH_PATTERN.test(String(month))) {
    throw new RangeError('Month must use YYYY-MM format.');
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1, 12);

  if (start.getFullYear() !== year || start.getMonth() !== monthNumber - 1) {
    throw new RangeError('Month must be a valid YYYY-MM value.');
  }

  const end = new Date(year, monthNumber, 0, 12);

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

function isDateInRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

function isOccurrenceActive(row, date) {
  if (read(row, 'is_active', 'isActive') === false) {
    return false;
  }

  const startsOn = read(row, 'starts_on', 'startsOn');
  const endsOn = read(row, 'ends_on', 'endsOn');

  return (!startsOn || date >= startsOn) && (!endsOn || date <= endsOn);
}

function buildEvent({
  id,
  type,
  sourceId,
  date,
  title,
  amountCents = 0,
  direction,
  isPaid = false,
  status,
  sourceIndex,
  metadata = {},
}) {
  return {
    id,
    type,
    sourceId: sourceId ?? null,
    date,
    title: String(title || '').trim() || 'Untitled',
    amountCents: normalizeCents(amountCents),
    direction,
    isPaid: Boolean(isPaid),
    status,
    ...metadata,
    _sourceIndex: sourceIndex,
  };
}

function getFixedIntervalDates(anchorDate, range, intervalDays) {
  const elapsedDays = getCalendarDayDifference(anchorDate, range.start);
  const intervalOffset = Math.ceil(elapsedDays / intervalDays) * intervalDays;
  const dates = [];

  for (
    let cursor = addDays(anchorDate, intervalOffset);
    cursor <= range.end;
    cursor = addDays(cursor, intervalDays)
  ) {
    if (cursor >= range.start) {
      dates.push(getLocalDateString(cursor));
    }
  }

  return dates;
}

function getMonthlyDate(range, preferredDay) {
  return getLocalDateString(
    addMonthsClamped(range.start, 0, Number(preferredDay)),
  );
}

function getRecurringDates(row, range) {
  const startsOnValue = read(row, 'starts_on', 'startsOn');
  const startsOn = parseLocalDateString(startsOnValue);

  if (!startsOn) {
    return [];
  }

  const cadence = read(row, 'cadence', 'cadence') || 'monthly';
  let candidates;

  if (cadence === 'weekly' || cadence === 'bi_weekly' || cadence === 'biweekly') {
    candidates = getFixedIntervalDates(
      startsOn,
      range,
      cadence === 'weekly' ? 7 : 14,
    );
  } else if (cadence === 'yearly') {
    const yearlyDate = addMonthsClamped(
      new Date(range.start.getFullYear(), startsOn.getMonth(), 1, 12),
      0,
      startsOn.getDate(),
    );
    candidates = [getLocalDateString(yearlyDate)];
  } else {
    candidates = [
      getMonthlyDate(
        range,
        read(row, 'charge_day', 'chargeDay') || startsOn.getDate(),
      ),
    ];
  }

  return candidates.filter(
    (date) =>
      isDateInRange(date, range.startDate, range.endDate) &&
      isOccurrenceActive(row, date),
  );
}

function getPaydayDates(profile, range) {
  const anchorValue = read(
    profile,
    'pay_cycle_anchor_date',
    'payCycleAnchorDate',
  );
  const anchorDate = parseLocalDateString(anchorValue);

  if (!anchorDate) {
    return [];
  }

  const payCycle = read(profile, 'pay_cycle', 'payCycle') || 'monthly';

  if (payCycle === 'weekly') {
    return getFixedIntervalDates(anchorDate, range, 7);
  }

  if (payCycle === 'bi_weekly' || payCycle === 'biweekly') {
    return getFixedIntervalDates(anchorDate, range, 14);
  }

  if (payCycle === 'semi_monthly' || payCycle === 'semi-monthly') {
    const anchorDay = anchorDate.getDate();
    const firstDay = anchorDay > 15 ? anchorDay - 15 : anchorDay;
    const candidates = [
      getMonthlyDate(range, firstDay),
      getMonthlyDate(range, firstDay + 15),
    ];

    return [...new Set(candidates)].sort();
  }

  return [getMonthlyDate(range, anchorDate.getDate())];
}

function compareEvents(left, right) {
  return (
    left.date.localeCompare(right.date) ||
    TYPE_ORDER[left.type] - TYPE_ORDER[right.type] ||
    left.title.localeCompare(right.title) ||
    String(left.sourceId || '').localeCompare(String(right.sourceId || '')) ||
    left._sourceIndex - right._sourceIndex
  );
}

function getPlannedSourceKeys(events) {
  const keys = new Set();

  events.forEach((event) => {
    if (event.type !== EVENT_TYPES.BILL_INSTALLMENT) return;
    if (event.creditCardBillId) keys.add(`card:${event.creditCardBillId}`);
    if (event.recurringExpenseId) {
      keys.add(`recurring:${event.recurringExpenseId}:${event.periodStart || ''}`);
    }
  });

  return keys;
}

function isSupersededOutflow(event, plannedSourceKeys) {
  if (event.coveredByPaymentPlan) return true;

  if (event.type === EVENT_TYPES.CREDIT_CARD_BILL) {
    return plannedSourceKeys.has(`card:${event.creditCardBillId || event.sourceId}`);
  }

  if (event.type === EVENT_TYPES.RECURRING_EXPENSE) {
    return plannedSourceKeys.has(
      `recurring:${event.recurringExpenseId || event.sourceId}:${event.periodStart || ''}`,
    );
  }

  return false;
}

function calculateCalendarEventTotals(events = []) {
  const byType = Object.fromEntries(
    Object.values(EVENT_TYPES).map((type) => [type, { count: 0, amountCents: 0 }]),
  );
  let incomeCents = 0;
  let outflowCents = 0;
  let paidOutflowCents = 0;
  let unpaidOutflowCents = 0;
  const plannedSourceKeys = getPlannedSourceKeys(events);

  events.forEach((event) => {
    if (!byType[event.type]) {
      return;
    }

    byType[event.type].count += 1;
    byType[event.type].amountCents += normalizeCents(event.amountCents);

    if (event.direction === 'inflow') {
      incomeCents += normalizeCents(event.amountCents);
    } else if (
      event.direction === 'outflow' &&
      !isSupersededOutflow(event, plannedSourceKeys)
    ) {
      outflowCents += normalizeCents(event.amountCents);

      if (event.isPaid) {
        paidOutflowCents += normalizeCents(event.amountCents);
      } else {
        unpaidOutflowCents += normalizeCents(event.amountCents);
      }
    }
  });

  return {
    eventCount: events.length,
    incomeCents,
    outflowCents,
    paidOutflowCents,
    unpaidOutflowCents,
    byType,
  };
}

function generateCalendarEvents({
  month,
  recurringExpenses = [],
  creditCardBills = [],
  billPaymentPlans = [],
  billInstallments = [],
  incomeEntries = [],
  profile = {},
} = {}) {
  const range = getMonthRange(month);
  const events = [];
  let sourceIndex = 0;
  const plannedCardBillIds = new Set(
    billPaymentPlans
      .map((plan) => read(plan, 'credit_card_bill_id', 'creditCardBillId'))
      .filter(Boolean),
  );
  const plannedRecurringKeys = new Set(
    billPaymentPlans
      .filter((plan) => read(plan, 'recurring_expense_id', 'recurringExpenseId'))
      .map(
        (plan) =>
          `${read(plan, 'recurring_expense_id', 'recurringExpenseId')}:${read(plan, 'period_start', 'periodStart') || ''}`,
      ),
  );

  recurringExpenses.forEach((expense) => {
    const sourceId = read(expense, 'id', 'id');

    getRecurringDates(expense, range).forEach((date) => {
      events.push(
        buildEvent({
          id: `recurring_expense:${sourceId || sourceIndex}:${date}`,
          type: EVENT_TYPES.RECURRING_EXPENSE,
          sourceId,
          date,
          title: read(expense, 'name', 'name') || 'Recurring expense',
          amountCents: read(expense, 'amount_cents', 'amountCents'),
          direction: 'outflow',
          isPaid: false,
          status: 'scheduled',
          sourceIndex,
          metadata: {
            recurringExpenseId: sourceId,
            periodStart: range.startDate,
            dueOn: date,
            coveredByPaymentPlan: plannedRecurringKeys.has(
              `${sourceId}:${range.startDate}`,
            ),
          },
        }),
      );
      sourceIndex += 1;
    });
  });

  creditCardBills.forEach((bill) => {
    const date = read(bill, 'due_on', 'dueOn');

    if (!isValidDateString(date) || !isDateInRange(date, range.startDate, range.endDate)) {
      return;
    }

    const sourceId = read(bill, 'id', 'id');
    const paidOn = read(bill, 'paid_on', 'paidOn');
    const card = read(bill, 'card', 'card');
    const cardName =
      read(bill, 'title', 'title') ||
      read(card, 'nickname', 'nickname') ||
      'Credit card bill';

    events.push(
      buildEvent({
        id: `credit_card_bill:${sourceId || sourceIndex}:${date}`,
        type: EVENT_TYPES.CREDIT_CARD_BILL,
        sourceId,
        date,
        title: cardName,
        amountCents: read(bill, 'amount_cents', 'amountCents'),
        direction: 'outflow',
        isPaid: Boolean(paidOn),
        status: paidOn ? 'paid' : 'due',
        sourceIndex,
        metadata: {
          creditCardBillId: sourceId,
          dueOn: date,
          coveredByPaymentPlan: plannedCardBillIds.has(sourceId),
        },
      }),
    );
    sourceIndex += 1;
  });

  billInstallments.forEach((installment) => {
    const date = read(installment, 'planned_on', 'plannedOn');

    if (!isValidDateString(date) || !isDateInRange(date, range.startDate, range.endDate)) {
      return;
    }

    const sourceId = read(installment, 'id', 'id');
    const paidOn = read(installment, 'paid_on', 'paidOn');
    const plan = read(installment, 'bill_payment_plans', 'paymentPlan');

    events.push(
      buildEvent({
        id: `bill_installment:${sourceId || sourceIndex}:${date}`,
        type: EVENT_TYPES.BILL_INSTALLMENT,
        sourceId,
        date,
        title:
          read(installment, 'title', 'title') ||
          read(plan, 'title', 'title') ||
          'Bill installment',
        amountCents: read(installment, 'amount_cents', 'amountCents'),
        direction: 'outflow',
        isPaid: Boolean(paidOn),
        status: paidOn ? 'paid' : 'scheduled',
        sourceIndex,
        metadata: {
          paymentPlanId: read(installment, 'payment_plan_id', 'paymentPlanId'),
          creditCardBillId: read(plan, 'credit_card_bill_id', 'creditCardBillId'),
          recurringExpenseId: read(plan, 'recurring_expense_id', 'recurringExpenseId'),
          periodStart: read(plan, 'period_start', 'periodStart'),
          dueOn: read(plan, 'due_on', 'dueOn') || date,
        },
      }),
    );
    sourceIndex += 1;
  });

  incomeEntries.forEach((income) => {
    const date = read(income, 'received_on', 'receivedOn');

    if (!isValidDateString(date) || !isDateInRange(date, range.startDate, range.endDate)) {
      return;
    }

    const sourceId = read(income, 'id', 'id');

    events.push(
      buildEvent({
        id: `income:${sourceId || sourceIndex}:${date}`,
        type: EVENT_TYPES.INCOME,
        sourceId,
        date,
        title: read(income, 'source', 'source') || 'Income',
        amountCents: read(income, 'amount_cents', 'amountCents'),
        direction: 'inflow',
        isPaid: true,
        status: 'received',
        sourceIndex,
        metadata: { incomeId: sourceId },
      }),
    );
    sourceIndex += 1;
  });

  getPaydayDates(profile, range).forEach((date) => {
    events.push(
      buildEvent({
        id: `payday:${date}`,
        type: EVENT_TYPES.PAYDAY,
        date,
        title: 'Payday',
        direction: 'schedule',
        isPaid: false,
        status: 'scheduled',
        sourceIndex,
      }),
    );
    sourceIndex += 1;
  });

  return events
    .sort(compareEvents)
    .map(({ _sourceIndex, ...event }) => event);
}

function buildPlanningCalendar(options = {}) {
  const events = generateCalendarEvents(options);

  return {
    month: options.month,
    events,
    totals: calculateCalendarEventTotals(events),
  };
}

module.exports = {
  EVENT_TYPES,
  buildPlanningCalendar,
  calculateCalendarEventTotals,
  generateCalendarEvents,
};
