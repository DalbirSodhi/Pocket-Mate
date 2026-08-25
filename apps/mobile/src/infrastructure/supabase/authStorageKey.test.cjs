const assert = require('node:assert/strict');
const test = require('node:test');

const {
  legacySecureStoreKeyName,
  secureStoreKeyName,
} = require('./authStorageKey.cjs');

test('creates deterministic SecureStore-compatible key names', () => {
  const storageKey = 'sb-project-ref-auth-token';
  const keyName = secureStoreKeyName(storageKey);

  assert.equal(keyName, secureStoreKeyName(storageKey));
  assert.match(keyName, /^[A-Za-z0-9._-]+$/);
  assert.equal(keyName.includes(':'), false);
});

test('encodes unsafe and unicode characters without collisions', () => {
  const colonKey = secureStoreKeyName('session:key');
  const literalKey = secureStoreKeyName('session_3a_key');
  const unicodeKey = secureStoreKeyName('session-\u2605');

  assert.notEqual(colonKey, literalKey);
  assert.match(unicodeKey, /^[A-Za-z0-9._-]+$/);
});

test('retains the legacy key name only for best-effort migration', () => {
  assert.equal(
    legacySecureStoreKeyName('sb-project-ref-auth-token'),
    'pm.supabase.auth.key:sb-project-ref-auth-token',
  );
});
