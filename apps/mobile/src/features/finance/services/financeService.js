import { supabase } from '../../../infrastructure/supabase/client';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Housing', color: '#744553', icon: 'house' },
  { name: 'Food', color: '#8F6525', icon: 'utensils' },
  { name: 'Transport', color: '#5E6B4D', icon: 'car' },
  { name: 'Shopping', color: '#7A5D8A', icon: 'shopping-bag' },
  { name: 'Health', color: '#9A4F55', icon: 'heart-pulse' },
  { name: 'Bills', color: '#4F657A', icon: 'receipt' },
  { name: 'Entertainment', color: '#8A624E', icon: 'clapperboard' },
  { name: 'Other', color: '#746A60', icon: 'circle-ellipsis' },
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
      color: '#8F6525',
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

export async function getTransactions(userId, limit = 100) {
  const [incomeResponse, expenseResponse, categories] = await Promise.all([
    supabase
      .from('income_entries')
      .select('id, amount_cents, source, received_on, note, created_at')
      .eq('user_id', userId)
      .order('received_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('expenses')
      .select('id, amount_cents, merchant, spent_on, note, category_id, created_at')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    getExpenseCategories(userId),
  ]);

  const income = unwrap(incomeResponse).map((entry) => ({
    id: entry.id,
    type: 'income',
    amountCents: entry.amount_cents,
    date: entry.received_on,
    createdAt: entry.created_at,
    title: entry.source || 'Income',
    subtitle: entry.note || 'Money received',
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
      color: category?.color,
    };
  });

  return [...income, ...expenses]
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, limit);
}
