const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAccountBalances,
  parseBalanceToCents,
  summarizeAccounts,
} = require('./accountMath.cjs');

test('balance parser accepts zero, signed balances, and two decimals', () => {
  assert.equal(parseBalanceToCents('0'), 0);
  assert.equal(parseBalanceToCents('1,234.56'), 123456);
  assert.equal(parseBalanceToCents('-12.30'), -1230);
  assert.equal(parseBalanceToCents('12.345'), null);
  assert.equal(parseBalanceToCents(''), null);
});

test('asset balances include linked cash flow and transfers', () => {
  const accounts = calculateAccountBalances({
    accounts: [
      { id: 'checking', account_type: 'checking', opening_balance_cents: 10000, is_active: true },
      { id: 'savings', account_type: 'savings', opening_balance_cents: 5000, is_active: true },
    ],
    incomeEntries: [{ account_id: 'checking', amount_cents: 20000 }],
    expenses: [{ account_id: 'checking', amount_cents: 2500 }],
    transfers: [{ from_account_id: 'checking', to_account_id: 'savings', amount_cents: 3000 }],
  });

  assert.equal(accounts[0].balanceCents, 24500);
  assert.equal(accounts[1].balanceCents, 8000);
  assert.deepEqual(summarizeAccounts(accounts), {
    assetCents: 32500,
    liabilityCents: 0,
    liquidCents: 32500,
    spendableCashCents: 24500,
    netWorthCents: 32500,
  });
});

test('spendable cash excludes protected savings balances', () => {
  const accounts = calculateAccountBalances({
    accounts: [
      { id: 'checking', account_type: 'checking', opening_balance_cents: 12000, is_active: true },
      { id: 'cash', account_type: 'cash', opening_balance_cents: 3000, is_active: true },
      { id: 'savings', account_type: 'savings', opening_balance_cents: 40000, is_active: true },
    ],
  });

  assert.equal(summarizeAccounts(accounts).spendableCashCents, 15000);
});

test('transactional card charges increase debt and payments reduce it', () => {
  const [card] = calculateAccountBalances({
    accounts: [{ id: 'card-account', account_type: 'credit_card', opening_balance_cents: 10000 }],
    creditCards: [{ id: 'card', financial_account_id: 'card-account', tracking_mode: 'transactions' }],
    expenses: [{ account_id: 'card-account', amount_cents: 4000 }],
    refunds: [{ account_id: 'card-account', amount_cents: 1000 }],
    transfers: [{ from_account_id: 'checking', to_account_id: 'card-account', amount_cents: 6000 }],
  });

  assert.equal(card.balanceCents, 7000);
});

test('statement card debt uses unpaid statements instead of purchase rows', () => {
  const [card] = calculateAccountBalances({
    accounts: [{ id: 'card-account', account_type: 'credit_card', opening_balance_cents: 0 }],
    creditCards: [{ id: 'card', financial_account_id: 'card-account', tracking_mode: 'statement' }],
    expenses: [{ account_id: 'card-account', amount_cents: 99999 }],
    unpaidCardBills: [{ credit_card_id: 'card', amount_cents: 280000 }],
  });

  assert.equal(card.balanceCents, 280000);
});

test('signed balance adjustments reconcile asset and liability balances', () => {
  const accounts = calculateAccountBalances({
    accounts: [
      { id: 'checking', account_type: 'checking', opening_balance_cents: 10000 },
      { id: 'loan', account_type: 'loan', opening_balance_cents: 50000 },
    ],
    balanceAdjustments: [
      { account_id: 'checking', amount_delta_cents: -1250 },
      { account_id: 'loan', amount_delta_cents: 800 },
    ],
  });

  assert.equal(accounts[0].balanceCents, 8750);
  assert.equal(accounts[1].balanceCents, 50800);
});
