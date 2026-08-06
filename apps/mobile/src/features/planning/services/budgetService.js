import { supabase } from '../../../infrastructure/supabase/client';
import { getMonthRangeForKey } from '../../insights/utils/monthlyInsights.cjs';
import { buildCategorizedAdjustments } from '../../finance/utils/transactionMath.cjs';
import { calculateBudgetRolloverChain } from '../utils/budgetRollover.cjs';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

export async function getMonthlyBudget({ userId, monthKey }) {
  const month = getMonthRangeForKey(monthKey);
  const periodResponse = await supabase.rpc('ensure_budget_period', {
    p_month_start: month.startDate,
  });
  if (periodResponse.error) throw periodResponse.error;

  const [allocationResponse, categoryResponse] = await Promise.all([
    supabase
      .from('budget_allocations')
      .select('id, category_id, planned_amount_cents, rollover_mode, rollover_in_cents, rollover_out_cents, budget_periods!inner(month_start)')
      .eq('user_id', userId)
      .lte('budget_periods.month_start', month.startDate),
    supabase.from('expense_categories').select('id, name, color').eq('user_id', userId),
  ]);

  const allocations = unwrap(allocationResponse);
  const categories = unwrap(categoryResponse);
  const currentAllocations = allocations.filter(
    (allocation) => allocation.budget_periods?.month_start === month.startDate,
  );

  if (!currentAllocations.length) return [];

  const earliestMonthStart = allocations.reduce(
    (earliest, allocation) =>
      allocation.budget_periods?.month_start < earliest
        ? allocation.budget_periods.month_start
        : earliest,
    month.startDate,
  );
  const [expenseResponse, refundResponse, splitResponse] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, category_id, amount_cents, spent_on')
      .eq('user_id', userId)
      .gte('spent_on', earliestMonthStart)
      .lte('spent_on', month.endDate),
    supabase
      .from('expense_refunds')
      .select('expense_id, amount_cents, refunded_on, expenses(id, category_id, amount_cents, spent_on, expense_splits(expense_id, category_id, amount_cents))')
      .eq('user_id', userId)
      .gte('refunded_on', earliestMonthStart)
      .lte('refunded_on', month.endDate),
    supabase
      .from('expense_splits')
      .select('expense_id, category_id, amount_cents, expenses!inner(spent_on)')
      .eq('user_id', userId)
      .gte('expenses.spent_on', earliestMonthStart)
      .lte('expenses.spent_on', month.endDate),
  ]);
  const expenses = unwrap(expenseResponse);
  const refunds = unwrap(refundResponse);
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const splits = unwrap(splitResponse);

  for (const refund of refunds) {
    if (refund.expenses && !expenseById.has(refund.expense_id)) {
      expenseById.set(refund.expense_id, refund.expenses);
    }
    for (const split of refund.expenses?.expense_splits || []) {
      if (!splits.some(
        (existing) =>
          existing.expense_id === split.expense_id &&
          existing.category_id === split.category_id,
      )) {
        splits.push(split);
      }
    }
  }
  const { categorizedExpenses, categorizedRefunds } = buildCategorizedAdjustments({
    expenses: [...expenseById.values()],
    splits,
    refunds,
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  function spentFor(categoryId, range) {
    const gross = categorizedExpenses
      .filter((expense) => expense.category_id === categoryId && expenseDateInRange(expense, range))
      .reduce((total, expense) => total + expense.amount_cents, 0);
    const refunded = categorizedRefunds
      .filter((refund) => refund.category_id === categoryId && refund.refunded_on >= range.startDate && refund.refunded_on <= range.endDate)
      .reduce((total, refund) => total + refund.amount_cents, 0);
    return Math.max(gross - refunded, 0);
  }

  return currentAllocations.map((allocation) => {
    const categoryHistory = allocations
      .filter((row) => row.category_id === allocation.category_id)
      .map((row) => {
        const rowMonth = getMonthRangeForKey(
          row.budget_periods.month_start.slice(0, 7),
        );
        return {
          ...row,
          monthStart: rowMonth.startDate,
          plannedAmountCents: row.planned_amount_cents,
          spentAmountCents: spentFor(row.category_id, rowMonth),
          rolloverMode: row.rollover_mode,
        };
      });
    const chain = calculateBudgetRolloverChain(categoryHistory, {
      openingRolloverInCents: categoryHistory[0]?.rollover_in_cents || 0,
    });
    const current = chain[chain.length - 1];

    return { ...allocation, ...current, category: categoryById.get(allocation.category_id) || null };
  });
}

function expenseDateInRange(expense, range) {
  const date = expense.spent_on;
  return date >= range.startDate && date <= range.endDate;
}

export async function saveMonthlyBudget({
  monthStart,
  categoryId,
  amountCents,
  rolloverMode,
  applyToFuture,
}) {
  const response = await supabase.rpc('save_budget_allocation', {
    p_month_start: monthStart,
    p_category_id: categoryId,
    p_amount_cents: amountCents,
    p_rollover_mode: rolloverMode,
    p_apply_to_future: applyToFuture,
  });
  if (response.error) throw response.error;
  return response.data;
}

export async function removeMonthlyBudget({
  monthStart,
  categoryId,
  removeFuture = false,
}) {
  const response = await supabase.rpc('remove_budget_allocation', {
    p_month_start: monthStart,
    p_category_id: categoryId,
    p_remove_future: removeFuture,
  });
  if (response.error) throw response.error;
}
