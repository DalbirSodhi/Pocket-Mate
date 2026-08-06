const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EVENT_TYPES,
  buildPlanningCalendar,
  calculateCalendarEventTotals,
  generateCalendarEvents,
} = require('./calendarMath.cjs');

test('normalizes all supported source records and stable-sorts same-day events', () => {
  const events = generateCalendarEvents({
    month: '2026-08',
    recurringExpenses: [
      {
        id: 'rent',
        name: 'Rent',
        amount_cents: 150000,
        cadence: 'monthly',
        charge_day: 5,
        starts_on: '2026-01-05',
        is_active: true,
      },
    ],
    creditCardBills: [
      {
        id: 'card-bill',
        title: 'Visa statement',
        amount_cents: 42000,
        due_on: '2026-08-05',
        paid_on: null,
      },
    ],
    billInstallments: [
      {
        id: 'chunk',
        amount_cents: 21000,
        planned_on: '2026-08-05',
        paid_on: '2026-08-04',
        bill_payment_plans: { title: 'Visa plan' },
      },
    ],
    incomeEntries: [
      {
        id: 'salary',
        source: 'Salary',
        amount_cents: 300000,
        received_on: '2026-08-05',
      },
    ],
    profile: {
      pay_cycle: 'monthly',
      pay_cycle_anchor_date: '2026-01-05',
    },
  });

  assert.deepEqual(
    events.map(({ type, title }) => [type, title]),
    [
      [EVENT_TYPES.PAYDAY, 'Payday'],
      [EVENT_TYPES.INCOME, 'Salary'],
      [EVENT_TYPES.RECURRING_EXPENSE, 'Rent'],
      [EVENT_TYPES.CREDIT_CARD_BILL, 'Visa statement'],
      [EVENT_TYPES.BILL_INSTALLMENT, 'Visa plan'],
    ],
  );
  assert.equal(events[1].direction, 'inflow');
  assert.equal(events[1].isPaid, true);
  assert.equal(events[3].status, 'due');
  assert.equal(events[4].isPaid, true);
  assert.ok(events.every((event) => !('_sourceIndex' in event)));
});

test('clamps monthly and yearly occurrences and honors active date ranges', () => {
  const events = generateCalendarEvents({
    month: '2026-02',
    recurringExpenses: [
      {
        id: 'monthly-31',
        name: 'Month end',
        amount_cents: 1000,
        cadence: 'monthly',
        charge_day: 31,
        starts_on: '2026-01-31',
        is_active: true,
      },
      {
        id: 'leap-anniversary',
        name: 'Annual renewal',
        amount_cents: 2000,
        cadence: 'yearly',
        starts_on: '2024-02-29',
        is_active: true,
      },
      {
        id: 'ended',
        name: 'Ended plan',
        amount_cents: 3000,
        cadence: 'monthly',
        charge_day: 10,
        starts_on: '2025-01-10',
        ends_on: '2026-02-09',
        is_active: true,
      },
      {
        id: 'inactive',
        name: 'Inactive plan',
        amount_cents: 4000,
        cadence: 'monthly',
        charge_day: 20,
        starts_on: '2025-01-20',
        is_active: false,
      },
    ],
  });

  assert.deepEqual(
    events.map(({ sourceId, date }) => [sourceId, date]),
    [
      ['leap-anniversary', '2026-02-28'],
      ['monthly-31', '2026-02-28'],
    ],
  );
});

test('projects weekly and biweekly recurring expenses from their start anchors', () => {
  const events = generateCalendarEvents({
    month: '2026-08',
    recurringExpenses: [
      {
        id: 'weekly',
        name: 'Weekly',
        amount_cents: 100,
        cadence: 'weekly',
        starts_on: '2026-07-30',
      },
      {
        id: 'biweekly',
        name: 'Biweekly',
        amount_cents: 200,
        cadence: 'bi_weekly',
        starts_on: '2026-07-24',
        ends_on: '2026-08-22',
      },
    ],
  });

  assert.deepEqual(
    events.filter((event) => event.sourceId === 'weekly').map((event) => event.date),
    ['2026-08-06', '2026-08-13', '2026-08-20', '2026-08-27'],
  );
  assert.deepEqual(
    events.filter((event) => event.sourceId === 'biweekly').map((event) => event.date),
    ['2026-08-07', '2026-08-21'],
  );
});

