import { supabase } from '../../../infrastructure/supabase/client';
import { fetchAllRows } from '../../../infrastructure/supabase/pagination';
import {
  calculateAccountBalances,
  summarizeAccounts,
} from '../utils/accountMath.cjs';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data || [];
}

export async function getAccounts(userId) {
  const [
    accountResponse,
    incomeResponse,
    expenseResponse,
    transferResponse,
    cardResponse,
    billResponse,
    refundResponse,
  ] = await Promise.all([
    supabase
      .from('financial_accounts')
      .select('id, name, account_type, opening_balance_cents, currency_code, institution_name, last_four, is_active')
      .eq('user_id', userId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true }),
    fetchAllRows(() => supabase.from('income_entries').select('account_id, amount_cents').eq('user_id', userId).not('account_id', 'is', null).order('id')),
    fetchAllRows(() => supabase.from('expenses').select('account_id, amount_cents').eq('user_id', userId).not('account_id', 'is', null).order('id')),
    fetchAllRows(() => supabase.from('account_transfers').select('from_account_id, to_account_id, amount_cents').eq('user_id', userId).order('id')),
    supabase.from('credit_cards').select('id, financial_account_id, tracking_mode').eq('user_id', userId),
    fetchAllRows(() => supabase.from('credit_card_bills').select('credit_card_id, amount_cents').eq('user_id', userId).is('paid_on', null).order('id')),
    fetchAllRows(() => supabase.from('expense_refunds').select('account_id, amount_cents').eq('user_id', userId).not('account_id', 'is', null).order('id')),
  ]);

  return calculateAccountBalances({
    accounts: unwrap(accountResponse),
    incomeEntries: incomeResponse,
    expenses: expenseResponse,
    transfers: transferResponse,
    creditCards: unwrap(cardResponse),
    unpaidCardBills: billResponse,
    refunds: refundResponse,
  });
}

export async function getAccountOverview(userId) {
  const accounts = await getAccounts(userId);
  return { accounts, ...summarizeAccounts(accounts) };
}

export async function createAccount({
  userId,
  name,
  accountType,
  openingBalanceCents,
  currencyCode,
  institutionName,
  lastFour,
}) {
  const response = await supabase
    .from('financial_accounts')
    .insert({
      user_id: userId,
      name: name.trim(),
      account_type: accountType,
      opening_balance_cents: openingBalanceCents,
      currency_code: currencyCode,
      institution_name: institutionName.trim() || null,
      last_four: lastFour.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) throw response.error;
  return response.data;
}

export async function createAccountTransfer({
  userId,
  fromAccountId,
  toAccountId,
  amountCents,
  transferredOn,
  note,
}) {
  const response = await supabase
    .from('account_transfers')
    .insert({
      user_id: userId,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount_cents: amountCents,
      transferred_on: transferredOn,
      note: note.trim() || null,
    })
    .select('id')
    .single();

  if (response.error) throw response.error;
  return response.data;
}

export async function setAccountActive({ userId, accountId, isActive }) {
  const response = await supabase
    .from('financial_accounts')
    .update({ is_active: isActive })
    .eq('user_id', userId)
    .eq('id', accountId)
    .neq('account_type', 'credit_card');

  if (response.error) throw response.error;
}
