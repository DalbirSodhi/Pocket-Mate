import { supabase } from '../../../infrastructure/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

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
