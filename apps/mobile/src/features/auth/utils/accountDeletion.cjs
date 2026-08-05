const ACCOUNT_DELETION_CONFIRMATION = 'DELETE';

function isAccountDeletionConfirmed(value) {
  return String(value || '').trim() === ACCOUNT_DELETION_CONFIRMATION;
}

module.exports = {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
};
