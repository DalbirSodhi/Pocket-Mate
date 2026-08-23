const assert = require('node:assert/strict');
const test = require('node:test');

const { isEmailNotConfirmedError } = require('./authErrorMatchers.cjs');

test('detects the hosted auth response for unconfirmed accounts', () => {
  assert.equal(
    isEmailNotConfirmedError({ message: 'Email not confirmed' }),
    true,
  );
  assert.equal(
    isEmailNotConfirmedError({ message: 'Invalid login credentials' }),
    false,
  );
});
