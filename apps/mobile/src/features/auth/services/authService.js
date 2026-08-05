import { Platform } from 'react-native';

import { supabase } from '../../../infrastructure/supabase/client';

const MIN_PASSWORD_LENGTH = 8;
const NATIVE_PASSWORD_RESET_REDIRECT_URL = 'pocketmate://reset-password';

function getPasswordResetRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return NATIVE_PASSWORD_RESET_REDIRECT_URL;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeDisplayName(displayName) {
  const value = String(displayName || '').trim();
  return value.length > 0 ? value : null;
}

function assertValidEmail(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
}

function assertValidPassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function unwrapAuthResponse(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data;
}

export async function signUpWithEmail({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);

  assertValidEmail(normalizedEmail);
  assertValidPassword(password);

  const response = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        display_name: normalizeDisplayName(displayName),
      },
    },
  });

  return unwrapAuthResponse(response);
}

export async function signInWithEmail({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  assertValidEmail(normalizedEmail);
  assertValidPassword(password);

  const response = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  return unwrapAuthResponse(response);
}

export async function signOut() {
  const response = await supabase.auth.signOut();

  if (response.error) {
    throw response.error;
  }
}

export async function deleteOwnAccount() {
  const response = await supabase.rpc('delete_own_account');

  if (response.error) {
    throw response.error;
  }

  const signOutResponse = await supabase.auth.signOut({ scope: 'local' });

  if (signOutResponse.error) {
    throw signOutResponse.error;
  }
}

export async function requestPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);

  assertValidEmail(normalizedEmail);

  const response = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  return unwrapAuthResponse(response);
}

export async function updatePassword(password) {
  assertValidPassword(password);

  const response = await supabase.auth.updateUser({ password });
  return unwrapAuthResponse(response).user;
}

function getAuthCallbackParams(url) {
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  return new URLSearchParams([query, fragment].filter(Boolean).join('&'));
}

export async function createSessionFromUrl(url) {
  const params = getAuthCallbackParams(url);
  const errorDescription = params.get('error_description');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = params.get('code');
  let session = null;

  if (code) {
    const response = await supabase.auth.exchangeCodeForSession(code);
    session = unwrapAuthResponse(response).session;
  } else {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      const response = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      session = unwrapAuthResponse(response).session;
    }
  }

  return {
    session,
    isPasswordRecovery:
      params.get('type') === 'recovery' || url.includes('reset-password'),
  };
}

export async function getCurrentSession() {
  const response = await supabase.auth.getSession();
  return unwrapAuthResponse(response).session;
}

export async function getCurrentUser() {
  const response = await supabase.auth.getUser();
  return unwrapAuthResponse(response).user;
}

export function subscribeToAuthChanges(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback({ event, session, user: session?.user || null });
  });

  return () => data.subscription.unsubscribe();
}
