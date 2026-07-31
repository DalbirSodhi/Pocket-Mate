const assert = require('node:assert/strict');
const test = require('node:test');

const { calculatePurchaseImpact } = require('./purchaseImpactMath.cjs');

const healthyPlan = {
  incomeCents: 300000,
  availableCents: 220000,
  spendableCents: 140000,
  safeToSpendCents: 20000,
  daysRemaining: 7,
  shortfallCents: 0,
};

test('reports a purchase that fits available cash, commitments, and its cap', () => {
  const result = calculatePurchaseImpact({
    ...healthyPlan,
    amountCents: 15000,
    budgetCap: { amount_cents: 80000, spentCents: 30000 },
  });

  assert.equal(result.label, 'Fits your plan');
  assert.equal(result.tone, 'success');
  assert.equal(result.projectedAvailableCents, 205000);
  assert.equal(result.projectedSpendableCents, 125000);
  assert.equal(result.projectedSafeToSpendCents, 17857);
  assert.equal(result.projectedCategoryRemainingCents, 35000);
});

test('warns when a purchase fits the month but exceeds the daily pace', () => {
  const result = calculatePurchaseImpact({
    ...healthyPlan,
    amountCents: 25000,
  });

  assert.equal(result.label, "Above today's pace");
  assert.equal(result.tone, 'warning');
  assert.equal(result.staysInsideDailyPace, false);
});

test('blocks a purchase that would use money reserved for commitments', () => {
  const result = calculatePurchaseImpact({
    ...healthyPlan,
    amountCents: 150000,
  });

  assert.equal(result.label, 'Conflicts with commitments');
  assert.equal(result.hasCash, true);
  assert.equal(result.protectsCommitments, false);
  assert.equal(result.reductionCents, 10000);
});

test('reports the category overage and affordable reduction', () => {
  const result = calculatePurchaseImpact({
    ...healthyPlan,
    amountCents: 50000,
    budgetCap: { amount_cents: 70000, spentCents: 40000 },
  });

  assert.equal(result.label, 'Over category cap');
  assert.equal(result.projectedCategoryRemainingCents, -20000);
  assert.equal(result.maxWithinPlanCents, 30000);
  assert.equal(result.reductionCents, 20000);
});

test('requires income before giving a positive purchase decision', () => {
  const result = calculatePurchaseImpact({
    amountCents: 1000,
    incomeCents: 0,
    availableCents: 0,
    spendableCents: 0,
    safeToSpendCents: 0,
    daysRemaining: 1,
  });

  assert.equal(result.label, 'Add income first');
  assert.equal(result.maxWithinPlanCents, 0);
});