test('generates anchored weekly, biweekly, monthly, and semi-monthly paydays', () => {
  const cases = [
    ['weekly', '2026-07-31', ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28']],
    ['bi_weekly', '2026-07-31', ['2026-08-14', '2026-08-28']],
    ['monthly', '2026-01-31', ['2026-08-31']],
    ['semi_monthly', '2026-07-31', ['2026-08-16', '2026-08-31']],
  ];

  cases.forEach(([payCycle, anchor, expected]) => {
    const dates = generateCalendarEvents({
      month: '2026-08',
      profile: {
        pay_cycle: payCycle,
        pay_cycle_anchor_date: anchor,
      },
    }).map((event) => event.date);

    assert.deepEqual(dates, expected, payCycle);
  });
});

test('excludes dated records outside the requested month and preserves bill state', () => {
  const events = generateCalendarEvents({
    month: '2026-08',
    creditCardBills: [
      {
        id: 'paid',
        amount_cents: 12000,
        due_on: '2026-08-10',
        paid_on: '2026-08-08',
        card: { nickname: 'Travel card' },
      },
      { id: 'july', amount_cents: 5000, due_on: '2026-07-31' },
    ],
    billInstallments: [
      { id: 'september', amount_cents: 5000, planned_on: '2026-09-01' },
    ],
    incomeEntries: [
      { id: 'bonus', amount_cents: 30000, received_on: '2026-08-20' },
      { id: 'bad-date', amount_cents: 1, received_on: 'not-a-date' },
    ],
  });

  assert.deepEqual(events.map((event) => event.sourceId), ['paid', 'bonus']);
  assert.equal(events[0].title, 'Travel card');
  assert.equal(events[0].status, 'paid');
  assert.equal(events[0].isPaid, true);
  assert.equal(events[1].title, 'Income');
});

test('calculates event counts, amounts, and paid versus unpaid outflows', () => {
  const totals = calculateCalendarEventTotals([
    {
      type: EVENT_TYPES.INCOME,
      amountCents: 100000,
      direction: 'inflow',
      isPaid: true,
    },
    {
      type: EVENT_TYPES.RECURRING_EXPENSE,
      amountCents: 15000,
      direction: 'outflow',
      isPaid: false,
    },
    {
      type: EVENT_TYPES.CREDIT_CARD_BILL,
      amountCents: 25000,
      direction: 'outflow',
      isPaid: true,
    },
    {
      type: EVENT_TYPES.PAYDAY,
      amountCents: 0,
      direction: 'schedule',
      isPaid: false,
    },
  ]);

  assert.equal(totals.eventCount, 4);
  assert.equal(totals.incomeCents, 100000);
  assert.equal(totals.outflowCents, 40000);
  assert.equal(totals.paidOutflowCents, 25000);
  assert.equal(totals.unpaidOutflowCents, 15000);
  assert.deepEqual(totals.byType.credit_card_bill, {
    count: 1,
    amountCents: 25000,
  });
  assert.deepEqual(totals.byType.bill_installment, {
    count: 0,
    amountCents: 0,
  });
});

test('does not double-count source bills that are covered by payment installments', () => {
  const totals = calculateCalendarEventTotals([
    {
      type: EVENT_TYPES.CREDIT_CARD_BILL,
      sourceId: 'bill-1',
      creditCardBillId: 'bill-1',
      amountCents: 90000,
      direction: 'outflow',
      isPaid: false,
    },
    {
      type: EVENT_TYPES.BILL_INSTALLMENT,
      creditCardBillId: 'bill-1',
      amountCents: 30000,
      direction: 'outflow',
      isPaid: false,
    },
  ]);

  assert.equal(totals.outflowCents, 30000);
  assert.equal(totals.unpaidOutflowCents, 30000);
  assert.equal(totals.byType.credit_card_bill.amountCents, 90000);
  assert.equal(totals.byType.bill_installment.amountCents, 30000);
});

test('removes a planned source obligation from cash outflow before its first chunk', () => {
  const calendar = buildPlanningCalendar({
    month: '2026-08',
    creditCardBills: [
      {
        id: 'bill-2',
        amount_cents: 120000,
        due_on: '2026-08-15',
      },
    ],
    billPaymentPlans: [
      {
        credit_card_bill_id: 'bill-2',
        period_start: '2026-07-01',
      },
    ],
  });

  assert.equal(calendar.events[0].coveredByPaymentPlan, true);
  assert.equal(calendar.totals.outflowCents, 0);
  assert.equal(calendar.totals.byType.credit_card_bill.amountCents, 120000);
});

test('buildPlanningCalendar returns events with matching totals', () => {
  const calendar = buildPlanningCalendar({
    month: '2026-08',
    incomeEntries: [
      {
        id: 'income',
        source: 'Salary',
        amount_cents: 50000,
        received_on: '2026-08-01',
      },
    ],
  });

  assert.equal(calendar.month, '2026-08');
  assert.equal(calendar.events.length, 1);
  assert.equal(calendar.totals.eventCount, calendar.events.length);
  assert.equal(calendar.totals.incomeCents, 50000);
});

test('rejects malformed or impossible month values', () => {
  assert.throws(
    () => generateCalendarEvents({ month: '2026-8' }),
    /YYYY-MM/,
  );
  assert.throws(
    () => generateCalendarEvents({ month: '2026-13' }),
    /valid YYYY-MM/,
  );
});
