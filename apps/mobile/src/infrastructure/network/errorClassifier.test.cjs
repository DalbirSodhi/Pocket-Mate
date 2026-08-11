const assert = require('node:assert/strict');
const test = require('node:test');

const {
  classifyAppError,
  getOfflineMutationMessage,
} = require('./errorClassifier.cjs');

test('classifies expired Supabase sessions as auth errors', () => {
  const result = classifyAppError({
    status: 401,
    message: 'JWT expired',
  });

  assert.equal(result.kind, 'auth');
  assert.equal(result.isAuthError, true);
  assert.match(result.userMessage, /session expired/i);
});

test('classifies fetch failures as network errors', () => {
  const result = classifyAppError(new Error('Network request failed'));

  assert.equal(result.kind, 'network');
  assert.equal(result.isNetworkError, true);
  assert.match(result.userMessage, /connection/i);
});

test('keeps unknown errors intact for screen-level fallback copy', () => {
  const result = classifyAppError(new Error('Could not find table'));

  assert.equal(result.kind, 'unknown');
  assert.equal(result.userMessage, 'Could not find table');
});

test('builds offline mutation copy for the attempted action', () => {
  assert.equal(
    getOfflineMutationMessage('mark this payment paid'),
    'You are offline. Reconnect before you mark this payment paid.',
  );
});
