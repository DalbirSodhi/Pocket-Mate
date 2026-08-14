import { supabase } from '../../../infrastructure/supabase/client';
import { getMonthKey } from '../../insights/utils/monthlyInsights.cjs';
import { getMonthlyBudget } from './budgetService';

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

export async function getSavingsContributionHistory(userId) {
  const response = await supabase
    .from('savings_goal_contributions')
    .select(
      'id, savings_goal_id, from_account_id, to_account_id, amount_cents, contributed_on, created_at',
    )
    .eq('user_id', userId)
    .order('contributed_on', { ascending: false })
    .order('created_at', { ascending: false });

  return unwrap(response);
}

export async function recordSavingsGoalContribution({
  goalId,
  fromAccountId,
  toAccountId,
  amountCents,
  contributedOn,
}) {
  const response = await supabase.rpc('record_savings_goal_contribution', {
    p_savings_goal_id: goalId,
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_amount_cents: amountCents,
    p_contributed_on: contributedOn,
  });

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function undoSavingsGoalContribution(contributionId) {
  const response = await supabase.rpc('undo_savings_goal_contribution', {
    p_contribution_id: contributionId,
  });

  if (response.error) {
    throw response.error;
  }
}

export async function getBudgetCaps(userId, date = new Date()) {
  const budgets = await getMonthlyBudget({ userId, monthKey: getMonthKey(date) });
  return budgets.map((budget) => ({
    ...budget,
    amount_cents: budget.availableCents,
    spentCents: budget.spentAmountCents,
    remainingCents: Math.max(budget.remainingCents, 0),
    usageRatio:
      budget.availableCents > 0
        ? budget.spentAmountCents / budget.availableCents
        : 0,
  }));
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
  totalAmountCents,
  installments,
}) {
  const response = await supabase.rpc('save_bill_payment_plan', {
    p_credit_card_bill_id: creditCardBillId || null,
    p_recurring_expense_id: recurringExpenseId || null,
    p_period_start: periodStart,
    p_total_amount_cents: totalAmountCents,
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
  paymentAccountId,
}) {
  const response = await supabase.rpc('set_bill_payment_installment_paid_from_account', {
    p_installment_id: installmentId,
    p_is_paid: isPaid,
    p_from_account_id: paymentAccountId || null,
  });

  if (response.error) {
    throw response.error;
  }
}
