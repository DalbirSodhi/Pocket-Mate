function isEmailNotConfirmedError(error) {
  return String(error?.message || '')
    .toLowerCase()
    .includes('email not confirmed');
}

module.exports = {
  isEmailNotConfirmedError,
};
