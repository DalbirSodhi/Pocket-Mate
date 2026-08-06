const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyRules,
  findBestRule,
  matchesRule,
  normalizeText,
} = require('./ruleMatching.cjs');

function createRule(overrides = {}) {
  return {
    id: 'rule-1',
    priority: 10,
    matchField: 'merchant',
    operator: 'contains',
    matchValue: 'market',
    categoryId: 'groceries',
    reviewAction: 'approve',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

test('normalizes case and repeated whitespace', () => {
  assert.equal(normalizeText('  WHOLE\n  Foods   Market '), 'whole foods market');
  assert.equal(
    matchesRule(
      { merchant: '  WHOLE   Foods Market ' },
      createRule({ operator: 'exact', matchValue: 'whole foods   market' }),
    ),
    true,
  );
});

test('supports merchant and note with only allowlisted operators', () => {
  const transaction = {
    merchant: 'North Shore Market',
    note: 'Weekly household groceries',
  };

  assert.equal(
    matchesRule(transaction, createRule({ operator: 'starts_with', matchValue: 'north' })),
    true,
  );
  assert.equal(
    matchesRule(
      transaction,
      createRule({ matchField: 'note', matchValue: 'household' }),
    ),
    true,
  );
  assert.equal(
    matchesRule(transaction, createRule({ operator: 'regex', matchValue: '.*' })),
    false,
  );
  assert.equal(
    matchesRule(transaction, createRule({ matchField: 'amount', matchValue: '10' })),
    false,
  );
});

test('ignores inactive and empty rules', () => {
  const transaction = { merchant: 'Corner Market' };

  assert.equal(
    matchesRule(transaction, createRule({ isActive: false })),
    false,
  );
  assert.equal(
    matchesRule(transaction, createRule({ matchValue: '   ' })),
    false,
  );
});

test('selects lower priority before operator specificity', () => {
  const transaction = { merchant: 'North Market' };
  const rules = [
    createRule({ id: 'exact', priority: 20, operator: 'exact', matchValue: 'North Market' }),
    createRule({ id: 'contains', priority: 10, operator: 'contains', matchValue: 'market' }),
  ];

  assert.equal(findBestRule(transaction, rules).id, 'contains');
});

test('uses exact, starts_with, then contains specificity for equal priorities', () => {
  const transaction = { merchant: 'North Market' };
  const rules = [
    createRule({ id: 'contains', operator: 'contains', matchValue: 'market' }),
    createRule({ id: 'starts', operator: 'starts_with', matchValue: 'north' }),
    createRule({ id: 'exact', operator: 'exact', matchValue: 'north market' }),
  ];

  assert.equal(findBestRule(transaction, rules).id, 'exact');
});

test('uses createdAt and then id as stable final tie-breakers', () => {
  const transaction = { merchant: 'North Market' };
  const older = createRule({ id: 'z-rule', createdAt: '2026-07-01T00:00:00.000Z' });
  const newer = createRule({ id: 'a-rule', createdAt: '2026-08-01T00:00:00.000Z' });

  assert.equal(findBestRule(transaction, [newer, older]).id, 'z-rule');

  const sameDateRules = [
    createRule({ id: 'b-rule' }),
    createRule({ id: 'a-rule' }),
  ];

  assert.equal(findBestRule(transaction, sameDateRules).id, 'a-rule');
});

test('returns null when no rule matches', () => {
  assert.equal(
    findBestRule({ merchant: 'Coffee Shop' }, [createRule()]),
    null,
  );
});

test('applies category and review action without mutating inputs', () => {
  const transaction = {
    id: 'transaction-1',
    merchant: 'Corner Market',
    categoryId: 'uncategorized',
  };
  const rules = [createRule()];
  const originalTransaction = { ...transaction };
  const originalRule = { ...rules[0] };

  const result = applyRules(transaction, rules);

  assert.deepEqual(result, {
    ...transaction,
    categoryId: 'groceries',
    reviewAction: 'approve',
  });
  assert.notEqual(result, transaction);
  assert.deepEqual(transaction, originalTransaction);
  assert.deepEqual(rules[0], originalRule);
});

test('accepts database-style rule property names', () => {
  const rule = {
    id: 'database-rule',
    priority: 1,
    match_field: 'note',
    operator: 'exact',
    match_value: 'monthly transit pass',
    category_id: 'transportation',
    review_action: 'review',
    is_active: true,
    created_at: '2026-08-01T00:00:00.000Z',
  };

  assert.deepEqual(
    applyRules({ note: ' Monthly   Transit Pass ' }, [rule]),
    {
      note: ' Monthly   Transit Pass ',
      categoryId: 'transportation',
      reviewAction: 'review',
    },
  );
});
