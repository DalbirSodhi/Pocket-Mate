import { supabase } from '../../../infrastructure/supabase/client';
import {
  calculateActualBalance,
  calculateSafeToSpend,
  calculatePlanTotals,
  getMonthRange,
  getNextMonthlyDueDate,
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

export async function getDashboardSummary(userId, _profile, date = new Date()) {
  const month = getMonthRange(date);
  const today = getLocalDateValue(date);

  const [
    incomeResponse,
    expenseResponse,
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
      .select('id, name, amount_cents, charge_day')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('starts_on', month.endDate)
      .or(`ends_on.is.null,ends_on.gte.${month.startDate}`),
    supabase
      .from('credit_card_bills')
      .select('id, credit_card_id, amount_cents, due_on, paid_on')
      .eq('user_id', userId)
      .is('paid_on', null)
      .order('due_on', { ascending: true }),
    supabase
      .from('credit_cards')
      .select('id, nickname, last_four')
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);

  const income = unwrapResponse(incomeResponse);
  const expenses = unwrapResponse(expenseResponse);
  const recentExpenses = unwrapResponse(recentExpenseResponse);
  const categories = unwrapResponse(categoryResponse);
  const savingsGoals = unwrapResponse(savingsResponse);
  const budgets = unwrapResponse(budgetResponse);
  const recurringExpenses = unwrapResponse(recurringResponse).filter(
    (expense) =>
      isMonthlyChargeInRange({
        chargeDay: expense.charge_day,
        startDate: month.startDate,
        endDate: month.endDate,
      }),
  );
  const unpaidCardBills = unwrapResponse(cardBillResponse);
  const creditCards = unwrapResponse(creditCardResponse);
  const committedCardBills = unpaidCardBills.filter(
    (bill) => bill.due_on <= month.endDate,
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const cardById = new Map(creditCards.map((card) => [card.id, card]));
  const incomeCents = sumCents(income, 'amount_cents');
  const expenseCents = sumCents(expenses, 'amount_cents');
  const fixedExpenseCents = sumCents(recurringExpenses, 'amount_cents');
  const cardBillCents = sumCents(committedCardBills, 'amount_cents');
  const monthlySavingsCents = savingsGoals.reduce(
    (total, goal) =>
      total + Number(goal.monthly_contribution_cents || 0),
    0,
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
      expenses.filter(
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
    savingsContributionCents: monthlySavingsCents,
  });
  const planHealth = getPlanHealth({
    incomeCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    overBudgetCaps,
  });
  const safeToSpendCents = calculateSafeToSpend({
    availableCents: planTotals.availableCents,
    daysRemaining: month.daysUntilReset,
    shortfallCents: planTotals.shortfallCents,
  });
  const actualAvailableCents = calculateActualBalance({
    incomeCents,
    expenseCents,
  });
  const cardsWithUnpaidBills = new Set(
    unpaidCardBills.map((bill) => bill.credit_card_id),
  );
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
          endDate: month.endDate,
        }),
      }))
      .filter((expense) => expense.dueOn),
    ...unpaidCardBills.map((bill) => {
      const card = cardById.get(bill.credit_card_id);
      const cardNumber = card?.last_four ? ` • ${card.last_four}` : '';

      return {
        id: `card-${bill.id}`,
        type: 'card',
        title: `${card?.nickname || 'Credit card'}${cardNumber}`,
        amountCents: bill.amount_cents,
        dueOn: bill.due_on,
        creditCardId: bill.credit_card_id,
        isOverdue: bill.due_on < today,
      };
    }),
    ...creditCards
      .filter((card) => !cardsWithUnpaidBills.has(card.id))
      .map((card) => ({
        id: `card-setup-${card.id}`,
        type: 'card_setup',
        title: `${card.nickname}${card.last_four ? ` • ${card.last_four}` : ''}`,
        amountCents: null,
        dueOn: null,
        creditCardId: card.id,
      })),
  ]
    .sort((left, right) => {
      if (!left.dueOn) return 1;
      if (!right.dueOn) return -1;
      return left.dueOn.localeCompare(right.dueOn);
    })
    .slice(0, 4);

  return {
    periodLabel: month.label,
    monthStartDate: month.startDate,
    monthEndDate: month.endDate,
    nextMonthStartDate: month.nextMonthStartDate,
    daysUntilReset: month.daysUntilReset,
    safeToSpendCents,
    incomeCents,
    expenseCents,
    fixedExpenseCents,
    cardBillCents,
    monthlySavingsCents,
    committedCents: planTotals.committedCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    availableCents: actualAvailableCents,
    spendableCents: planTotals.availableCents,
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
    currentCardBills: committedCardBills.length,
    unpaidCardBills: unpaidCardBills.length,
    upcomingBills,
    recentExpenses: recentExpenses.map((expense) => ({
      ...expense,
      category: categoryById.get(expense.category_id) || null,
    })),
  };
}

function getLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
