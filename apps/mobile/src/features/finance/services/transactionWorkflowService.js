import { supabase } from '../../../infrastructure/supabase/client';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

export async function getExpenseAdjustments({ userId, expenseId }) {
  const [splitResponse, refundResponse, tagResponse] = await Promise.all([
    supabase
      .from('expense_splits')
      .select('id, category_id, amount_cents, memo, sort_order, expense_categories(name, color)')
      .eq('user_id', userId)
      .eq('expense_id', expenseId)
      .order('sort_order'),
    supabase
      .from('expense_refunds')
      .select('id, account_id, amount_cents, refunded_on, note, financial_accounts(name)')
      .eq('user_id', userId)
      .eq('expense_id', expenseId)
      .order('refunded_on', { ascending: false }),
    supabase
      .from('expense_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('user_id', userId)
      .eq('expense_id', expenseId),
  ]);

  return {
    splits: unwrap(splitResponse),
    refunds: unwrap(refundResponse),
    tags: unwrap(tagResponse).map((row) => row.tags).filter(Boolean),
  };
}

export async function saveExpenseSplits({ expenseId, splits }) {
  const response = await supabase.rpc('save_expense_splits', {
    p_expense_id: expenseId,
    p_splits: splits,
  });
  if (response.error) throw response.error;
}

export async function createExpenseRefund({
  expenseId,
  amountCents,
  refundedOn,
  accountId,
  note,
}) {
  const response = await supabase.rpc('create_expense_refund', {
    p_expense_id: expenseId,
    p_amount_cents: amountCents,
    p_refunded_on: refundedOn,
    p_account_id: accountId || null,
    p_note: note.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data;
}

export async function getTags(userId) {
  return unwrap(
    await supabase
      .from('tags')
      .select('id, name, color')
      .eq('user_id', userId)
      .order('name'),
  );
}

export async function createTag({ userId, name, color = '#2F5F8F' }) {
  const response = await supabase
    .from('tags')
    .insert({ user_id: userId, name: name.trim(), color })
    .select('id, name, color')
    .single();
  if (response.error) throw response.error;
  return response.data;
}

export async function setExpenseTags({ userId, expenseId, tagIds }) {
  const deleteResponse = await supabase
    .from('expense_tags')
    .delete()
    .eq('user_id', userId)
    .eq('expense_id', expenseId);
  if (deleteResponse.error) throw deleteResponse.error;
  if (!tagIds.length) return;

  const response = await supabase.from('expense_tags').insert(
    tagIds.map((tagId) => ({ user_id: userId, expense_id: expenseId, tag_id: tagId })),
  );
  if (response.error) throw response.error;
}

export async function getCategorizationRules(userId) {
  return unwrap(
    await supabase
      .from('categorization_rules')
      .select('id, name, priority, match_field, operator, match_value, category_id, review_action, is_active, created_at, expense_categories(name, color)')
      .eq('user_id', userId)
      .order('priority')
      .order('created_at'),
  );
}

export async function createCategorizationRule({
  userId,
  name,
  matchField,
  operator,
  matchValue,
  categoryId,
  reviewAction,
}) {
  const response = await supabase
    .from('categorization_rules')
    .insert({
      user_id: userId,
      name: name.trim(),
      match_field: matchField,
      operator,
      match_value: matchValue.trim(),
      category_id: categoryId,
      review_action: reviewAction,
    })
    .select('id')
    .single();
  if (response.error) throw response.error;
  return response.data;
}

export async function setCategorizationRuleActive({ userId, ruleId, isActive }) {
  const response = await supabase
    .from('categorization_rules')
    .update({ is_active: isActive })
    .eq('user_id', userId)
    .eq('id', ruleId);
  if (response.error) throw response.error;
}

export async function deleteCategorizationRule({ userId, ruleId }) {
  const response = await supabase
    .from('categorization_rules')
    .delete()
    .eq('user_id', userId)
    .eq('id', ruleId);
  if (response.error) throw response.error;
}

export async function getReviewItems(userId) {
  return unwrap(
    await supabase
      .from('review_items')
      .select('id, expense_id, reason, status, created_at, expenses(amount_cents, merchant, spent_on, category_id)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  );
}

export async function createReviewItem({ userId, expenseId, reason }) {
  const response = await supabase
    .from('review_items')
    .upsert(
      { user_id: userId, expense_id: expenseId, reason, status: 'pending', reviewed_at: null },
      { onConflict: 'expense_id' },
    );
  if (response.error) throw response.error;
}

export async function resolveReviewItem({ userId, reviewItemId, status }) {
  const response = await supabase
    .from('review_items')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', reviewItemId);
  if (response.error) throw response.error;
}
