const assert = require('node:assert/strict');
const test = require('node:test');

const {
  NATIVE_CONFIRMATION_REDIRECT_URL,
  NATIVE_PASSWORD_RESET_REDIRECT_URL,
  getAuthRedirectUrl,
} = require('./authRedirect.cjs');

test('native confirmation links return to the installed app', () => {
  assert.equal(
    getAuthRedirectUrl({ flow: 'confirmation', platform: 'android' }),
    NATIVE_CONFIRMATION_REDIRECT_URL,
  );
});

test('native recovery links open the password reset route', () => {
  assert.equal(
    getAuthRedirectUrl({ flow: 'recovery', platform: 'ios' }),
    NATIVE_PASSWORD_RESET_REDIRECT_URL,
  );
});

test('web auth links return to the active web origin', () => {
  assert.equal(
    getAuthRedirectUrl({
      flow: 'confirmation',
      platform: 'web',
      webOrigin: 'https://app.pocket-mate.example',
    }),
    'https://app.pocket-mate.example',
  );
});
