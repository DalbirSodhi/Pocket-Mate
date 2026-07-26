import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';

import {
  createSessionFromUrl,
  getCurrentSession,
  subscribeToAuthChanges,
} from '../services/authService';

export const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;
    let receivedAuthEvent = false;

    const unsubscribe = subscribeToAuthChanges(({ event, session: nextSession }) => {
      receivedAuthEvent = true;

      if (!isActive) {
        return;
      }

      setSession(nextSession);
      setIsPasswordRecovery(event === 'PASSWORD_RECOVERY');
      setError(null);
      setIsLoading(false);
    });

    getCurrentSession()
      .then((currentSession) => {
        if (!isActive || receivedAuthEvent) {
          return;
        }

        setSession(currentSession);
        setIsLoading(false);
      })
      .catch((sessionError) => {
        if (!isActive || receivedAuthEvent) {
          return;
        }

        setError(sessionError);
        setIsLoading(false);
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [retryCount]);

  useEffect(() => {
    let isActive = true;

    async function handleUrl(url) {
      if (!url) {
        return;
      }

      try {
        const result = await createSessionFromUrl(url);

        if (isActive && result.isPasswordRecovery) {
          setIsPasswordRecovery(true);
          setError(null);
        }
      } catch (callbackError) {
        if (isActive) {
          setError(callbackError);
        }
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  const finishPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const retryInitialization = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRetryCount((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.user),
      isPasswordRecovery,
      finishPasswordRecovery,
      retryInitialization,
      isLoading,
      error,
    }),
    [
      error,
      finishPasswordRecovery,
      isLoading,
      isPasswordRecovery,
      retryInitialization,
      session,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
