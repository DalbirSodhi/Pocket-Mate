const POSTED_STATUS = 'posted';
const CASH_DIRECTIONS = new Set(['in', 'out']);
const TRANSACTION_KINDS = new Set([
  'income',
  'expense',
  'refund',
  'transfer',
  'card_payment',
]);

function assertPositiveCents(value, fieldName = 'amountCents') {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive safe integer.`);
  }

  return value;
}

function assertNonNegativeCents(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative safe integer.`);
  }

  return value;
}

function addSafeCents(total, amount, fieldName) {
  const nextTotal = total + amount;

  if (!Number.isSafeInteger(nextTotal)) {
    throw new RangeError(`${fieldName} exceeds the safe integer range.`);
  }

  return nextTotal;
}

function getSplitAmountCents(split, index) {
  const amountCents = typeof split === 'number' ? split : split?.amountCents;
  return assertPositiveCents(amountCents, `splits[${index}].amountCents`);
}

function assertSplitsMatchParent(parentAmountCents, splits) {
  const parentTotal = assertPositiveCents(
    parentAmountCents,
    'parentAmountCents',
  );

  if (!Array.isArray(splits) || splits.length < 2) {
    throw new RangeError('splits must contain at least two splits.');
  }

  const splitTotal = splits.reduce(
    (total, split, index) =>
      addSafeCents(
        total,
        getSplitAmountCents(split, index),
        'split total',
      ),
    0,
  );

  if (splitTotal !== parentTotal) {
    throw new RangeError(
      `split total (${splitTotal}) must equal parent amount (${parentTotal}).`,
    );
  }

  return splitTotal;
}

function buildCategorizedAdjustments({ expenses = [], splits = [], refunds = [] }) {
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const splitsByExpenseId = new Map();

  for (const split of splits) {
    const expenseId = split.expense_id ?? split.expenseId;
    const rows = splitsByExpenseId.get(expenseId) || [];
    rows.push(split);
    splitsByExpenseId.set(expenseId, rows);
  }

  const categorizedExpenses = expenses.flatMap((expense) => {
    const expenseSplits = splitsByExpenseId.get(expense.id);
    if (!expenseSplits?.length) return [expense];

    return expenseSplits.map((split) => ({
      ...expense,
      ...split,
      id: expense.id,
      expense_id: expense.id,
      spent_on: expense.spent_on,
    }));
  });

  const categorizedRefunds = refunds.flatMap((refund) => {
    const expenseId = refund.expense_id ?? refund.expenseId;
    const expense = expenseById.get(expenseId);
    const expenseSplits = splitsByExpenseId.get(expenseId);

    if (!expenseSplits?.length) {
      return [{
        ...refund,
        category_id: refund.category_id ?? expense?.category_id ?? null,
      }];
    }

    const refundCents = assertPositiveCents(
      Number(refund.amount_cents ?? refund.amountCents),
      'refund.amountCents',
    );
    const splitTotal = expenseSplits.reduce(
      (total, split, index) =>
        addSafeCents(
          total,
          assertPositiveCents(
            Number(split.amount_cents ?? split.amountCents),
            `splits[${index}].amountCents`,
          ),
          'split total',
        ),
      0,
    );
    const allocated = expenseSplits.map((split, index) => {
      const splitCents = Number(split.amount_cents ?? split.amountCents);
      const exactNumerator = BigInt(refundCents) * BigInt(splitCents);
      const splitTotalBigInt = BigInt(splitTotal);
      const amountCents = Number(exactNumerator / splitTotalBigInt);

      return {
        index,
        remainder: exactNumerator % splitTotalBigInt,
        amountCents,
      };
    });
    let remainingCents = refundCents - allocated.reduce(
      (total, allocation) => total + allocation.amountCents,
      0,
    );

    for (const allocation of [...allocated].sort(
      (left, right) =>
        left.remainder === right.remainder
          ? left.index - right.index
          : left.remainder > right.remainder
            ? -1
            : 1,
    )) {
      if (remainingCents === 0) break;
      allocated[allocation.index].amountCents += 1;
      remainingCents -= 1;
    }

    return allocated
      .filter((allocation) => allocation.amountCents > 0)
      .map((allocation) => ({
        ...refund,
        category_id: expenseSplits[allocation.index].category_id,
        amount_cents: allocation.amountCents,
      }));
  });

  return { categorizedExpenses, categorizedRefunds };
}

