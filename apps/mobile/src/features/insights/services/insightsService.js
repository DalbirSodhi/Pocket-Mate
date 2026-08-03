import { supabase } from '../../../infrastructure/supabase/client';
import {
  buildCategoryInsights,
  getMonthRangeForKey,
} from '../utils/monthlyInsights.cjs';

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
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount_cents, category_id')
      .eq('user_id', userId)
      .gte('spent_on', range.startDate)
      .lte('spent_on', range.endDate),
    supabase
      .from('expense_categories')
      .select('id, name, color')
      .eq('user_id', userId),
    supabase
      .from('budget_caps')
      .select('category_id, amount_cents')
      .eq('user_id', userId),
    supabase
      .from('bill_payment_installments')
      .select('amount_cents')
      .eq('user_id', userId)
      .gte('paid_on', range.startDate)
      .lte('paid_on', range.endDate),
    supabase
      .from('credit_card_bills')
      .select('id, amount_cents')
      .eq('user_id', userId)
      .gte('paid_on', range.startDate)
      .lte('paid_on', range.endDate),
    supabase
      .from('bill_payment_plans')
      .select('credit_card_bill_id')
      .eq('user_id', userId)
      .not('credit_card_bill_id', 'is', null),
  ]);

  const expenses = unwrap(expenseResponse);
  const installments = unwrap(installmentResponse);
  const plannedCardBillIds = new Set(
    unwrap(planResponse).map((plan) => plan.credit_card_bill_id),
  );
  const directCardBills = unwrap(paidCardBillResponse).filter(
    (bill) => !plannedCardBillIds.has(bill.id),
  );
  const ordinaryExpenseCents = sumCents(expenses);
  const billPaymentCents =
    sumCents(installments) + sumCents(directCardBills);
  const breakdown = buildCategoryInsights({
    expenses,
    categories: unwrap(categoryResponse),
    budgetCaps: unwrap(budgetResponse),
    billPaymentCents,
  });

  return {
    ...range,
    ...breakdown,
    ordinaryExpenseCents,
    billPaymentCents,
  };
}
