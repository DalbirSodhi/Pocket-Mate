import { supabase } from '../../../infrastructure/supabase/client';
import {
  buildCategoryInsights,
  getMonthRangeForKey,
} from '../utils/monthlyInsights.cjs';
import { getMonthlyBudget } from '../../planning/services/budgetService';
import { buildCategorizedAdjustments } from '../../finance/utils/transactionMath.cjs';

function unwrap(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

function sumCents(rows) {
  return rows.reduce(
    (total, row) => total + Number(row.amount_cents || 0),
    0,
  );
}

export async function getMonthlyInsights({ userId, monthKey }) {
  const range = getMonthRangeForKey(monthKey);
  const [
    expenseResponse,
    categoryResponse,
    budgetResponse,
    installmentResponse,
    paidCardBillResponse,
    planResponse,
    refundResponse,
    cardResponse,
    splitResponse,
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, amount_cents, category_id')
      .eq('user_id', userId)
      .gte('spent_on', range.startDate)
      .lte('spent_on', range.endDate),
    supabase
      .from('expense_categories')
      .select('id, name, color')
      .eq('user_id', userId),
    getMonthlyBudget({ userId, monthKey }),
    supabase
      .from('bill_payment_installments')
      .select('amount_cents, bill_payment_plans(credit_card_bill_id, recurring_expense_id, credit_card_bills(credit_card_id))')
      .eq('user_id', userId)
      .gte('paid_on', range.startDate)
      .lte('paid_on', range.endDate),
    supabase
      .from('credit_card_bills')
      .select('id, credit_card_id, amount_cents')
      .eq('user_id', userId)
      .gte('paid_on', range.startDate)
      .lte('paid_on', range.endDate),
    supabase
      .from('bill_payment_plans')
      .select('credit_card_bill_id')
      .eq('user_id', userId)
      .not('credit_card_bill_id', 'is', null),
    supabase
      .from('expense_refunds')
      .select('expense_id, amount_cents, refunded_on, expenses(id, category_id, amount_cents, spent_on, expense_splits(expense_id, category_id, amount_cents))')
      .eq('user_id', userId)
      .gte('refunded_on', range.startDate)
      .lte('refunded_on', range.endDate),
    supabase
      .from('credit_cards')
      .select('id, tracking_mode')
      .eq('user_id', userId),
    supabase
      .from('expense_splits')
      .select('expense_id, category_id, amount_cents, expenses!inner(spent_on)')
      .eq('user_id', userId)
      .gte('expenses.spent_on', range.startDate)
      .lte('expenses.spent_on', range.endDate),
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
  const installments = unwrap(installmentResponse);
  const cardById = new Map(unwrap(cardResponse).map((card) => [card.id, card]));
  const plannedCardBillIds = new Set(
    unwrap(planResponse).map((plan) => plan.credit_card_bill_id),
  );
  const directCardBills = unwrap(paidCardBillResponse).filter(
    (bill) =>
      !plannedCardBillIds.has(bill.id) &&
      cardById.get(bill.credit_card_id)?.tracking_mode !== 'transactions',
  );
  const statementInstallments = installments.filter((installment) => {
    const plan = installment.bill_payment_plans;
    if (plan?.recurring_expense_id) return true;
    const cardId = plan?.credit_card_bills?.credit_card_id;
    return cardById.get(cardId)?.tracking_mode !== 'transactions';
  });
  const refundCents = sumCents(refunds);
  const ordinaryExpenseCents = Math.max(sumCents(expenses) - refundCents, 0);
  const billPaymentCents =
    sumCents(statementInstallments) + sumCents(directCardBills);
  const breakdown = buildCategoryInsights({
    expenses: categorizedExpenses,
    refunds: categorizedRefunds,
    categories: unwrap(categoryResponse),
    budgetCaps: budgetResponse.map((budget) => ({
      category_id: budget.category_id,
      amount_cents: budget.availableCents,
    })),
    billPaymentCents,
  });

  return {
    ...range,
    ...breakdown,
    ordinaryExpenseCents,
    refundCents,
    billPaymentCents,
  };
}
