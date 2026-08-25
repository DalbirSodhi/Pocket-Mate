const secureStoreKeyPrefix = 'pm.supabase.auth.key.';
const legacySecureStoreKeyPrefix = 'pm.supabase.auth.key:';

function encodeKeyPart(value) {
  return Array.from(String(value), (character) =>
    character.codePointAt(0).toString(16),
  ).join('.');
}

function secureStoreKeyName(storageKey) {
  return `${secureStoreKeyPrefix}${encodeKeyPart(storageKey)}`;
}

function legacySecureStoreKeyName(storageKey) {
  return `${legacySecureStoreKeyPrefix}${storageKey}`;
}

module.exports = {
  legacySecureStoreKeyName,
  secureStoreKeyName,
};
