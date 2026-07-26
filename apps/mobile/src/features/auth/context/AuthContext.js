import { createContext, useEffect, useMemo, useState } from 'react';

import { getCurrentSession, subscribeToAuthChanges } from '../services/authService';

export const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;
    let receivedAuthEvent = false;

    const unsubscribe = subscribeToAuthChanges(({ session: nextSession }) => {
      receivedAuthEvent = true;

      if (!isActive) {
        return;
      }

      setSession(nextSession);
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
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      error,
    }),
    [error, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
