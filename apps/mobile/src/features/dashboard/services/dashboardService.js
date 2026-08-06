import { supabase } from '../../../infrastructure/supabase/client';
import { buildCategoryInsights } from '../../insights/utils/monthlyInsights.cjs';
import { getAccountOverview } from '../../accounts/services/accountService';
import {
  calculateActualBalance,
  calculateSafeToSpend,
  calculatePlanTotals,
  getMonthRange,
  getNextMonthlyDueDate,
  getPaidInstallmentCents,
  getPlanHealth,
  getPlannedInstallmentCents,
  getRemainingPaymentPlanCents,
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
    paymentPlanResponse,
    paidInstallmentResponse,
    paidCardBillResponse,
    accountOverview,
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
      .select('id, nickname, last_four, tracking_mode')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('bill_payment_plans')
      .select(
        'id, credit_card_bill_id, recurring_expense_id, period_start, total_amount_cents, status, bill_payment_installments(amount_cents, planned_on, paid_on)',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('bill_payment_installments')
      .select('amount_cents, bill_payment_plans(credit_card_bill_id, recurring_expense_id, credit_card_bills(credit_card_id))')
      .eq('user_id', userId)
      .gte('paid_on', month.startDate)
      .lte('paid_on', month.endDate),
    supabase
      .from('credit_card_bills')
      .select('id, credit_card_id, amount_cents')
      .eq('user_id', userId)
      .gte('paid_on', month.startDate)
      .lte('paid_on', month.endDate),
    getAccountOverview(userId),
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
  const paymentPlans = unwrapResponse(paymentPlanResponse);
  const paidInstallments = unwrapResponse(paidInstallmentResponse);
  const paidCardBills = unwrapResponse(paidCardBillResponse);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const cardById = new Map(creditCards.map((card) => [card.id, card]));
  const cardPlanByBillId = new Map(
    paymentPlans
      .filter((plan) => plan.credit_card_bill_id)
      .map((plan) => [
        plan.credit_card_bill_id,
        summarizePaymentPlan(plan, month.startDate, month.endDate),
      ]),
  );
  const recurringPlanBySource = new Map(
    paymentPlans
      .filter((plan) => plan.recurring_expense_id)
      .map((plan) => [
        `${plan.recurring_expense_id}-${plan.period_start}`,
        summarizePaymentPlan(plan, month.startDate, month.endDate),
      ]),
  );
  const committedCardBills = unpaidCardBills.filter((bill) => {
    const paymentPlan = cardPlanByBillId.get(bill.id);

    return paymentPlan
      ? paymentPlan.plannedCents > 0
      : bill.due_on <= month.endDate;
  });
  const incomeCents = sumCents(income, 'amount_cents');
  const ordinaryExpenseCents = sumCents(expenses, 'amount_cents');
  const paidBillInstallmentCents = sumCents(
    paidInstallments.filter((installment) => {
      const plan = installment.bill_payment_plans;
      if (plan?.recurring_expense_id) return true;
      const cardId = plan?.credit_card_bills?.credit_card_id;
      return cardById.get(cardId)?.tracking_mode !== 'transactions';
    }),
    'amount_cents',
  );
  const plannedCardBillIds = new Set(
    paymentPlans
      .filter((plan) => plan.credit_card_bill_id)
      .map((plan) => plan.credit_card_bill_id),
  );
  const directPaidCardBillCents = sumCents(
    paidCardBills.filter(
      (bill) =>
        !plannedCardBillIds.has(bill.id) &&
        cardById.get(bill.credit_card_id)?.tracking_mode !== 'transactions',
    ),
    'amount_cents',
  );
  const paidBillCents =
    paidBillInstallmentCents + directPaidCardBillCents;
  const expenseCents = ordinaryExpenseCents + paidBillCents;
  const categoryInsights = buildCategoryInsights({
    expenses,
    categories,
    budgetCaps: budgets,
    billPaymentCents: paidBillCents,
  });
  const fixedExpenseCents = recurringExpenses.reduce((total, expense) => {
    const paymentPlan = recurringPlanBySource.get(
      `${expense.id}-${month.startDate}`,
    );

    return total + (paymentPlan?.plannedCents ?? expense.amount_cents);
  }, 0);
  const cardBillCents = unpaidCardBills.reduce((total, bill) => {
    const paymentPlan = cardPlanByBillId.get(bill.id);

    if (paymentPlan) {
      return total + paymentPlan.plannedCents;
    }

    return total + (bill.due_on <= month.endDate ? bill.amount_cents : 0);
  }, 0);
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
  const hasLiquidAccounts = accountOverview.accounts.some(
    (account) =>
      account.is_active &&
      ['checking', 'savings', 'cash'].includes(account.account_type),
  );
  const cardsWithUnpaidBills = new Set(
    unpaidCardBills.map((bill) => bill.credit_card_id),
  );
  const upcomingBills = [
    ...recurringExpenses
      .map((expense) => {
        const paymentPlan = recurringPlanBySource.get(
          `${expense.id}-${month.startDate}`,
        );

        return {
          id: `recurring-${expense.id}`,
          type: 'recurring',
          title: expense.name,
          amountCents:
            paymentPlan?.totalAmountCents ?? expense.amount_cents,
          recurringExpenseId: expense.id,
          periodStart: month.startDate,
          paymentPlan,
          dueOn: getNextMonthlyDueDate({
            chargeDay: expense.charge_day,
            date,
            endDate: month.endDate,
          }),
        };
      })
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
        creditCardBillId: bill.id,
        creditCardId: bill.credit_card_id,
        isOverdue: bill.due_on < today,
        paymentPlan: cardPlanByBillId.get(bill.id),
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
    ordinaryExpenseCents,
    paidBillInstallmentCents,
    directPaidCardBillCents,
    paidBillCents,
    fixedExpenseCents,
    cardBillCents,
    monthlySavingsCents,
    committedCents: planTotals.committedCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    availableCents: hasLiquidAccounts
      ? accountOverview.liquidCents
      : actualAvailableCents,
    accountAssetCents: accountOverview.assetCents,
    accountLiabilityCents: accountOverview.liabilityCents,
    netWorthCents: accountOverview.netWorthCents,
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
    categoryInsights: categoryInsights.rows,
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

function summarizePaymentPlan(plan, startDate, endDate) {
  const installments = plan.bill_payment_installments || [];
  const paidCount = installments.filter(
    (installment) => installment.paid_on,
  ).length;
  const nextInstallment = [...installments]
    .filter((installment) => !installment.paid_on)
    .sort((left, right) => left.planned_on.localeCompare(right.planned_on))[0];

  return {
    id: plan.id,
    status: plan.status,
    installmentCount: installments.length,
    paidCount,
    paidCents: getPaidInstallmentCents(plan),
    plannedCents: getPlannedInstallmentCents(plan, startDate, endDate),
    remainingCents: getRemainingPaymentPlanCents(plan),
    totalAmountCents: plan.total_amount_cents,
    nextPaymentOn: nextInstallment?.planned_on || null,
    nextPaymentAmountCents: nextInstallment?.amount_cents || null,
  };
}