function getRemainingRefundableCents(
  originalAmountCents,
  refundAmountsCents = [],
) {
  const originalTotal = assertPositiveCents(
    originalAmountCents,
    'originalAmountCents',
  );

  if (!Array.isArray(refundAmountsCents)) {
    throw new TypeError('refundAmountsCents must be an array.');
  }

  let refundedTotal = 0;

  refundAmountsCents.forEach((refund, index) => {
    const refundAmount =
      typeof refund === 'number' ? refund : refund?.amountCents;

    refundedTotal = addSafeCents(
      refundedTotal,
      assertPositiveCents(
        refundAmount,
        `refundAmountsCents[${index}].amountCents`,
      ),
      'refund total',
    );

    if (refundedTotal > originalTotal) {
      throw new RangeError('refund total cannot exceed the original amount.');
    }
  });

  return originalTotal - refundedTotal;
}

function getDirectedCashMovement(transaction, amountCents) {
  const { cashDirection } = transaction;

  if (!CASH_DIRECTIONS.has(cashDirection)) {
    throw new RangeError(
      `${transaction.kind} transactions require cashDirection "in" or "out".`,
    );
  }

  return cashDirection === 'in' ? amountCents : -amountCents;
}

function summarizeTransactions(transactions) {
  if (!Array.isArray(transactions)) {
    throw new TypeError('transactions must be an array.');
  }

  let incomeCents = 0;
  let expenseCents = 0;
  let refundCents = 0;
  let cashAccountMovementCents = 0;

  transactions.forEach((transaction, index) => {
    if (transaction?.status !== POSTED_STATUS) {
      return;
    }

    const { kind } = transaction;

    if (!TRANSACTION_KINDS.has(kind)) {
      throw new RangeError(`transactions[${index}].kind is not supported.`);
    }

    const amountCents = assertPositiveCents(
      transaction.amountCents,
      `transactions[${index}].amountCents`,
    );

    if (kind === 'income') {
      incomeCents = addSafeCents(incomeCents, amountCents, 'income total');
      cashAccountMovementCents = addSafeCents(
        cashAccountMovementCents,
        amountCents,
        'cash account movement',
      );
      return;
    }

    if (kind === 'expense') {
      expenseCents = addSafeCents(expenseCents, amountCents, 'expense total');
      cashAccountMovementCents = addSafeCents(
        cashAccountMovementCents,
        -amountCents,
        'cash account movement',
      );
      return;
    }

    if (kind === 'refund') {
      refundCents = addSafeCents(refundCents, amountCents, 'refund total');
      cashAccountMovementCents = addSafeCents(
        cashAccountMovementCents,
        amountCents,
        'cash account movement',
      );
      return;
    }

    cashAccountMovementCents = addSafeCents(
      cashAccountMovementCents,
      getDirectedCashMovement(transaction, amountCents),
      'cash account movement',
    );
  });

  const spentCents = expenseCents - refundCents;
  const netCents = incomeCents - spentCents;

  assertNonNegativeCents(incomeCents, 'income total');
  assertNonNegativeCents(expenseCents, 'expense total');
  assertNonNegativeCents(refundCents, 'refund total');

  if (!Number.isSafeInteger(spentCents) || !Number.isSafeInteger(netCents)) {
    throw new RangeError('transaction summary exceeds the safe integer range.');
  }

  return {
    incomeCents,
    expenseCents,
    refundCents,
    spentCents,
    netCents,
    cashAccountMovementCents,
  };
}

module.exports = {
  assertPositiveCents,
  assertSplitsMatchParent,
  buildCategorizedAdjustments,
  getRemainingRefundableCents,
  summarizeTransactions,
};
