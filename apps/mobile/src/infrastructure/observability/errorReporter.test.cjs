const assert = require('node:assert/strict');
const test = require('node:test');

const { buildErrorEvent, redactText } = require('./errorReporter.cjs');

test('redacts sensitive values before reporting errors', () => {
  const text = [
    'Email dalbir@example.com',
    'password=hunter2',
    'access_token=secret-token',
    'amount $4,600.00',
    'card 4242424242424242',
  ].join(' ');

  const redacted = redactText(text);

  assert.doesNotMatch(redacted, /dalbir@example\.com/);
  assert.doesNotMatch(redacted, /hunter2/);
  assert.doesNotMatch(redacted, /secret-token/);
  assert.doesNotMatch(redacted, /\$4,600\.00/);
  assert.doesNotMatch(redacted, /4242424242424242/);
});

test('builds privacy-safe error events', () => {
  const error = new Error('Failed for dalbir@example.com with $100.00');
  error.stack = 'Error: password=supabase-password';

  const event = buildErrorEvent(error, {
    area: 'auth',
    componentStack: 'User dalbir@example.com',
  });

  assert.equal(event.level, 'error');
  assert.equal(event.area, 'auth');
  assert.match(event.message, /\[redacted-email\]/);
  assert.match(event.message, /\[redacted-amount\]/);
  assert.match(event.stack, /\[redacted-secret\]/);
  assert.match(event.componentStack, /\[redacted-email\]/);
});
