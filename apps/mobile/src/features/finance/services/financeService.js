import { supabase } from '../../../infrastructure/supabase/client';
import { getNextMonthlyDateString } from '../utils/financeValidation.cjs';
import { getCreditCardBillMutationBlockReason } from '../utils/financeCorrectionRules.cjs';
import { syncUserReminderSchedule } from '../../preferences/services/reminderCoordinator';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Housing', color: '#101C2C', icon: 'house' },
  { name: 'Food', color: '#C56F42', icon: 'utensils' },
  { name: 'Transport', color: '#287A5B', icon: 'car' },
  { name: 'Shopping', color: '#2F5F8F', icon: 'shopping-bag' },
  { name: 'Health', color: '#B94B55', icon: 'heart-pulse' },
  { name: 'Bills', color: '#657180', icon: 'receipt' },
  { name: 'Entertainment', color: '#6F5A8E', icon: 'clapperboard' },
  { name: 'Other', color: '#7A6957', icon: 'circle-ellipsis' },
];

function unwrap(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}

export async function getExpenseCategories(userId) {
  const response = await supabase
    .from('expense_categories')
    .select('id, name, color, icon, is_default')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  return unwrap(response);
}

export async function ensureExpenseCategories(userId) {
  const categories = await getExpenseCategories(userId);

  if (categories.length > 0) {
    return categories;
  }

  const response = await supabase
    .from('expense_categories')
    .insert(
      DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
        ...category,
        user_id: userId,
        is_default: true,
      })),
    )
    .select('id, name, color, icon, is_default');

  if (response.error?.code === '23505') {
    return getExpenseCategories(userId);
  }

  return unwrap(response).sort((left, right) => left.name.localeCompare(right.name));
}

