function toCents(value) {
  const cents = Number(value || 0);
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

function calculatePurchaseImpact({
  amountCents,
  incomeCents,
  availableCents,
  spendableCents,
  safeToSpendCents,
  daysRemaining,
  shortfallCents = 0,
  budgetCap = null,
}) {
  const amount = Math.max(toCents(amountCents), 0);
  const income = toCents(incomeCents);
  const available = toCents(availableCents);
  const spendable = toCents(spendableCents);
  const safeToSpend = Math.max(toCents(safeToSpendCents), 0);
  const shortfall = Math.max(toCents(shortfallCents), 0);
  const remainingDays = Math.max(toCents(daysRemaining), 1);
  const projectedAvailableCents = available - amount;
  const projectedSpendableCents = spendable - amount;
  const projectedSafeToSpendCents = Math.floor(
    Math.max(projectedSpendableCents, 0) / remainingDays,
  );
  const capLimitCents = budgetCap
    ? Math.max(toCents(budgetCap.amount_cents), 0)
    : null;
  const capSpentCents = budgetCap
    ? Math.max(toCents(budgetCap.spentCents), 0)
    : null;
  const projectedCategorySpentCents = budgetCap
    ? capSpentCents + amount
    : null;
  const projectedCategoryRemainingCents = budgetCap
    ? capLimitCents - projectedCategorySpentCents
    : null;
  const projectedCategoryRatio =
    budgetCap && capLimitCents > 0
      ? projectedCategorySpentCents / capLimitCents
      : null;
  const hasIncome = income > 0;
  const hasCash = projectedAvailableCents >= 0;
  const protectsCommitments = shortfall === 0 && projectedSpendableCents >= 0;
  const staysInsideCap =
    !budgetCap || projectedCategorySpentCents <= capLimitCents;
  const staysInsideDailyPace = amount <= safeToSpend;
  const capRoomBeforePurchase = budgetCap
    ? Math.max(capLimitCents - capSpentCents, 0)
    : Number.POSITIVE_INFINITY;
  const maxWithinPlanCents = hasIncome
    ? Math.max(
        Math.min(available, spendable, capRoomBeforePurchase),
        0,
      )
    : 0;
  const reductionCents = Math.max(amount - maxWithinPlanCents, 0);

  let decision;

  if (!hasIncome) {
    decision = {
      label: 'Add income first',
      tone: 'warning',
      detail: 'Income is needed before Pocket-Mate can judge this purchase.',
    };
  } else if (!hasCash) {
    decision = {
      label: 'Not covered by current cash',
      tone: 'danger',
      detail: 'This purchase is larger than the money currently available.',
    };
  } else if (!protectsCommitments) {
    decision = {
      label: 'Conflicts with commitments',
      tone: 'danger',
      detail: 'This purchase would use money reserved for bills or savings.',
    };
  } else if (!staysInsideCap) {
    decision = {
      label: 'Over category cap',
      tone: 'danger',
      detail: 'You can cover it, but it would exceed this category limit.',
    };
  } else if (!staysInsideDailyPace) {
    decision = {
      label: "Above today's pace",
      tone: 'warning',
      detail: 'It fits this month, but reduces what is safe to spend each remaining day.',
    };
  } else if (projectedCategoryRatio !== null && projectedCategoryRatio >= 0.8) {
    decision = {
      label: 'Close to category cap',
      tone: 'warning',
      detail: 'It fits, but this category would have less than 20% remaining.',
    };
  } else {
    decision = {
      label: 'Fits your plan',
      tone: 'success',
      detail: 'Current cash, commitments, and this category remain covered.',
    };
  }

  return {
    amountCents: amount,
    projectedAvailableCents,
    projectedSpendableCents,
    projectedSafeToSpendCents,
    projectedCategorySpentCents,
    projectedCategoryRemainingCents,
    projectedCategoryRatio,
    maxWithinPlanCents,
    reductionCents,
    hasCash,
    protectsCommitments,
    staysInsideCap,
    staysInsideDailyPace,
    ...decision,
  };
}

module.exports = { calculatePurchaseImpact };
