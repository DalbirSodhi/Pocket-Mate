import { supabase } from '../../../infrastructure/supabase/client';
import { getMonthRange, sumCents } from '../../dashboard/utils/dashboardMath.cjs';
import { getExpenseCategories } from '../../finance/services/financeService';

function unwrap(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

export async function getSavingsGoals(userId) {
  const response = await supabase
    .from('savings_goals')
    .select(
      'id, name, target_amount_cents, current_amount_cents, monthly_contribution_cents, target_date, is_active',
    )
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  return unwrap(response);
}

export async function createSavingsGoal({
  userId,
  name,
  targetAmountCents,
  monthlyContributionCents,
  targetDate,
}) {
  const response = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      name: name.trim(),
      target_amount_cents: targetAmountCents,
      monthly_contribution_cents: monthlyContributionCents,
      target_date: targetDate || null,
    })
    .select(
      'id, name, target_amount_cents, current_amount_cents, monthly_contribution_cents, target_date, is_active',
    )
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function setSavingsGoalActive({ userId, goalId, isActive }) {
  const response = await supabase
    .from('savings_goals')
    .update({ is_active: isActive })
    .eq('user_id', userId)
    .eq('id', goalId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }
}

export async function addSavingsGoalProgress({
  userId,
  goalId,
  currentAmountCents,
  contributionCents,
  targetAmountCents,
}) {
  const nextAmount = Math.min(
    currentAmountCents + contributionCents,
    targetAmountCents,
  );
  const response = await supabase
    .from('savings_goals')
    .update({ current_amount_cents: nextAmount })
    .eq('user_id', userId)
    .eq('id', goalId)
    .select('current_amount_cents')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data.current_amount_cents;
}

export async function getBudgetCaps(userId, date = new Date()) {
  const month = getMonthRange(date);
  const [capsResponse, expensesResponse, categories] = await Promise.all([
    supabase
      .from('budget_caps')
      .select('id, category_id, amount_cents, period')
      .eq('user_id', userId)
      .eq('period', 'monthly')
      .order('created_at', { ascending: false }),
    supabase
      .from('expenses')
      .select('category_id, amount_cents')
      .eq('user_id', userId)
      .gte('spent_on', month.startDate)
      .lte('spent_on', month.endDate),
    getExpenseCategories(userId),
  ]);
  const caps = unwrap(capsResponse);
  const expenses = unwrap(expensesResponse);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return caps.map((cap) => {
    const spentCents = sumCents(
      expenses.filter((expense) => expense.category_id === cap.category_id),
      'amount_cents',
    );

    return {
      ...cap,
      spentCents,
      remainingCents: Math.max(cap.amount_cents - spentCents, 0),
      usageRatio: cap.amount_cents > 0 ? spentCents / cap.amount_cents : 0,
      category: categoryById.get(cap.category_id) || null,
    };
  });
}

export async function createBudgetCap({ userId, categoryId, amountCents }) {
  const response = await supabase
    .from('budget_caps')
    .insert({
      user_id: userId,
      category_id: categoryId,
      amount_cents: amountCents,
      period: 'monthly',
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function deleteBudgetCap({ userId, capId }) {
  const response = await supabase
    .from('budget_caps')
    .delete()
    .eq('user_id', userId)
    .eq('id', capId);

  if (response.error) {
    throw response.error;
  }
}

export async function getBillPaymentPlan({
  userId,
  creditCardBillId,
  recurringExpenseId,
  periodStart,
}) {
  let query = supabase
    .from('bill_payment_plans')
    .select(
      'id, credit_card_bill_id, recurring_expense_id, period_start, title, total_amount_cents, due_on, status',
    )
    .eq('user_id', userId);

  if (creditCardBillId) {
    query = query.eq('credit_card_bill_id', creditCardBillId);
  } else {
    query = query
      .eq('recurring_expense_id', recurringExpenseId)
      .eq('period_start', periodStart);
  }

  const planResponse = await query.maybeSingle();

  if (planResponse.error) {
    throw planResponse.error;
  }

  if (!planResponse.data) {
    return null;
  }

  const installmentsResponse = await supabase
    .from('bill_payment_installments')
    .select('id, amount_cents, planned_on, paid_on')
    .eq('user_id', userId)
    .eq('payment_plan_id', planResponse.data.id)
    .order('planned_on', { ascending: true })
    .order('created_at', { ascending: true });

  return {
    ...planResponse.data,
    installments: unwrap(installmentsResponse),
  };
}

export async function saveBillPaymentPlan({
  userId,
  creditCardBillId,
  recurringExpenseId,
  periodStart,
  installments,
}) {
  const response = await supabase.rpc('save_bill_payment_plan', {
    p_credit_card_bill_id: creditCardBillId || null,
    p_recurring_expense_id: recurringExpenseId || null,
    p_period_start: periodStart,
    p_installments: installments,
  });

  if (response.error) {
    throw response.error;
  }

  return getBillPaymentPlan({
    userId,
    creditCardBillId,
    recurringExpenseId,
    periodStart,
  });
}

export async function setBillPaymentInstallmentPaid({
  installmentId,
  isPaid,
}) {
  const response = await supabase.rpc('set_bill_payment_installment_paid', {
    p_installment_id: installmentId,
    p_is_paid: isPaid,
  });

  if (response.error) {
    throw response.error;
  }
}
