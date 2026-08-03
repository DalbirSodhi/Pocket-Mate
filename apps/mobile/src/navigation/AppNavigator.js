import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Clock3, Home, PieChart, Settings2 } from 'lucide-react-native';
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
import {
  AddExpenseScreen,
  AddIncomeScreen,
  CardBillScreen,
  CategoriesScreen,
  CreditCardsScreen,
  ExpenseDetailScreen,
  FixedExpensesScreen,
  IncomeDetailScreen,
  OneTimeExpenseScreen,
  RecurringExpenseScreen,
  TransactionsScreen,
} from '../features/finance';
import { MonthlyInsightsScreen } from '../features/insights';
import { ProfileGate, SettingsScreen } from '../features/profile';
import { MonthlyReportScreen } from '../features/reports';
import {
  BillPaymentPlanScreen,
  BudgetCapsScreen,
  PlanOverviewScreen,
  PurchaseImpactScreen,
  SavingsGoalsScreen,
} from '../features/planning';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

const tabIcons = {
  HomeTab: Home,
  ActivityTab: Clock3,
  PlanTab: PieChart,
  SettingsTab: Settings2,
};

function TabIcon({ focused, routeName }) {
  const Icon = tabIcons[routeName];

  return (
    <View style={styles.tabIcon}>
      {focused ? <View style={styles.tabIndicator} /> : null}
      <Icon
        color={focused ? colors.ink : colors.inkMuted}
        size={21}
        strokeWidth={focused ? 2.4 : 2}
      />
    </View>
  );
}

function MainTabs({ profile, onProfileChange }) {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} routeName={route.name} />
        ),
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen name="HomeTab" options={{ title: 'Home' }}>
        {(screenProps) => (
          <DashboardScreen {...screenProps} profile={profile} />
        )}
      </Tab.Screen>
      <Tab.Screen name="ActivityTab" options={{ title: 'Activity' }}>
        {(screenProps) => (
          <TransactionsScreen
            {...screenProps}
            currencyCode={profile.currency_code || 'CAD'}
            isTabRoot
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="PlanTab" options={{ title: 'Plan' }}>
        {(screenProps) => (
          <PlanOverviewScreen {...screenProps} profile={profile} />
        )}
      </Tab.Screen>
      <Tab.Screen name="SettingsTab" options={{ title: 'Settings' }}>
        {(screenProps) => (
          <SettingsScreen
            {...screenProps}
            isTabRoot
            onProfileChange={onProfileChange}
            profile={profile}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MainNavigator({ profile, onProfileChange }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => (
          <MainTabs
            onProfileChange={onProfileChange}
            profile={profile}
          />
        )}
      </Stack.Screen>
      <Stack.Screen component={AddExpenseScreen} name="AddExpense" />
      <Stack.Screen component={AddIncomeScreen} name="AddIncome" />
      <Stack.Screen component={OneTimeExpenseScreen} name="OneTimeExpense" />
      <Stack.Screen component={RecurringExpenseScreen} name="RecurringExpense" />
      <Stack.Screen component={CardBillScreen} name="CardBill" />
      <Stack.Screen component={CategoriesScreen} name="Categories" />
      <Stack.Screen component={FixedExpensesScreen} name="FixedExpenses" />
      <Stack.Screen component={CreditCardsScreen} name="CreditCards" />
      <Stack.Screen component={ExpenseDetailScreen} name="ExpenseDetail" />
      <Stack.Screen component={IncomeDetailScreen} name="IncomeDetail" />
      <Stack.Screen component={MonthlyInsightsScreen} name="MonthlyInsights" />
      <Stack.Screen component={MonthlyReportScreen} name="MonthlyReport" />
      <Stack.Screen component={BillPaymentPlanScreen} name="BillPaymentPlan" />
      <Stack.Screen component={SavingsGoalsScreen} name="SavingsGoals" />
      <Stack.Screen component={BudgetCapsScreen} name="BudgetCaps" />
      <Stack.Screen component={PurchaseImpactScreen} name="PurchaseImpact" />
      <Stack.Screen component={TransactionsScreen} name="Transactions" />
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
        <ProfileGate>
          {(profile, onProfileChange) => (
            <MainNavigator
              onProfileChange={onProfileChange}
              profile={profile}
            />
          )}
        </ProfileGate>
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
  tabBar: {
    height: 72,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  tabIcon: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    top: -10,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
