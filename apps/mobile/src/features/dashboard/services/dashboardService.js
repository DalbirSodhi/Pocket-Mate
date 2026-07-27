import { supabase } from '../../../infrastructure/supabase/client';
import {
  calculatePlanTotals,
  getMonthRange,
  getPlanHealth,
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
    recurringResponse,
    cardBillResponse,
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('amount_cents')
      .eq('user_id', userId)
      .gte('received_on', month.startDate)
      .lte('received_on', month.endDate),
    supabase
      .from('expenses')
      .select('amount_cents, category_id')
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
      .select(
        'current_amount_cents, target_amount_cents, monthly_contribution_cents',
      )
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('budget_caps')
      .select('id, category_id, amount_cents')
      .eq('user_id', userId),
    supabase
      .from('recurring_expenses')
      .select('id, amount_cents')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('starts_on', month.endDate)
      .or(`ends_on.is.null,ends_on.gte.${month.startDate}`),
    supabase
      .from('credit_card_bills')
      .select('id, amount_cents, paid_on')
      .eq('user_id', userId)
      .gte('due_on', month.startDate)
      .lte('due_on', month.endDate),
  ]);

  const income = unwrapResponse(incomeResponse);
  const expenses = unwrapResponse(expenseResponse);
  const recentExpenses = unwrapResponse(recentExpenseResponse);
  const categories = unwrapResponse(categoryResponse);
  const savingsGoals = unwrapResponse(savingsResponse);
  const budgets = unwrapResponse(budgetResponse);
  const recurringExpenses = unwrapResponse(recurringResponse);
  const cardBills = unwrapResponse(cardBillResponse);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const incomeCents = sumCents(income, 'amount_cents');
  const expenseCents = sumCents(expenses, 'amount_cents');
  const fixedExpenseCents = sumCents(recurringExpenses, 'amount_cents');
  const cardBillCents = sumCents(cardBills, 'amount_cents');
  const monthlySavingsCents = sumCents(
    savingsGoals,
    'monthly_contribution_cents',
  );
  const budgetSpentCents = budgets.reduce(
    (total, budget) =>
      total +
      sumCents(
        expenses.filter(
          (expense) => expense.category_id === budget.category_id,
        ),
        'amount_cents',
      ),
    0,
  );
  const overBudgetCaps = budgets.filter((budget) => {
    const spentCents = sumCents(
      expenses.filter((expense) => expense.category_id === budget.category_id),
      'amount_cents',
    );
    return spentCents > budget.amount_cents;
  }).length;
  const planTotals = calculatePlanTotals({
    incomeCents,
    expenseCents,
    fixedExpenseCents,
    cardBillCents,
    savingsContributionCents: monthlySavingsCents,
  });
  const planHealth = getPlanHealth({
    incomeCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    overBudgetCaps,
  });

  return {
    periodLabel: month.label,
    incomeCents,
    expenseCents,
    fixedExpenseCents,
    cardBillCents,
    monthlySavingsCents,
    committedCents: planTotals.committedCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    availableCents: planTotals.availableCents,
    shortfallCents: planTotals.shortfallCents,
    savingsCurrentCents: sumCents(savingsGoals, 'current_amount_cents'),
    savingsTargetCents: sumCents(savingsGoals, 'target_amount_cents'),
    activeSavingsGoals: savingsGoals.length,
    activeBudgetCaps: budgets.length,
    budgetCapCents: sumCents(budgets, 'amount_cents'),
    budgetSpentCents,
    overBudgetCaps,
    planHealth,
    activeRecurringExpenses: recurringExpenses.length,
    currentCardBills: cardBills.length,
    unpaidCardBills: cardBills.filter((bill) => !bill.paid_on).length,
    recentExpenses: recentExpenses.map((expense) => ({
      ...expense,
      category: categoryById.get(expense.category_id) || null,
    })),
  };
}
