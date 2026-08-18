const ASSET_TYPES = new Set(['checking', 'savings', 'cash', 'investment', 'other']);
const LIABILITY_TYPES = new Set(['credit_card', 'loan']);

function normalizeCents(value) {
  const cents = Number(value || 0);
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

function parseBalanceToCents(value) {
  const normalized = String(value ?? '')
    .replace(/[$,\s]/g, '')
    .trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function calculateAccountBalances({
  accounts = [],
  incomeEntries = [],
  expenses = [],
  refunds = [],
  transfers = [],
  creditCards = [],
  unpaidCardBills = [],
  balanceAdjustments = [],
}) {
  const incomeByAccount = sumByAccount(incomeEntries, 'account_id');
  const expenseByAccount = sumByAccount(expenses, 'account_id');
  const refundByAccount = sumByAccount(refunds, 'account_id');
  const incomingByAccount = sumByAccount(transfers, 'to_account_id');
  const outgoingByAccount = sumByAccount(transfers, 'from_account_id');
  const adjustmentsByAccount = sumByAccount(
    balanceAdjustments,
    'account_id',
    'amount_delta_cents',
  );
  const cardByAccount = new Map(
    creditCards.map((card) => [card.financial_account_id, card]),
  );
  const billsByCard = new Map();

  for (const bill of unpaidCardBills) {
    billsByCard.set(
      bill.credit_card_id,
      (billsByCard.get(bill.credit_card_id) || 0) + normalizeCents(bill.amount_cents),
    );
  }

  return accounts.map((account) => {
    const opening = normalizeCents(account.opening_balance_cents);
    const income = incomeByAccount.get(account.id) || 0;
    const spending = expenseByAccount.get(account.id) || 0;
    const refundsReceived = refundByAccount.get(account.id) || 0;
    const incoming = incomingByAccount.get(account.id) || 0;
    const outgoing = outgoingByAccount.get(account.id) || 0;
    const adjustments = adjustmentsByAccount.get(account.id) || 0;
    let balanceCents;

    if (account.account_type === 'credit_card') {
      const card = cardByAccount.get(account.id);
      const charges =
        card?.tracking_mode === 'transactions'
          ? spending
          : billsByCard.get(card?.id) || 0;
      const cardRefunds = card?.tracking_mode === 'transactions' ? refundsReceived : 0;
      balanceCents = Math.max(
        opening + charges - cardRefunds + outgoing - incoming + adjustments,
        0,
      );
    } else if (LIABILITY_TYPES.has(account.account_type)) {
      balanceCents = Math.max(opening + outgoing - incoming + adjustments, 0);
    } else {
      balanceCents =
        opening + income + refundsReceived + incoming - spending - outgoing + adjustments;
    }

    return {
      ...account,
      balanceCents,
      trackingMode: cardByAccount.get(account.id)?.tracking_mode || null,
      isAsset: ASSET_TYPES.has(account.account_type),
      isLiability: LIABILITY_TYPES.has(account.account_type),
    };
  });
}

function summarizeAccounts(accounts = []) {
  return accounts.reduce(
    (summary, account) => {
      if (!account.is_active) {
        return summary;
      }

      if (account.isLiability) {
        summary.liabilityCents += normalizeCents(account.balanceCents);
      } else if (account.isAsset) {
        summary.assetCents += normalizeCents(account.balanceCents);
        if (['checking', 'savings', 'cash'].includes(account.account_type)) {
          summary.liquidCents += normalizeCents(account.balanceCents);
        }
        if (['checking', 'cash'].includes(account.account_type)) {
          summary.spendableCashCents += normalizeCents(account.balanceCents);
        }
      }

      summary.netWorthCents = summary.assetCents - summary.liabilityCents;
      return summary;
    },
    {
      assetCents: 0,
      liabilityCents: 0,
      liquidCents: 0,
      spendableCashCents: 0,
      netWorthCents: 0,
    },
  );
}

function sumByAccount(rows, key, amountKey = 'amount_cents') {
  const totals = new Map();

  for (const row of rows) {
    const accountId = row[key];
    if (!accountId) continue;
    totals.set(
      accountId,
      (totals.get(accountId) || 0) + normalizeCents(row[amountKey]),
    );
  }

  return totals;
}

module.exports = {
  ASSET_TYPES,
  LIABILITY_TYPES,
  calculateAccountBalances,
  parseBalanceToCents,
  summarizeAccounts,
};
