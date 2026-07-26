import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

export function useAuthSession() {
  const auth = useContext(AuthContext);

  if (auth === undefined) {
    throw new Error('useAuthSession must be used inside AuthProvider.');
  }

  return auth;
}
