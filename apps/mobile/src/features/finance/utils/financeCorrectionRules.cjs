function getCreditCardBillMutationBlockReason({
  paidOn,
  hasCompletedInstallment,
}) {
  if (paidOn) {
    return 'Paid card bills are locked to preserve your payment history.';
  }

  if (hasCompletedInstallment) {
    return 'This bill has a completed planned payment, so it cannot be changed or deleted.';
  }

  return '';
}

module.exports = {
  getCreditCardBillMutationBlockReason,
};
