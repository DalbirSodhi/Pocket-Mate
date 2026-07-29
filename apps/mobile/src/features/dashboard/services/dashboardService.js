import { supabase } from '../../../infrastructure/supabase/client';
import {
  calculateSafeToSpend,
  calculatePlanTotals,
  getCycleSavingsContribution,
  getMonthRange,
  getNextMonthlyDueDate,
  getPayCycleRange,
  getPlanHealth,
  isMonthlyChargeInRange,
  sumCents,
} from '../utils/dashboardMath.cjs';

function unwrapResponse(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

export async function getDashboardSummary(userId, profile, date = new Date()) {
  const month = getMonthRange(date);
  const cycle = getPayCycleRange({
    payCycle: profile.pay_cycle,
    anchorDate: profile.pay_cycle_anchor_date,
    date,
  });

  const [
    incomeResponse,
    expenseResponse,
    budgetExpenseResponse,
    recentExpenseResponse,
    categoryResponse,
    savingsResponse,
    budgetResponse,
    recurringResponse,
    cardBillResponse,
    creditCardResponse,
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('amount_cents')
      .eq('user_id', userId)
      .gte('received_on', cycle.startDate)
      .lte('received_on', cycle.endDate),
    supabase
      .from('expenses')
      .select('amount_cents, category_id')
      .eq('user_id', userId)
      .gte('spent_on', cycle.startDate)
      .lte('spent_on', cycle.endDate),
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
      .select('id, name, amount_cents, charge_day')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('starts_on', cycle.endDate)
      .or(`ends_on.is.null,ends_on.gte.${cycle.startDate}`),
    supabase
      .from('credit_card_bills')
      .select('id, credit_card_id, amount_cents, due_on, paid_on')
      .eq('user_id', userId)
      .gte('due_on', cycle.startDate)
      .lte('due_on', cycle.endDate),
    supabase
      .from('credit_cards')
      .select('id, nickname, last_four')
      .eq('user_id', userId),
  ]);

  const income = unwrapResponse(incomeResponse);
  const expenses = unwrapResponse(expenseResponse);
  const budgetExpenses = unwrapResponse(budgetExpenseResponse);
  const recentExpenses = unwrapResponse(recentExpenseResponse);
  const categories = unwrapResponse(categoryResponse);
  const savingsGoals = unwrapResponse(savingsResponse);
  const budgets = unwrapResponse(budgetResponse);
  const recurringExpenses = unwrapResponse(recurringResponse).filter(
    (expense) =>
      isMonthlyChargeInRange({
        chargeDay: expense.charge_day,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
      }),
  );
  const cardBills = unwrapResponse(cardBillResponse);
  const creditCards = unwrapResponse(creditCardResponse);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const cardById = new Map(creditCards.map((card) => [card.id, card]));
  const incomeCents = sumCents(income, 'amount_cents');
  const expenseCents = sumCents(expenses, 'amount_cents');
  const fixedExpenseCents = sumCents(recurringExpenses, 'amount_cents');
  const cardBillCents = sumCents(cardBills, 'amount_cents');
  const cycleSavingsCents = savingsGoals.reduce(
    (total, goal) =>
      total +
      getCycleSavingsContribution(
        goal.monthly_contribution_cents,
        profile.pay_cycle,
      ),
    0,
  );
  const budgetSpentCents = budgets.reduce(
    (total, budget) =>
      total +
      sumCents(
        budgetExpenses.filter(
          (expense) => expense.category_id === budget.category_id,
        ),
        'amount_cents',
      ),
    0,
  );
  const overBudgetCaps = budgets.filter((budget) => {
    const spentCents = sumCents(
      budgetExpenses.filter(
        (expense) => expense.category_id === budget.category_id,
      ),
      'amount_cents',
    );
    return spentCents > budget.amount_cents;
  }).length;
  const planTotals = calculatePlanTotals({
    incomeCents,
    expenseCents,
    fixedExpenseCents,
    cardBillCents,
    savingsContributionCents: cycleSavingsCents,
  });
  const planHealth = getPlanHealth({
    incomeCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    overBudgetCaps,
  });
  const safeToSpendCents = calculateSafeToSpend({
    availableCents: planTotals.availableCents,
    daysUntilNextPayday: cycle.daysUntilNextPayday,
    shortfallCents: planTotals.shortfallCents,
  });
  const upcomingBills = [
    ...recurringExpenses
      .map((expense) => ({
        id: `recurring-${expense.id}`,
        type: 'recurring',
        title: expense.name,
        amountCents: expense.amount_cents,
        dueOn: getNextMonthlyDueDate({
          chargeDay: expense.charge_day,
          date,
          endDate: cycle.endDate,
        }),
      }))
      .filter((expense) => expense.dueOn),
    ...cardBills
      .filter((bill) => !bill.paid_on)
      .map((bill) => {
        const card = cardById.get(bill.credit_card_id);
        const cardNumber = card?.last_four ? ` • ${card.last_four}` : '';

        return {
          id: `card-${bill.id}`,
          type: 'card',
          title: `${card?.nickname || 'Credit card'}${cardNumber}`,
          amountCents: bill.amount_cents,
          dueOn: bill.due_on,
        };
      }),
  ]
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))
    .slice(0, 4);

  return {
    periodLabel: cycle.label,
    cycleStartDate: cycle.startDate,
    cycleEndDate: cycle.endDate,
    nextPayday: cycle.nextPayday,
    daysUntilNextPayday: cycle.daysUntilNextPayday,
    isPayCycleConfigured: cycle.isConfigured,
    safeToSpendCents,
    incomeCents,
    expenseCents,
    fixedExpenseCents,
    cardBillCents,
    cycleSavingsCents,
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
    dueRecurringExpenses: recurringExpenses.length,
    currentCardBills: cardBills.length,
    unpaidCardBills: cardBills.filter((bill) => !bill.paid_on).length,
    upcomingBills,
    recentExpenses: recentExpenses.map((expense) => ({
      ...expense,
      category: categoryById.get(expense.category_id) || null,
    })),
  };
}
