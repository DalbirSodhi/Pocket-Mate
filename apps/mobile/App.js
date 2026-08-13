import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/features/auth';
import { CrashBoundary } from './src/components/CrashBoundary';
import { NetworkProvider } from './src/infrastructure/network';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <CrashBoundary>
      <SafeAreaProvider>
        <NetworkProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <AppNavigator />
          </AuthProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </CrashBoundary>
  );
}
