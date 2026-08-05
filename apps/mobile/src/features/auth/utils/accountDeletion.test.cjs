const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
} = require('./accountDeletion.cjs');

test('account deletion requires the exact confirmation phrase', () => {
  assert.equal(ACCOUNT_DELETION_CONFIRMATION, 'DELETE');
  assert.equal(isAccountDeletionConfirmed('DELETE'), true);
  assert.equal(isAccountDeletionConfirmed('  DELETE  '), true);
  assert.equal(isAccountDeletionConfirmed('delete'), false);
  assert.equal(isAccountDeletionConfirmed('DELETE ACCOUNT'), false);
  assert.equal(isAccountDeletionConfirmed(''), false);
});
