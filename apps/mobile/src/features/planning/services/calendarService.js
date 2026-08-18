import { supabase } from '../../../infrastructure/supabase/client';
import { getMonthRangeForKey, shiftMonthKey } from '../../insights/utils/monthlyInsights.cjs';
import {
  buildPlanningCalendar,
  calculateCalendarEventTotals,
} from '../utils/calendarMath.cjs';
import { buildProjectedIncomeEvents } from '../../finance/utils/recurringIncomeMath.cjs';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

export async function getPlanningCalendar({ userId, profile, monthKey }) {
  const range = getMonthRangeForKey(monthKey);
  const [
    recurringResponse,
    billResponse,
    planResponse,
    installmentResponse,
    incomeResponse,
    incomeScheduleResponse,
    incomeOccurrenceResponse,
  ] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('id, name, amount_cents, cadence, charge_day, starts_on, ends_on, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('starts_on', range.endDate)
      .or(`ends_on.is.null,ends_on.gte.${range.startDate}`),
    supabase
      .from('credit_card_bills')
      .select('id, credit_card_id, amount_cents, due_on, paid_on, credit_cards(nickname, last_four)')
      .eq('user_id', userId)
      .gte('due_on', range.startDate)
      .lte('due_on', range.endDate),
    supabase
      .from('bill_payment_plans')
      .select('credit_card_bill_id, recurring_expense_id, period_start')
      .eq('user_id', userId)
      .limit(500),
    supabase
      .from('bill_payment_installments')
      .select('id, payment_plan_id, amount_cents, planned_on, paid_on, bill_payment_plans(title, credit_card_bill_id, recurring_expense_id, period_start, due_on)')
      .eq('user_id', userId)
      .gte('planned_on', range.startDate)
      .lte('planned_on', range.endDate),
    supabase
      .from('income_entries')
      .select('id, amount_cents, source, received_on')
      .eq('user_id', userId)
      .gte('received_on', range.startDate)
      .lte('received_on', range.endDate),
    supabase
      .from('recurring_income_schedules')
      .select('id, source, amount_cents, account_id, cadence, anchor_day, next_expected_on, ends_on, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('next_expected_on', range.endDate)
      .or(`ends_on.is.null,ends_on.gte.${range.startDate}`),
    supabase
      .from('recurring_income_occurrences')
      .select('schedule_id, expected_on')
      .eq('user_id', userId)
      .gte('expected_on', range.startDate)
      .lte('expected_on', range.endDate),
  ]);

  const calendar = buildPlanningCalendar({
    month: monthKey,
    recurringExpenses: unwrap(recurringResponse),
    creditCardBills: unwrap(billResponse).map((bill) => ({ ...bill, card: bill.credit_cards })),
    billPaymentPlans: unwrap(planResponse),
    billInstallments: unwrap(installmentResponse),
    incomeEntries: unwrap(incomeResponse),
    profile,
  });
  const projectedIncome = buildProjectedIncomeEvents({
    month: monthKey,
    schedules: unwrap(incomeScheduleResponse),
    occurrences: unwrap(incomeOccurrenceResponse),
  });
  const events = [...calendar.events, ...projectedIncome].sort(
    (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
  );

  return {
    ...calendar,
    events,
    totals: calculateCalendarEventTotals(events),
  };
}

export async function getReminderEvents({ userId, profile, monthCount = 4 }) {
  const initialMonth = new Date();
  const firstMonthKey = `${initialMonth.getFullYear()}-${String(initialMonth.getMonth() + 1).padStart(2, '0')}`;
  const calendars = await Promise.all(
    Array.from({ length: monthCount }, (_, index) =>
      getPlanningCalendar({
        userId,
        profile,
        monthKey: shiftMonthKey(firstMonthKey, index),
      }),
    ),
  );

  return calendars
    .flatMap((calendar) => calendar.events || calendar)
    .filter(
      (event) =>
        !event.isPaid &&
        ['credit_card_bill', 'recurring_expense', 'payday'].includes(event.type),
    );
}
