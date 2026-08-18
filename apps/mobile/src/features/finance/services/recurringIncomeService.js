import { supabase } from '../../../infrastructure/supabase/client';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

const SCHEDULE_COLUMNS = 'id, source, amount_cents, account_id, cadence, anchor_day, next_expected_on, ends_on, is_active, note, created_at, updated_at';

export async function getRecurringIncomeSchedules(userId) {
  const response = await supabase
    .from('recurring_income_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('next_expected_on', { ascending: true });

  return unwrap(response);
}

export async function getRecurringIncomeOccurrences({ userId, startDate, endDate }) {
  let query = supabase
    .from('recurring_income_occurrences')
    .select('id, schedule_id, expected_on, received_on, income_entry_id')
    .eq('user_id', userId)
    .order('expected_on', { ascending: true });

  if (startDate) query = query.gte('expected_on', startDate);
  if (endDate) query = query.lte('expected_on', endDate);

  return unwrap(await query);
}

export async function createRecurringIncomeSchedule({
  source,
  amountCents,
  accountId,
  cadence,
  nextExpectedOn,
  endsOn,
  note,
}) {
  const response = await supabase.rpc('create_recurring_income_schedule', {
    p_source: source.trim(),
    p_amount_cents: amountCents,
    p_account_id: accountId || null,
    p_cadence: cadence,
    p_next_expected_on: nextExpectedOn,
    p_ends_on: endsOn || null,
    p_note: note.trim() || null,
  });

  if (response.error) throw response.error;
  return { id: response.data };
}

export async function updateRecurringIncomeSchedule({
  scheduleId,
  source,
  amountCents,
  accountId,
  cadence,
  nextExpectedOn,
  endsOn,
  note,
}) {
  const response = await supabase.rpc('update_recurring_income_schedule', {
    p_schedule_id: scheduleId,
    p_source: source.trim(),
    p_amount_cents: amountCents,
    p_account_id: accountId || null,
    p_cadence: cadence,
    p_next_expected_on: nextExpectedOn,
    p_ends_on: endsOn || null,
    p_note: note.trim() || null,
  });

  if (response.error) throw response.error;
  return { id: response.data };
}

export async function setRecurringIncomeScheduleActive({ scheduleId, isActive }) {
  const response = await supabase.rpc('archive_recurring_income_schedule', {
    p_schedule_id: scheduleId,
    p_is_active: isActive,
  });

  if (response.error) throw response.error;
}

export async function deleteRecurringIncomeSchedule(scheduleId) {
  const response = await supabase.rpc('delete_recurring_income_schedule', {
    p_schedule_id: scheduleId,
  });

  if (response.error) throw response.error;
}

export async function recordRecurringIncomeOccurrence({
  scheduleId,
  expectedOn,
  receivedOn,
}) {
  const response = await supabase.rpc('record_recurring_income_occurrence', {
    p_schedule_id: scheduleId,
    p_expected_on: expectedOn,
    p_received_on: receivedOn,
  });

  if (response.error) throw response.error;
  return response.data;
}
