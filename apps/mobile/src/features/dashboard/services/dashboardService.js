import { supabase } from '../../../infrastructure/supabase/client';
import {
  getMonthRange,
  sumCents,
} from '../utils/dashboardMath.cjs';

function unwrapResponse(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

export async function getDashboardSummary(userId, date = new Date()) {
  const month = getMonthRange(date);

  const [
    incomeResponse,
    expenseResponse,
    recentExpenseResponse,
    categoryResponse,
    savingsResponse,
    budgetResponse,
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('amount_cents')
      .eq('user_id', userId)
      .gte('received_on', month.startDate)
      .lte('received_on', month.endDate),
    supabase
      .from('expenses')
      .select('amount_cents')
      .eq('user_id', userId)
      .gte('spent_on', month.startDate)
      .lte('spent_on', month.endDate),
    supabase
      .from('expenses')
      .select('id, amount_cents, spent_on, merchant, note, category_id')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('expense_categories')
      .select('id, name, color')
      .eq('user_id', userId),
    supabase
      .from('savings_goals')
      .select('current_amount_cents, target_amount_cents')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('budget_caps')
      .select('id')
      .eq('user_id', userId),
  ]);

  const income = unwrapResponse(incomeResponse);
  const expenses = unwrapResponse(expenseResponse);
  const recentExpenses = unwrapResponse(recentExpenseResponse);
  const categories = unwrapResponse(categoryResponse);
  const savingsGoals = unwrapResponse(savingsResponse);
  const budgets = unwrapResponse(budgetResponse);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const incomeCents = sumCents(income, 'amount_cents');
  const expenseCents = sumCents(expenses, 'amount_cents');

  return {
    periodLabel: month.label,
    incomeCents,
    expenseCents,
    availableCents: Math.max(incomeCents - expenseCents, 0),
    shortfallCents: Math.max(expenseCents - incomeCents, 0),
    savingsCurrentCents: sumCents(savingsGoals, 'current_amount_cents'),
    savingsTargetCents: sumCents(savingsGoals, 'target_amount_cents'),
    activeSavingsGoals: savingsGoals.length,
    activeBudgetCaps: budgets.length,
    recentExpenses: recentExpenses.map((expense) => ({
      ...expense,
      category: categoryById.get(expense.category_id) || null,
    })),
  };
}
