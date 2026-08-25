import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aes from 'aes-js';
import * as SecureStore from 'expo-secure-store';

import {
  legacySecureStoreKeyName,
  secureStoreKeyName,
} from './authStorageKey.cjs';

const encryptedValuePrefix = 'pm-secure-v1:';

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function encrypt(storageKey, value) {
  const encryptionKey = randomBytes(32);
  const counterSeed = randomBytes(16);
  const cipher = new aes.ModeOfOperation.ctr(encryptionKey, new aes.Counter(counterSeed));
  const encryptedBytes = cipher.encrypt(aes.utils.utf8.toBytes(value));

  await SecureStore.setItemAsync(
    secureStoreKeyName(storageKey),
    aes.utils.hex.fromBytes(encryptionKey),
  );

  return [
    encryptedValuePrefix,
    aes.utils.hex.fromBytes(counterSeed),
    ':',
    aes.utils.hex.fromBytes(encryptedBytes),
  ].join('');
}

async function decrypt(storageKey, value) {
  if (!value?.startsWith(encryptedValuePrefix)) {
    return value;
  }

  const payload = value.slice(encryptedValuePrefix.length);
  const separatorIndex = payload.indexOf(':');

  if (separatorIndex <= 0) {
    return null;
  }

  const counterSeed = aes.utils.hex.toBytes(payload.slice(0, separatorIndex));
  const encryptedBytes = aes.utils.hex.toBytes(payload.slice(separatorIndex + 1));
  let encryptionKeyHex = await SecureStore.getItemAsync(
    secureStoreKeyName(storageKey),
  );

  if (!encryptionKeyHex) {
    try {
      const legacyKeyName = legacySecureStoreKeyName(storageKey);
      encryptionKeyHex = await SecureStore.getItemAsync(legacyKeyName);

      if (encryptionKeyHex) {
        await SecureStore.setItemAsync(
          secureStoreKeyName(storageKey),
          encryptionKeyHex,
        );
        await SecureStore.deleteItemAsync(legacyKeyName);
      }
    } catch {
      // New Android SecureStore versions reject the legacy key's colon.
    }
  }

  if (!encryptionKeyHex) {
    return null;
  }

  const cipher = new aes.ModeOfOperation.ctr(
    aes.utils.hex.toBytes(encryptionKeyHex),
    new aes.Counter(counterSeed),
  );
  const decryptedBytes = cipher.decrypt(encryptedBytes);

  return aes.utils.utf8.fromBytes(decryptedBytes);
}

export const supabaseAuthStorage = {
  async getItem(storageKey) {
    try {
      const storedValue = await AsyncStorage.getItem(storageKey);
      const value = await decrypt(storageKey, storedValue);

      if (storedValue && !storedValue.startsWith(encryptedValuePrefix)) {
        await this.setItem(storageKey, storedValue);
      }

      return value;
    } catch {
      try {
        await this.removeItem(storageKey);
      } catch {
        // Leave cleanup best-effort so a corrupt local session does not block sign-in.
      }
      return null;
    }
  },

  async setItem(storageKey, value) {
    const encryptedValue = await encrypt(storageKey, value);
    await AsyncStorage.setItem(storageKey, encryptedValue);
  },

  async removeItem(storageKey) {
    await AsyncStorage.removeItem(storageKey);

    try {
      await SecureStore.deleteItemAsync(secureStoreKeyName(storageKey));
    } catch {
      // Cleanup is best-effort; missing keychain values must not block sign-out.
    }

    try {
      await SecureStore.deleteItemAsync(legacySecureStoreKeyName(storageKey));
    } catch {
      // New Android SecureStore versions reject the legacy key's colon.
    }
  },
};
