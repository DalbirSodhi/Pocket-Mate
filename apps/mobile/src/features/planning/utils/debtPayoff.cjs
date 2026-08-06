const DEBT_PAYOFF_STRATEGIES = Object.freeze({
  AVALANCHE: 'avalanche',
  SNOWBALL: 'snowball',
});

const MAX_SIMULATION_MONTHS = 1200;
const INTEREST_DENOMINATOR = 120000n;

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }

  return value;
}

function assertSafeTotal(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} exceeds the supported integer-cent range.`);
  }

  return value;
}

function assertStartDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('startDate must use YYYY-MM-DD format.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError('startDate must be a valid calendar date.');
  }

  return { day, month, year };
}

function addMonthsClamped(dateParts, offset) {
  const firstOfTargetMonth = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1 + offset, 1),
  );
  const year = firstOfTargetMonth.getUTCFullYear();
  const monthIndex = firstOfTargetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(dateParts.day, lastDay);

  return [year, monthIndex + 1, day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function roundDivide(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

function calculateMonthlyInterestCents(balanceCents, aprBasisPoints) {
  assertPositiveInteger(balanceCents, 'balanceCents');
  assertPositiveInteger(aprBasisPoints, 'aprBasisPoints');

  const interest = roundDivide(
    BigInt(balanceCents) * BigInt(aprBasisPoints),
    INTEREST_DENOMINATOR,
  );

  if (interest > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Monthly interest exceeds the supported integer-cent range.');
  }

  return Number(interest);
}

function normalizeDebts(debts) {
  if (!Array.isArray(debts) || debts.length === 0) {
    throw new TypeError('debts must be a non-empty array.');
  }

  const ids = new Set();
  const normalized = debts.map((debt, index) => {
    if (!debt || typeof debt !== 'object') {
      throw new TypeError(`debts[${index}] must be an object.`);
    }

    if (typeof debt.id !== 'string' || debt.id.trim() === '') {
      throw new TypeError(`debts[${index}].id must be a non-empty string.`);
    }

    if (ids.has(debt.id)) {
      throw new RangeError(`Debt id must be unique: ${debt.id}`);
    }

    ids.add(debt.id);

    return {
      id: debt.id,
      name: typeof debt.name === 'string' ? debt.name : debt.id,
      balanceCents: assertPositiveInteger(
        debt.balanceCents,
        `debts[${index}].balanceCents`,
      ),
      aprBasisPoints: assertPositiveInteger(
        debt.aprBasisPoints,
        `debts[${index}].aprBasisPoints`,
      ),
      minimumPaymentCents: assertPositiveInteger(
        debt.minimumPaymentCents,
        `debts[${index}].minimumPaymentCents`,
      ),
      originalIndex: index,
    };
  });

  assertSafeTotal(
    normalized.reduce((total, debt) => total + debt.balanceCents, 0),
    'Combined debt balance',
  );
  assertSafeTotal(
    normalized.reduce((total, debt) => total + debt.minimumPaymentCents, 0),
    'Combined minimum payment',
  );

  return normalized;
}

function comparePriority(left, right, strategy) {
  if (strategy === DEBT_PAYOFF_STRATEGIES.AVALANCHE) {
    return (
      right.aprBasisPoints - left.aprBasisPoints ||
      left.originalIndex - right.originalIndex
    );
  }

  return (
    left.balanceCents - right.balanceCents ||
    left.originalIndex - right.originalIndex
  );
}

function getPriorityOrder(debts, strategy) {
  return [...debts]
    .filter((debt) => debt.balanceCents > 0)
    .sort((left, right) => comparePriority(left, right, strategy));
}

function addWarning(warnings, warning) {
  if (
    !warnings.some(
      (existing) =>
        existing.code === warning.code && existing.debtId === warning.debtId,
    )
  ) {
    warnings.push(warning);
  }
}

function calculateDebtPayoff({
  debts,
  monthlyExtraPaymentCents,
  strategy = DEBT_PAYOFF_STRATEGIES.AVALANCHE,
  startDate,
  maxMonths = MAX_SIMULATION_MONTHS,
} = {}) {
  const normalizedDebts = normalizeDebts(debts);
  const extraPayment = assertPositiveInteger(
    monthlyExtraPaymentCents,
    'monthlyExtraPaymentCents',
  );
  const startDateParts = assertStartDate(startDate);

  if (!Object.values(DEBT_PAYOFF_STRATEGIES).includes(strategy)) {
    throw new RangeError(`Unsupported debt payoff strategy: ${String(strategy)}`);
  }

  assertPositiveInteger(maxMonths, 'maxMonths');
  const simulationLimitMonths = Math.min(maxMonths, MAX_SIMULATION_MONTHS);
  const monthlyMinimumPaymentCents = normalizedDebts.reduce(
    (total, debt) => total + debt.minimumPaymentCents,
    0,
  );
  const monthlyPaymentBudgetCents = assertSafeTotal(
    monthlyMinimumPaymentCents + extraPayment,
    'Monthly payment budget',
  );
  const state = normalizedDebts.map((debt) => ({ ...debt }));
  const warnings = [];
  const schedule = [];
  let totalInterestCents = 0;
  let stoppedForAmountLimit = false;

  state.forEach((debt) => {
    const initialInterestCents = calculateMonthlyInterestCents(
      debt.balanceCents,
      debt.aprBasisPoints,
    );

    if (debt.minimumPaymentCents <= initialInterestCents) {
      addWarning(warnings, {
        code: 'MINIMUM_PAYMENT_NOT_AMORTIZING',
        debtId: debt.id,
        message: `${debt.name}'s minimum payment does not exceed its initial monthly interest.`,
      });
    }
  });

  for (let monthIndex = 0; monthIndex < simulationLimitMonths; monthIndex += 1) {
    const activeDebts = state.filter((debt) => debt.balanceCents > 0);

    if (activeDebts.length === 0) {
      break;
    }

    const paymentDate = addMonthsClamped(startDateParts, monthIndex);
    const rowsById = new Map();
    const accruedDebts = [];
    let monthInterestCents = 0;
    let amountLimitReached = false;

    activeDebts.forEach((debt) => {
      const openingBalanceCents = debt.balanceCents;
      let interestCents;

      try {
        interestCents = calculateMonthlyInterestCents(
          openingBalanceCents,
          debt.aprBasisPoints,
        );
      } catch (error) {
        if (error instanceof RangeError) {
          amountLimitReached = true;
          return;
        }

        throw error;
      }

      const balanceWithInterest = openingBalanceCents + interestCents;

      if (!Number.isSafeInteger(balanceWithInterest)) {
        amountLimitReached = true;
        return;
      }

      monthInterestCents += interestCents;
      accruedDebts.push({
        debt,
        balanceWithInterest,
        row: {
          debtId: debt.id,
          name: debt.name,
          openingBalanceCents,
          interestCents,
          minimumPaymentCents: 0,
          extraPaymentCents: 0,
          paymentCents: 0,
          closingBalanceCents: balanceWithInterest,
          paidOff: false,
        },
      });
    });

    const accruedBalanceCents = activeDebts.reduce(
      (total, debt) => total + debt.balanceCents,
      0,
    ) + monthInterestCents;

    if (
      amountLimitReached ||
      !Number.isSafeInteger(monthInterestCents) ||
      !Number.isSafeInteger(accruedBalanceCents) ||
      !Number.isSafeInteger(totalInterestCents + monthInterestCents)
    ) {
      addWarning(warnings, {
        code: 'AMOUNT_LIMIT_REACHED',
        message: 'The simulation stopped before an amount exceeded the safe integer-cent range.',
      });
      stoppedForAmountLimit = true;
      break;
    }

    accruedDebts.forEach(({ debt, balanceWithInterest, row }) => {
      debt.balanceCents = balanceWithInterest;
      rowsById.set(debt.id, row);
    });

    let remainingBudgetCents = monthlyPaymentBudgetCents;

    activeDebts.forEach((debt) => {
      const minimumPaymentCents = Math.min(
        debt.minimumPaymentCents,
        debt.balanceCents,
        remainingBudgetCents,
      );
      const row = rowsById.get(debt.id);

      debt.balanceCents -= minimumPaymentCents;
      remainingBudgetCents -= minimumPaymentCents;
      row.minimumPaymentCents = minimumPaymentCents;
      row.paymentCents = minimumPaymentCents;
    });

    while (remainingBudgetCents > 0) {
      const target = getPriorityOrder(state, strategy)[0];

      if (!target) {
        break;
      }

      const extraPaymentCents = Math.min(
        target.balanceCents,
        remainingBudgetCents,
      );
      const row = rowsById.get(target.id);

      target.balanceCents -= extraPaymentCents;
      remainingBudgetCents -= extraPaymentCents;
      row.extraPaymentCents += extraPaymentCents;
      row.paymentCents += extraPaymentCents;
    }

    const payments = activeDebts.map((debt) => {
      const row = rowsById.get(debt.id);

      row.closingBalanceCents = debt.balanceCents;
      row.paidOff = debt.balanceCents === 0;
      return row;
    });
    const paymentCents = payments.reduce(
      (total, payment) => total + payment.paymentCents,
      0,
    );
    const closingBalanceCents = state.reduce(
      (total, debt) => total + debt.balanceCents,
      0,
    );

    totalInterestCents += monthInterestCents;
    schedule.push({
      month: monthIndex + 1,
      paymentDate,
      openingBalanceCents: payments.reduce(
        (total, payment) => total + payment.openingBalanceCents,
        0,
      ),
      interestCents: monthInterestCents,
      paymentCents,
      unusedPaymentCents: remainingBudgetCents,
      closingBalanceCents,
      payments,
    });
  }

  const remainingBalanceCents = state.reduce(
    (total, debt) => total + debt.balanceCents,
    0,
  );
  const isPaidOff = remainingBalanceCents === 0;

  if (!isPaidOff && !stoppedForAmountLimit) {
    addWarning(warnings, {
      code: 'SIMULATION_LIMIT_REACHED',
      message: `The plan was not paid off within ${simulationLimitMonths} months.`,
    });
  }

  if (
    schedule.length > 0 &&
    schedule[schedule.length - 1].closingBalanceCents >=
      schedule[0].openingBalanceCents
  ) {
    addWarning(warnings, {
      code: 'PLAN_NOT_AMORTIZING',
      message: 'The payment plan is not reducing the combined debt balance.',
    });
  }

  const payoffMonth = isPaidOff ? schedule.length : null;
  const payoffDate = isPaidOff ? schedule[schedule.length - 1].paymentDate : null;

  return {
    strategy,
    monthlyExtraPaymentCents: extraPayment,
    monthlyMinimumPaymentCents,
    monthlyPaymentBudgetCents,
    simulationLimitMonths,
    isPaidOff,
    payoffMonth,
    payoffDate,
    totalInterestCents,
    remainingBalanceCents,
    warnings,
    schedule,
  };
}

module.exports = {
  DEBT_PAYOFF_STRATEGIES,
  MAX_SIMULATION_MONTHS,
  calculateDebtPayoff,
  calculateMonthlyInterestCents,
  getPriorityOrder,
};
