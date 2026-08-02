import { supabase } from '../../../infrastructure/supabase/client';
import { getNextMonthlyDateString } from '../utils/financeValidation.cjs';

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
  amountCents,
  source,
  receivedOn,
  note,
}) {
  const response = await supabase
    .from('income_entries')
    .insert({
      user_id: userId,
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
    .select('id, amount_cents, source, received_on, note')
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
  amountCents,
  source,
  receivedOn,
  note,
}) {
  const response = await supabase
    .from('income_entries')
    .update({
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
      .select('id, category_id, amount_cents, spent_on, merchant, note')
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
  userId,
  expenseId,
  categoryId,
  amountCents,
  spentOn,
  merchant,
  note,
}) {
  const response = await supabase
    .from('expenses')
    .update({
      category_id: categoryId,
      amount_cents: amountCents,
      spent_on: spentOn,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
    })
    .eq('user_id', userId)
    .eq('id', expenseId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
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

  return response.data;
}

export async function createRecurringExpense({
  userId,
  categoryId,
  name,
  amountCents,
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
      cadence: 'monthly',
      charge_day: Number(startsOn.split('-')[2]),
      starts_on: startsOn,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

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

  return response.data;
}

export async function getCreditCards(userId) {
  const response = await supabase
    .from('credit_cards')
    .select('id, nickname, issuer, last_four, is_active')
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
    .select('id, nickname, issuer, last_four, is_active')
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

  return response.data;
}

export async function getCreditCardBills(userId, limit = 100) {
  const [billsResponse, cards] = await Promise.all([
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
  ]);
  const cardById = new Map(cards.map((card) => [card.id, card]));

  return unwrap(billsResponse).map((bill) => ({
    ...bill,
    card: cardById.get(bill.credit_card_id) || null,
  }));
}

export async function setCreditCardBillPaid({
  userId,
  billId,
  paidOn,
}) {
  const response = await supabase
    .from('credit_card_bills')
    .update({ paid_on: paidOn || null })
    .eq('user_id', userId)
    .eq('id', billId)
    .select('id')
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function getTransactions(
  userId,
  { startDate, endDate, limit = 500 } = {},
) {
  let incomeQuery = supabase
    .from('income_entries')
    .select('id, amount_cents, source, received_on, note, created_at')
    .eq('user_id', userId)
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  let expenseQuery = supabase
    .from('expenses')
    .select('id, amount_cents, merchant, spent_on, note, category_id, created_at')
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  let installmentQuery = supabase
    .from('bill_payment_installments')
    .select(
      'id, amount_cents, paid_on, created_at, bill_payment_plans(id, title, total_amount_cents, due_on, period_start, credit_card_bill_id, recurring_expense_id)',
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

  if (startDate) {
    incomeQuery = incomeQuery.gte('received_on', startDate);
    expenseQuery = expenseQuery.gte('spent_on', startDate);
    installmentQuery = installmentQuery.gte('paid_on', startDate);
    paidCardBillQuery = paidCardBillQuery.gte('paid_on', startDate);
  }

  if (endDate) {
    incomeQuery = incomeQuery.lte('received_on', endDate);
    expenseQuery = expenseQuery.lte('spent_on', endDate);
    installmentQuery = installmentQuery.lte('paid_on', endDate);
    paidCardBillQuery = paidCardBillQuery.lte('paid_on', endDate);
  }

  const [
    incomeResponse,
    expenseResponse,
    categories,
    installmentResponse,
    paidCardBillResponse,
    cards,
    planResponse,
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
  ]);

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
  }));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
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
    };
  });
  const installments = unwrap(installmentResponse).map((installment) => {
    const plan = installment.bill_payment_plans;

    return {
      id: installment.id,
      type: 'bill_payment',
      amountCents: installment.amount_cents,
      date: installment.paid_on,
      createdAt: installment.created_at,
      title: plan?.title || 'Bill payment',
      subtitle: 'Payment completed',
      note: null,
      categoryId: null,
      paymentPlan: plan || null,
    };
  });
  const plannedCardBillIds = new Set(
    unwrap(planResponse).map((plan) => plan.credit_card_bill_id),
  );
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const directCardPayments = unwrap(paidCardBillResponse)
    .filter((bill) => !plannedCardBillIds.has(bill.id))
    .map((bill) => ({
      id: bill.id,
      type: 'bill_payment',
      amountCents: bill.amount_cents,
      date: bill.paid_on,
      createdAt: bill.created_at,
      title: cardById.get(bill.credit_card_id)?.nickname || 'Credit card bill',
      subtitle: 'Statement paid',
      note: null,
      categoryId: null,
      paymentPlan: null,
      cardBillId: bill.id,
    }));

  return [...income, ...expenses, ...installments, ...directCardPayments]
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, limit);
}
