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

  if (!Array.isArray(splits) || splits.length === 0) {
    throw new RangeError('splits must contain at least one split.');
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
  getRemainingRefundableCents,
  summarizeTransactions,
};
