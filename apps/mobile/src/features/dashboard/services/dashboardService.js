import { supabase } from '../../../infrastructure/supabase/client';
import { fetchAllRows } from '../../../infrastructure/supabase/pagination';
import { buildCategoryInsights } from '../../insights/utils/monthlyInsights.cjs';
import { getAccountOverview } from '../../accounts/services/accountService';
import { getMonthlyBudget } from '../../planning/services/budgetService';
import { buildCategorizedAdjustments } from '../../finance/utils/transactionMath.cjs';
import { getUserPreferences } from '../../preferences/services/preferencesService';
import {
  calculateActualBalance,
  calculateSafeToSpend,
  calculatePlanTotals,
  getMonthRange,
  getNextMonthlyDueDate,
  getPaidInstallmentCents,
  getPayCycleRange,
  getPlanHealth,
  getPlannedInstallmentCents,
  getRemainingPaymentPlanCents,
  getSafeToSpendBase,
  isMonthlyChargeInRange,
  sumCents,
} from '../utils/dashboardMath.cjs';

function unwrapResponse(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

export async function getDashboardSummary(userId, profile, date = new Date()) {
  const month = getMonthRange(date);
  const payCycle = getPayCycleRange({
    payCycle: profile?.pay_cycle || 'monthly',
    anchorDate: profile?.pay_cycle_anchor_date,
    date,
  });
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
    refundResponse,
    splitResponse,
    preferences,
  ] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('income_entries')
        .select('amount_cents')
        .eq('user_id', userId)
        .gte('received_on', month.startDate)
        .lte('received_on', month.endDate)
        .order('id'),
    ),
    fetchAllRows(() =>
      supabase
        .from('expenses')
        .select('id, amount_cents, category_id')
        .eq('user_id', userId)
        .gte('spent_on', month.startDate)
        .lte('spent_on', month.endDate)
        .order('id'),
    ),
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
    getMonthlyBudget({ userId, monthKey: month.startDate.slice(0, 7) }),
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
    fetchAllRows(() =>
      supabase
        .from('bill_payment_plans')
        .select(
          'id, credit_card_bill_id, recurring_expense_id, period_start, total_amount_cents, status, bill_payment_installments(amount_cents, planned_on, paid_on)',
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .order('id'),
    ),
    fetchAllRows(() =>
      supabase
        .from('bill_payment_installments')
        .select('amount_cents, bill_payment_plans(credit_card_bill_id, recurring_expense_id, credit_card_bills(credit_card_id))')
        .eq('user_id', userId)
        .gte('paid_on', month.startDate)
        .lte('paid_on', month.endDate)
        .order('id'),
    ),
    fetchAllRows(() =>
      supabase
        .from('credit_card_bills')
        .select('id, credit_card_id, amount_cents')
        .eq('user_id', userId)
        .gte('paid_on', month.startDate)
        .lte('paid_on', month.endDate)
        .order('id'),
    ),
    getAccountOverview(userId),
    fetchAllRows(() =>
      supabase
        .from('expense_refunds')
        .select('expense_id, amount_cents, refunded_on, expenses(id, category_id, amount_cents, spent_on, expense_splits(expense_id, category_id, amount_cents))')
        .eq('user_id', userId)
        .gte('refunded_on', month.startDate)
        .lte('refunded_on', month.endDate)
        .order('id'),
    ),
    fetchAllRows(() =>
      supabase
        .from('expense_splits')
        .select('expense_id, category_id, amount_cents, expenses!inner(spent_on)')
        .eq('user_id', userId)
        .gte('expenses.spent_on', month.startDate)
        .lte('expenses.spent_on', month.endDate)
        .order('expense_id')
        .order('category_id'),
    ),
    getUserPreferences(userId),
  ]);

  const income = unwrapResponse(incomeResponse);
  const expenses = unwrapResponse(expenseResponse);
  const recentExpenses = unwrapResponse(recentExpenseResponse);
  const categories = unwrapResponse(categoryResponse);
  const savingsGoals = unwrapResponse(savingsResponse);
  const budgets = budgetResponse.map((budget) => ({
    id: budget.id,
    category_id: budget.category_id,
    amount_cents: budget.availableCents,
  }));
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
  const refunds = unwrapResponse(refundResponse);
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const splits = unwrapResponse(splitResponse);
  for (const refund of refunds) {
    if (refund.expenses && !expenseById.has(refund.expense_id)) {
      expenseById.set(refund.expense_id, refund.expenses);
    }
    for (const split of refund.expenses?.expense_splits || []) {
      if (!splits.some((row) => row.expense_id === split.expense_id && row.category_id === split.category_id)) {
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
  const refundCents = sumCents(refunds, 'amount_cents');
  const ordinaryExpenseCents = Math.max(
    sumCents(expenses, 'amount_cents') - refundCents,
    0,
  );
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
    expenses: categorizedExpenses,
    refunds: categorizedRefunds,
    categories,
    budgetCaps: budgets,
    billPaymentCents: paidBillCents,
  });
  const categorySpentById = new Map(
    categoryInsights.rows.map((row) => [row.categoryId, row.amountCents]),
  );
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
    (total, budget) => total + (categorySpentById.get(budget.category_id) || 0),
    0,
  );
  const overBudgetCaps = budgets.filter((budget) => {
    const spentCents = categorySpentById.get(budget.category_id) || 0;
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
  const actualAvailableCents = calculateActualBalance({
    incomeCents,
    expenseCents,
  });
  const hasSpendableCashAccounts = accountOverview.accounts.some(
    (account) =>
      account.is_active &&
      ['checking', 'cash'].includes(account.account_type),
  );
  const cashAvailableCents = hasSpendableCashAccounts
    ? Math.max(accountOverview.spendableCashCents, 0)
    : null;
  const safeToSpendBaseCents = getSafeToSpendBase({
    plannedAvailableCents: planTotals.availableCents,
    spendableCashCents: cashAvailableCents,
    hasSpendableCashAccounts,
  });
  const safeToSpendCents = calculateSafeToSpend({
    availableCents: safeToSpendBaseCents,
    daysUntilNextPayday: payCycle.daysUntilNextPayday,
    shortfallCents: planTotals.shortfallCents,
  });
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
    nextPayday: payCycle.nextPayday,
    daysUntilNextPayday: payCycle.daysUntilNextPayday,
    isPayCycleConfigured: payCycle.isConfigured,
    safeToSpendCents,
    incomeCents,
    expenseCents,
    ordinaryExpenseCents,
    refundCents,
    paidBillInstallmentCents,
    directPaidCardBillCents,
    paidBillCents,
    fixedExpenseCents,
    cardBillCents,
    monthlySavingsCents,
    committedCents: planTotals.committedCents,
    totalOutflowCents: planTotals.totalOutflowCents,
    availableCents: actualAvailableCents,
    monthlyBalanceCents: actualAvailableCents,
    cashAvailableCents,
    hasSpendableCashAccounts,
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
    preferences,
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
