const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCreditCardBillMutationBlockReason,
} = require('./financeCorrectionRules.cjs');

test('allows correction of unpaid card bills without completed installments', () => {
  assert.equal(
    getCreditCardBillMutationBlockReason({
      paidOn: null,
      hasCompletedInstallment: false,
    }),
    '',
  );
});

test('locks paid card bills before checking payment-plan state', () => {
  assert.equal(
    getCreditCardBillMutationBlockReason({
      paidOn: '2026-08-13',
      hasCompletedInstallment: false,
    }),
    'Paid card bills are locked to preserve your payment history.',
  );
});

test('locks bills with completed planned payments', () => {
  assert.equal(
    getCreditCardBillMutationBlockReason({
      paidOn: null,
      hasCompletedInstallment: true,
    }),
    'This bill has a completed planned payment, so it cannot be changed or deleted.',
  );
});
