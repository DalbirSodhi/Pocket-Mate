import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const initialSnapshot = {
  isOnline: true,
  isOffline: false,
  isConnectionUnknown: true,
  connectionType: 'unknown',
};

const NetworkContext = createContext(initialSnapshot);

function createSnapshot(state) {
  const isDisconnected =
    state?.isConnected === false || state?.isInternetReachable === false;
  const isConnectionUnknown =
    state?.isConnected == null && state?.isInternetReachable == null;

  return {
    isOnline: !isDisconnected,
    isOffline: isDisconnected,
    isConnectionUnknown,
    connectionType: state?.type || 'unknown',
  };
}

export function NetworkProvider({ children }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let isActive = true;

    NetInfo.fetch()
      .then((state) => {
        if (isActive) {
          setSnapshot(createSnapshot(state));
        }
      })
      .catch(() => {
        if (isActive) {
          setSnapshot((current) => ({
            ...current,
            isConnectionUnknown: true,
          }));
        }
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setSnapshot(createSnapshot(state));
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => snapshot, [snapshot]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
