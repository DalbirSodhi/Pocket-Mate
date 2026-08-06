import { supabase } from '../../../infrastructure/supabase/client';
import { getAccounts } from '../../accounts/services/accountService';

export async function getDebtProfiles(userId) {
  const [accounts, settingsResponse] = await Promise.all([
    getAccounts(userId),
    supabase.from('debt_settings').select('account_id, apr_basis_points, minimum_payment_cents').eq('user_id', userId),
  ]);
  if (settingsResponse.error) throw settingsResponse.error;
  const byAccount = new Map((settingsResponse.data || []).map((row) => [row.account_id, row]));
  return accounts
    .filter((account) => ['loan', 'credit_card'].includes(account.account_type) && account.is_active && account.balanceCents > 0)
    .map((account) => ({ ...account, ...(byAccount.get(account.id) || {}) }));
}

export async function saveDebtProfiles({ userId, debts }) {
  const response = await supabase.from('debt_settings').upsert(
    debts.map((debt) => ({
      user_id: userId,
      account_id: debt.id,
      apr_basis_points: debt.aprBasisPoints,
      minimum_payment_cents: debt.minimumPaymentCents,
    })),
    { onConflict: 'account_id' },
  );
  if (response.error) throw response.error;
}
