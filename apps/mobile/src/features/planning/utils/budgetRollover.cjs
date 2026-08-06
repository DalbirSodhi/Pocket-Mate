const ROLLOVER_MODES = Object.freeze({
  NONE: 'none',
  POSITIVE_ONLY: 'positive_only',
  FULL: 'full',
});

const VALID_ROLLOVER_MODES = new Set(Object.values(ROLLOVER_MODES));

function normalizeCents(value) {
  const cents = Number(value ?? 0);

  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

function assertRolloverMode(mode) {
  if (!VALID_ROLLOVER_MODES.has(mode)) {
    throw new RangeError(`Invalid rollover mode: ${String(mode)}`);
  }

  return mode;
}

function calculateRolloverOut(remainingCents, rolloverMode) {
  const remaining = normalizeCents(remainingCents);
  const mode = assertRolloverMode(rolloverMode);

  if (mode === ROLLOVER_MODES.NONE) {
    return 0;
  }

  if (mode === ROLLOVER_MODES.POSITIVE_ONLY) {
    return Math.max(remaining, 0);
  }

  return remaining;
}

function calculateBudgetAllocation({
  plannedAmountCents = 0,
  spentAmountCents = 0,
  rolloverInCents = 0,
  rolloverMode = ROLLOVER_MODES.NONE,
} = {}) {
  const planned = normalizeCents(plannedAmountCents);
  const spent = normalizeCents(spentAmountCents);
  const rolloverIn = normalizeCents(rolloverInCents);
  const mode = assertRolloverMode(rolloverMode);
  const availableCents = planned + rolloverIn;
  const remainingCents = availableCents - spent;

  return {
    plannedAmountCents: planned,
    spentAmountCents: spent,
    rolloverMode: mode,
    rolloverInCents: rolloverIn,
    availableCents,
    remainingCents,
    rolloverOutCents: calculateRolloverOut(remainingCents, mode),
  };
}

function getMonthStart(allocation) {
  return allocation.monthStart ?? allocation.month_start ?? null;
}

function orderAllocations(allocations) {
  const rows = allocations.map((allocation, index) => ({ allocation, index }));
  const hasMonthForEveryRow = rows.every(
    ({ allocation }) => typeof getMonthStart(allocation) === 'string',
  );

  if (!hasMonthForEveryRow) {
    return rows;
  }

  return rows.sort((left, right) => {
    const monthComparison = getMonthStart(left.allocation).localeCompare(
      getMonthStart(right.allocation),
    );

    return monthComparison || left.index - right.index;
  });
}

function calculateBudgetRolloverChain(
  allocations = [],
  { openingRolloverInCents } = {},
) {
  if (!Array.isArray(allocations)) {
    throw new TypeError('Budget allocations must be an array.');
  }

  let nextRolloverIn = normalizeCents(
    openingRolloverInCents ??
      allocations[0]?.rolloverInCents ??
      allocations[0]?.rollover_in_cents ??
      0,
  );

  return orderAllocations(allocations).map(({ allocation }) => {
    const calculated = calculateBudgetAllocation({
      plannedAmountCents:
        allocation.plannedAmountCents ?? allocation.planned_amount_cents,
      spentAmountCents:
        allocation.spentAmountCents ?? allocation.spent_amount_cents,
      rolloverInCents: nextRolloverIn,
      rolloverMode:
        allocation.rolloverMode ??
        allocation.rollover_mode ??
        ROLLOVER_MODES.NONE,
    });

    nextRolloverIn = calculated.rolloverOutCents;

    return {
      ...allocation,
      ...calculated,
    };
  });
}

module.exports = {
  ROLLOVER_MODES,
  calculateBudgetAllocation,
  calculateBudgetRolloverChain,
  calculateRolloverOut,
  normalizeCents,
};
