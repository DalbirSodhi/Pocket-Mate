import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { BrandMark } from '../components/BrandMark';
import { InlineNotice } from '../components/InlineNotice';
import { LoadingScreen } from '../components/LoadingScreen';
import { colors, spacing, typography } from '../theme/tokens';
import {
  ForgotPasswordScreen,
  ResetPasswordScreen,
  SignInScreen,
  SignUpScreen,
  WelcomeScreen,
} from '../features/auth/screens';
import { useAuthSession } from '../features/auth';
import { DashboardScreen } from '../features/dashboard';
import { ProfileGate } from '../features/profile';

const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.canvas,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    notification: colors.accent,
  },
};

function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen component={WelcomeScreen} name="Welcome" />
      <Stack.Screen component={SignInScreen} name="SignIn" />
      <Stack.Screen component={SignUpScreen} name="SignUp" />
      <Stack.Screen component={ForgotPasswordScreen} name="ForgotPassword" />
    </Stack.Navigator>
  );
}

function RecoveryNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={ResetPasswordScreen} name="ResetPassword" />
    </Stack.Navigator>
  );
}

function MainScreen() {
  return (
    <ProfileGate>
      {(profile) => <DashboardScreen profile={profile} />}
    </ProfileGate>
  );
}

function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={MainScreen} name="Dashboard" />
    </Stack.Navigator>
  );
}

function ConnectionErrorScreen({ message, onRetry }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.errorContent}>
        <BrandMark />
        <View style={styles.errorHeading}>
          <Text style={styles.errorTitle}>Unable to start Pocket-Mate</Text>
          <InlineNotice message={message} variant="error" />
        </View>
        <AppButton label="Try again" onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

export function AppNavigator() {
  const {
    error,
    isAuthenticated,
    isLoading,
    isPasswordRecovery,
    retryInitialization,
  } = useAuthSession();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error && !isAuthenticated) {
    return (
      <ConnectionErrorScreen
        message={error.message || 'Check your connection and try again.'}
        onRetry={retryInitialization}
      />
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isPasswordRecovery ? (
        <RecoveryNavigator />
      ) : isAuthenticated ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  errorContent: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  errorHeading: {
    gap: spacing.lg,
  },
  errorTitle: {
    ...typography.title,
    color: colors.ink,
  },
});
