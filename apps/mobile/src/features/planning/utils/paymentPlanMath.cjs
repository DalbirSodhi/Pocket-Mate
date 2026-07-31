const {
  addDays,
  getCalendarDayDifference,
  getLocalDateString,
  isValidDateString,
  parseLocalDateString,
} = require('../../../utils/date.cjs');
const {
  parseAmountToCents,
} = require('../../finance/utils/financeValidation.cjs');

function formatCentsForInput(amountCents) {
  return (Number(amountCents || 0) / 100).toFixed(2);
}

function getMonthEndDateString(date = new Date()) {
  return getLocalDateString(
    new Date(date.getFullYear(), date.getMonth() + 1, 0, 12),
  );
}

function getPeriodStartDateString(value) {
  return `${String(value).slice(0, 7)}-01`;
}

function getPaymentPlanWindow({ dueOn, date = new Date() }) {
  const startDate = getLocalDateString(date);
  const monthEndDate = getMonthEndDateString(date);

  return {
    startDate,
    endDate: dueOn > monthEndDate ? dueOn : monthEndDate,
  };
}

function splitAmount(totalAmountCents, count) {
  const normalizedTotal = Number(totalAmountCents || 0);
  const normalizedCount = Math.max(Number(count || 0), 1);
  const baseAmount = Math.floor(normalizedTotal / normalizedCount);
  const remainder = normalizedTotal - baseAmount * normalizedCount;

  return Array.from(
    { length: normalizedCount },
    (_, index) => baseAmount + (index < remainder ? 1 : 0),
  );
}

function spreadDates(startDate, endDate, count) {
  const start = parseLocalDateString(startDate);
  const end = parseLocalDateString(endDate);

  if (!start || !end || count < 1) {
    return [];
  }

  if (count === 1) {
    return [startDate];
  }

  const daySpan = Math.max(getCalendarDayDifference(start, end), 0);

  return Array.from({ length: count }, (_, index) =>
    getLocalDateString(
      addDays(start, Math.round((daySpan * index) / (count - 1))),
    ),
  );
}

function buildEqualInstallments({
  totalAmountCents,
  count,
  startDate,
  endDate,
}) {
  const amounts = splitAmount(totalAmountCents, count);
  const dates = spreadDates(startDate, endDate, count);

  return amounts.map((amountCents, index) => ({
    amount: formatCentsForInput(amountCents),
    plannedOn: dates[index],
  }));
}

function validatePaymentPlan({
  installments,
  totalAmountCents,
  startDate,
  endDate,
}) {
  const errors = { installments: {} };

  if (installments.length < 2 || installments.length > 8) {
    errors.plan = 'Use between 2 and 8 payments.';
  }

  const amountCents = installments.map((installment, index) => {
    const amount = parseAmountToCents(installment.amount);
    const installmentErrors = {};

    if (amount === null) {
      installmentErrors.amount = 'Enter a valid amount.';
    }

    if (!isValidDateString(installment.plannedOn)) {
      installmentErrors.date = 'Use YYYY-MM-DD.';
    } else if (installment.plannedOn < startDate) {
      installmentErrors.date = 'Payment cannot be before today.';
    } else if (installment.plannedOn > endDate) {
      installmentErrors.date = `Schedule by ${endDate}.`;
    }

    if (Object.keys(installmentErrors).length > 0) {
      errors.installments[index] = installmentErrors;
    }

    return amount || 0;
  });
  const plannedTotalCents = amountCents.reduce(
    (total, amount) => total + amount,
    0,
  );

  if (plannedTotalCents !== totalAmountCents) {
    errors.total = `Payments must total ${formatCentsForInput(totalAmountCents)}.`;
  }

  return {
    errors,
    amountCents,
    isValid:
      !errors.plan &&
      !errors.total &&
      Object.keys(errors.installments).length === 0,
  };
}

module.exports = {
  buildEqualInstallments,
  formatCentsForInput,
  getPaymentPlanWindow,
  getPeriodStartDateString,
  splitAmount,
  spreadDates,
  validatePaymentPlan,
};