export async function createExpenseCategory({ userId, name }) {
  const response = await supabase
    .from('expense_categories')
    .insert({
      user_id: userId,
      name: name.trim(),
      color: '#C56F42',
      icon: 'tag',
      is_default: false,
    })
    .select('id, name, color, icon, is_default')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function createIncomeEntry({
  userId,
  accountId,
  amountCents,
  source,
  receivedOn,
  note,
}) {
  const response = await supabase
    .from('income_entries')
    .insert({
      user_id: userId,
      account_id: accountId || null,
      amount_cents: amountCents,
      source: source.trim() || null,
      received_on: receivedOn,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function getIncomeDetail({ userId, incomeId }) {
  const response = await supabase
    .from('income_entries')
    .select('id, account_id, amount_cents, source, received_on, note')
    .eq('user_id', userId)
    .eq('id', incomeId)
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function updateIncomeEntry({
  userId,
  incomeId,
  accountId,
  amountCents,
  source,
  receivedOn,
  note,
}) {
  const response = await supabase
    .from('income_entries')
    .update({
      account_id: accountId || null,
      amount_cents: amountCents,
      source: source.trim() || null,
      received_on: receivedOn,
      note: note.trim() || null,
    })
    .eq('user_id', userId)
    .eq('id', incomeId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function deleteIncomeEntry({ userId, incomeId }) {
  const response = await supabase
    .from('income_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', incomeId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function createExpenseEntry({
  userId,
  accountId,
  categoryId,
  amountCents,
  spentOn,
  merchant,
  note,
}) {
  const response = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      account_id: accountId || null,
      category_id: categoryId,
      amount_cents: amountCents,
      spent_on: spentOn,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function getExpenseDetail({ userId, expenseId }) {
  const [expenseResponse, categories, recurringResponse] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, account_id, category_id, amount_cents, spent_on, merchant, note')
      .eq('user_id', userId)
      .eq('id', expenseId)
      .single(),
    getExpenseCategories(userId),
    supabase
      .from('recurring_expenses')
      .select('id, starts_on, is_active')
      .eq('user_id', userId)
      .eq('source_expense_id', expenseId)
      .maybeSingle(),
  ]);

  if (expenseResponse.error) {
    throw expenseResponse.error;
  }

  if (recurringResponse.error) {
    throw recurringResponse.error;
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return {
    ...expenseResponse.data,
    category: categoryById.get(expenseResponse.data.category_id) || null,
    recurringExpense: recurringResponse.data || null,
  };
}

export async function updateExpenseEntry({
  expenseId,
  accountId,
  categoryId,
  amountCents,
  spentOn,
  merchant,
  note,
}) {
  const response = await supabase.rpc('update_expense_entry', {
    p_expense_id: expenseId,
    p_account_id: accountId || null,
    p_category_id: categoryId,
    p_amount_cents: amountCents,
    p_spent_on: spentOn,
    p_merchant: merchant.trim() || null,
    p_note: note.trim() || null,
  });

  if (response.error) {
    throw response.error;
  }

  return { id: expenseId };
}

export async function deleteExpenseEntry({ userId, expenseId }) {
  const response = await supabase
    .from('expenses')
    .delete()
    .eq('user_id', userId)
    .eq('id', expenseId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function convertExpenseToRecurring({ userId, expense }) {
  const startsOn = getNextMonthlyDateString(expense.spent_on);
  const response = await supabase
    .from('recurring_expenses')
    .insert({
      user_id: userId,
      category_id: expense.category_id,
      name: expense.merchant?.trim() || expense.category?.name || 'Monthly expense',
      amount_cents: expense.amount_cents,
      cadence: 'monthly',
      charge_day: Number(startsOn.split('-')[2]),
      starts_on: startsOn,
      source_expense_id: expense.id,
      note: expense.note || null,
    })
    .select('id, starts_on, is_active')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function createRecurringExpense({
  userId,
  categoryId,
  name,
  amountCents,
  cadence,
  startsOn,
  note,
}) {
  const response = await supabase
    .from('recurring_expenses')
    .insert({
      user_id: userId,
      category_id: categoryId,
      name: name.trim(),
      amount_cents: amountCents,
      cadence,
      charge_day: Number(startsOn.split('-')[2]),
      starts_on: startsOn,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function getRecurringExpenses(userId) {
  const [plansResponse, categories] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select(
        'id, category_id, name, amount_cents, cadence, charge_day, starts_on, ends_on, is_active, note',
      )
      .eq('user_id', userId)
      .order('is_active', { ascending: false })
      .order('charge_day', { ascending: true }),
    getExpenseCategories(userId),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return unwrap(plansResponse).map((plan) => ({
    ...plan,
    category: categoryById.get(plan.category_id) || null,
  }));
}

export async function setRecurringExpenseActive({
  userId,
  recurringExpenseId,
  isActive,
}) {
  const response = await supabase
    .from('recurring_expenses')
    .update({ is_active: isActive })
    .eq('user_id', userId)
    .eq('id', recurringExpenseId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function updateRecurringExpense({
  userId,
  recurringExpenseId,
  categoryId,
  name,
  amountCents,
  cadence,
  startsOn,
  note,
}) {
  const response = await supabase
    .from('recurring_expenses')
    .update({
      category_id: categoryId,
      name: name.trim(),
      amount_cents: amountCents,
      cadence,
      charge_day: Number(startsOn.split('-')[2]),
      starts_on: startsOn,
      note: note.trim() || null,
    })
    .eq('user_id', userId)
    .eq('id', recurringExpenseId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function deleteRecurringExpense({ userId, recurringExpenseId }) {
  const response = await supabase
    .from('recurring_expenses')
    .delete()
    .eq('user_id', userId)
    .eq('id', recurringExpenseId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function getCreditCards(userId) {
  const response = await supabase
    .from('credit_cards')
    .select('id, nickname, issuer, last_four, is_active, financial_account_id, tracking_mode')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('nickname', { ascending: true });

  return unwrap(response);
}

export async function createCreditCard({ userId, nickname, issuer, lastFour }) {
  const response = await supabase
    .from('credit_cards')
    .insert({
      user_id: userId,
      nickname: nickname.trim(),
      issuer: issuer.trim() || null,
      last_four: lastFour.trim() || null,
    })
    .select('id, nickname, issuer, last_four, is_active, financial_account_id, tracking_mode')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function setCreditCardActive({ userId, creditCardId, isActive }) {
  const response = await supabase
    .from('credit_cards')
    .update({ is_active: isActive })
    .eq('user_id', userId)
    .eq('id', creditCardId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function setCreditCardTrackingMode({
  userId,
  creditCardId,
  trackingMode,
}) {
  const response = await supabase
    .from('credit_cards')
    .update({ tracking_mode: trackingMode })
    .eq('user_id', userId)
    .eq('id', creditCardId)
    .select('id')
    .single();

  if (response.error) throw response.error;
  return response.data;
}

export async function createCreditCardBill({
  userId,
  creditCardId,
  amountCents,
  statementOn,
  dueOn,
  paidOn,
  note,
}) {
  const response = await supabase
    .from('credit_card_bills')
    .insert({
      user_id: userId,
      credit_card_id: creditCardId,
      amount_cents: amountCents,
      statement_on: statementOn,
      due_on: dueOn,
      paid_on: paidOn || null,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function getCreditCardBills(userId, limit = 100) {
  const [billsResponse, cards, plansResponse] = await Promise.all([
    supabase
      .from('credit_card_bills')
      .select(
        'id, credit_card_id, amount_cents, statement_on, due_on, paid_on, note, created_at',
      )
      .eq('user_id', userId)
      .order('due_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    getCreditCards(userId),
    supabase
      .from('bill_payment_plans')
      .select('id, credit_card_bill_id')
      .eq('user_id', userId)
      .not('credit_card_bill_id', 'is', null),
  ]);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const plans = unwrap(plansResponse);
  const planIds = plans.map((plan) => plan.id);
  const installmentsResponse = planIds.length
    ? await supabase
      .from('bill_payment_installments')
      .select('payment_plan_id')
      .eq('user_id', userId)
      .in('payment_plan_id', planIds)
      .not('paid_on', 'is', null)
    : { data: [], error: null };
  const completedPlanIds = new Set(
    unwrap(installmentsResponse).map((installment) => installment.payment_plan_id),
  );
  const planByBillId = new Map(
    plans.map((plan) => [plan.credit_card_bill_id, plan]),
  );

  return unwrap(billsResponse).map((bill) => ({
    ...bill,
    card: cardById.get(bill.credit_card_id) || null,
    paymentPlanId: planByBillId.get(bill.id)?.id || null,
    mutationLockedReason: getCreditCardBillMutationBlockReason({
      paidOn: bill.paid_on,
      hasCompletedInstallment: completedPlanIds.has(planByBillId.get(bill.id)?.id),
    }),
  }));
}

async function getCreditCardBillForCorrection({ userId, billId }) {
  const billResponse = await supabase
    .from('credit_card_bills')
    .select('id, amount_cents, statement_on, due_on, paid_on, note')
    .eq('user_id', userId)
    .eq('id', billId)
    .single();

  if (billResponse.error) {
    throw billResponse.error;
  }

  const plansResponse = await supabase
    .from('bill_payment_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('credit_card_bill_id', billId);
  const plans = unwrap(plansResponse);
  const planIds = plans.map((plan) => plan.id);
  const installmentsResponse = planIds.length
    ? await supabase
      .from('bill_payment_installments')
      .select('id')
      .eq('user_id', userId)
      .in('payment_plan_id', planIds)
      .not('paid_on', 'is', null)
      .limit(1)
    : { data: [], error: null };
  const mutationLockedReason = getCreditCardBillMutationBlockReason({
    paidOn: billResponse.data.paid_on,
    hasCompletedInstallment: unwrap(installmentsResponse).length > 0,
  });

  if (mutationLockedReason) {
    throw new Error(mutationLockedReason);
  }

  return {
    ...billResponse.data,
    paymentPlanId: planIds[0] || null,
  };
}

export async function updateCreditCardBill({
  userId,
  billId,
  amountCents,
  statementOn,
  dueOn,
  note,
}) {
  const bill = await getCreditCardBillForCorrection({ userId, billId });

  if (
    bill.paymentPlanId &&
    (bill.amount_cents !== amountCents || bill.due_on !== dueOn)
  ) {
    throw new Error(
      'This bill already has a payment plan. Update its total and due date from the payment plan to keep scheduled payments accurate.',
    );
  }

  const response = await supabase
    .from('credit_card_bills')
    .update({
      amount_cents: amountCents,
      statement_on: statementOn,
      due_on: dueOn,
      note: note.trim() || null,
    })
    .eq('user_id', userId)
    .eq('id', billId)
    .select('id, credit_card_id, amount_cents, statement_on, due_on, paid_on, note, created_at')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function deleteCreditCardBill({ userId, billId }) {
  await getCreditCardBillForCorrection({ userId, billId });

  const response = await supabase
    .from('credit_card_bills')
    .delete()
    .eq('user_id', userId)
    .eq('id', billId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return response.data;
}

export async function setCreditCardBillPaid({
  userId,
  billId,
  paidOn,
  paymentAccountId,
}) {
  const response = await supabase.rpc('set_credit_card_bill_paid_with_account', {
    p_bill_id: billId,
    p_paid_on: paidOn || null,
    p_from_account_id: paymentAccountId || null,
  });

  if (response.error) {
    throw response.error;
  }

  await syncUserReminderSchedule(userId);
  return { id: billId, userId };
}

export async function getTransactions(
  userId,
  { startDate, endDate, limit = 500 } = {},
) {
  let incomeQuery = supabase
    .from('income_entries')
    .select('id, account_id, amount_cents, source, received_on, note, created_at')
    .eq('user_id', userId)
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  let expenseQuery = supabase
    .from('expenses')
    .select('id, account_id, amount_cents, merchant, spent_on, note, category_id, created_at')
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  let installmentQuery = supabase
    .from('bill_payment_installments')
    .select(
      'id, amount_cents, paid_on, created_at, bill_payment_plans(id, title, total_amount_cents, due_on, period_start, credit_card_bill_id, recurring_expense_id, credit_card_bills(credit_card_id))',
    )
    .eq('user_id', userId)
    .not('paid_on', 'is', null)
    .order('paid_on', { ascending: false })
    .limit(limit);
  let paidCardBillQuery = supabase
    .from('credit_card_bills')
    .select(
      'id, credit_card_id, amount_cents, paid_on, due_on, created_at',
    )
    .eq('user_id', userId)
    .not('paid_on', 'is', null)
    .order('paid_on', { ascending: false })
    .limit(limit);
  let transferQuery = supabase
    .from('account_transfers')
    .select('id, from_account_id, to_account_id, amount_cents, transferred_on, note, created_at, credit_card_bill_id, bill_payment_installment_id')
    .eq('user_id', userId)
    .is('credit_card_bill_id', null)
    .is('bill_payment_installment_id', null)
    .order('transferred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  let refundQuery = supabase
    .from('expense_refunds')
    .select('id, expense_id, account_id, amount_cents, refunded_on, note, created_at, expenses(merchant, category_id)')
    .eq('user_id', userId)
    .order('refunded_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (startDate) {
    incomeQuery = incomeQuery.gte('received_on', startDate);
    expenseQuery = expenseQuery.gte('spent_on', startDate);
    installmentQuery = installmentQuery.gte('paid_on', startDate);
    paidCardBillQuery = paidCardBillQuery.gte('paid_on', startDate);
    transferQuery = transferQuery.gte('transferred_on', startDate);
    refundQuery = refundQuery.gte('refunded_on', startDate);
  }

  if (endDate) {
    incomeQuery = incomeQuery.lte('received_on', endDate);
    expenseQuery = expenseQuery.lte('spent_on', endDate);
    installmentQuery = installmentQuery.lte('paid_on', endDate);
    paidCardBillQuery = paidCardBillQuery.lte('paid_on', endDate);
    transferQuery = transferQuery.lte('transferred_on', endDate);
    refundQuery = refundQuery.lte('refunded_on', endDate);
  }

  const [
    incomeResponse,
    expenseResponse,
    categories,
    installmentResponse,
    paidCardBillResponse,
    cards,
    planResponse,
    transferResponse,
    accountResponse,
    refundResponse,
  ] = await Promise.all([
    incomeQuery,
    expenseQuery,
    getExpenseCategories(userId),
    installmentQuery,
    paidCardBillQuery,
    getCreditCards(userId),
    supabase
      .from('bill_payment_plans')
      .select('credit_card_bill_id')
      .eq('user_id', userId)
      .not('credit_card_bill_id', 'is', null),
    transferQuery,
    supabase
      .from('financial_accounts')
      .select('id, name')
      .eq('user_id', userId),
    refundQuery,
  ]);
  const accountById = new Map(
    unwrap(accountResponse).map((account) => [account.id, account]),
  );

  const income = unwrap(incomeResponse).map((entry) => ({
    id: entry.id,
    type: 'income',
    amountCents: entry.amount_cents,
    date: entry.received_on,
    createdAt: entry.created_at,
    title: entry.source || 'Income',
    subtitle: entry.note || 'Money received',
    note: entry.note,
    categoryId: null,
    accountId: entry.account_id,
    accountName: accountById.get(entry.account_id)?.name || null,
  }));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const expenses = unwrap(expenseResponse).map((entry) => {
    const category = categoryById.get(entry.category_id);

    return {
      id: entry.id,
      type: 'expense',
      amountCents: entry.amount_cents,
      date: entry.spent_on,
      createdAt: entry.created_at,
      title: entry.merchant || category?.name || 'Expense',
      subtitle: category?.name || entry.note || 'Uncategorized',
      note: entry.note,
      categoryId: entry.category_id,
      color: category?.color,
      accountId: entry.account_id,
      accountName: accountById.get(entry.account_id)?.name || null,
    };
  });
  const installments = unwrap(installmentResponse).map((installment) => {
    const plan = installment.bill_payment_plans;
    const cardId = plan?.credit_card_bills?.credit_card_id;
    const isTransfer = cardById.get(cardId)?.tracking_mode === 'transactions';

    return {
      id: installment.id,
      type: 'bill_payment',
      amountCents: installment.amount_cents,
      date: installment.paid_on,
      createdAt: installment.created_at,
      title: plan?.title || 'Bill payment',
      subtitle: isTransfer ? 'Card payment transfer' : 'Payment completed',
      note: null,
      categoryId: null,
      paymentPlan: plan || null,
      isTransfer,
    };
  });
  const plannedCardBillIds = new Set(
    unwrap(planResponse).map((plan) => plan.credit_card_bill_id),
  );
  const directCardPayments = unwrap(paidCardBillResponse)
    .filter((bill) => !plannedCardBillIds.has(bill.id))
    .map((bill) => {
      const card = cardById.get(bill.credit_card_id);
      const isTransfer = card?.tracking_mode === 'transactions';

      return {
        id: bill.id,
        type: 'bill_payment',
        amountCents: bill.amount_cents,
        date: bill.paid_on,
        createdAt: bill.created_at,
        title: card?.nickname || 'Credit card bill',
        subtitle: isTransfer ? 'Card payment transfer' : 'Statement paid',
        note: null,
        categoryId: null,
        paymentPlan: null,
        cardBillId: bill.id,
        isTransfer,
      };
    });
  const transfers = unwrap(transferResponse).map((transfer) => ({
    id: transfer.id,
    type: 'transfer',
    amountCents: transfer.amount_cents,
    date: transfer.transferred_on,
    createdAt: transfer.created_at,
    title: `${accountById.get(transfer.from_account_id)?.name || 'Account'} to ${accountById.get(transfer.to_account_id)?.name || 'Account'}`,
    subtitle: 'Transfer',
    note: transfer.note,
    categoryId: null,
    fromAccountId: transfer.from_account_id,
    toAccountId: transfer.to_account_id,
  }));
  const refunds = unwrap(refundResponse).map((refund) => {
    const category = categoryById.get(refund.expenses?.category_id);
    return {
      id: refund.id,
      type: 'refund',
      amountCents: refund.amount_cents,
      date: refund.refunded_on,
      createdAt: refund.created_at,
      title: refund.expenses?.merchant || 'Expense refund',
      subtitle: `${category?.name || 'Expense'} refund`,
      note: refund.note,
      categoryId: refund.expenses?.category_id || null,
      expenseId: refund.expense_id,
      accountId: refund.account_id,
      accountName: accountById.get(refund.account_id)?.name || null,
      color: category?.color,
    };
  });

  return [...income, ...expenses, ...installments, ...directCardPayments, ...transfers, ...refunds]
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, limit);
}
