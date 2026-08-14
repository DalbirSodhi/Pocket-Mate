import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Circle,
  CircleCheck,
  CreditCard,
  Gauge,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '../../../components/BrandMark';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { RetryNotice } from '../../../components/RetryNotice';
import { classifyAppError } from '../../../infrastructure/network/errorClassifier.cjs';
import { useNetworkStatus } from '../../../infrastructure/network';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import {
  formatCachedAt,
  loadCachedDashboardSummary,
  saveCachedDashboardSummary,
} from '../services/dashboardCache';
import { getDashboardSummary } from '../services/dashboardService';
import { formatCurrency } from '../utils/formatCurrency';

function formatShortDate(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatDashboardDate() {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

function EmptyBills() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <CalendarClock color={colors.inkMuted} size={21} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>No bills added yet</Text>
        <Text style={styles.emptyBody}>
          Add fixed expenses or a statement for a saved card.
        </Text>
      </View>
    </View>
  );
}

export function DashboardScreen({ navigation, profile }) {
  const { expireSession, user } = useAuthSession();
  const { isOffline } = useNetworkStatus();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [cachedAt, setCachedAt] = useState('');
  const [isUsingCachedSummary, setIsUsingCachedSummary] = useState(false);

  const loadCachedSummary = useCallback(async () => {
    const cached = await loadCachedDashboardSummary(user.id);

    if (!cached) {
      return false;
    }

    setSummary(cached.summary);
    setCachedAt(cached.cachedAt);
    setIsUsingCachedSummary(true);
    return true;
  }, [user.id]);

  const loadDashboard = useCallback(async () => {
    if (isOffline) {
      const hasCachedSummary = await loadCachedSummary();

      if (!hasCachedSummary) {
        throw new Error('You are offline and no saved dashboard is available yet.');
      }

      setError('');
      return;
    }

    try {
      const nextSummary = await getDashboardSummary(user.id, profile);
      await saveCachedDashboardSummary(user.id, nextSummary);
      setSummary(nextSummary);
      setCachedAt('');
      setIsUsingCachedSummary(false);
      setError('');
    } catch (dashboardError) {
      const appError = classifyAppError(dashboardError);
      const hasCachedSummary = await loadCachedSummary();

      if (appError.isAuthError) {
        expireSession();
      }

      if (hasCachedSummary && appError.isNetworkError) {
        setError('');
        return;
      }

      throw dashboardError;
    }
  }, [expireSession, isOffline, loadCachedSummary, profile, user.id]);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadDashboard();
    } catch (dashboardError) {
      setError(
        classifyAppError(dashboardError).userMessage ||
          'Unable to load your dashboard.',
      );
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      loadDashboard()
        .then(() => {
          if (isActive) {
            setError('');
          }
        })
        .catch((dashboardError) => {
          if (isActive) {
            setError(
              classifyAppError(dashboardError).userMessage ||
                'Unable to load your dashboard.',
            );
          }
        })
        .finally(() => {
          if (isActive) {
            setIsInitialLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }, [loadDashboard]),
  );

  const currencyCode = profile.currency_code || 'CAD';
  const monthlyBalanceCents = summary?.monthlyBalanceCents || 0;
  const spendableCents = summary?.spendableCents || 0;
  const cashAvailableCents = summary?.cashAvailableCents || 0;
  const hasSpendableCashAccounts = summary?.hasSpendableCashAccounts === true;
  const safeToSpendCents = summary?.safeToSpendCents || 0;
  const incomeCents = summary?.incomeCents || 0;
  const expenseCents = summary?.expenseCents || 0;
  const totalOutflowCents = summary?.totalOutflowCents || 0;
  const daysUntilReset = summary?.daysUntilReset || 1;
  const daysUntilNextPayday = summary?.daysUntilNextPayday || daysUntilReset;
  const preferences = summary?.preferences || {};
  const isCompact = preferences.dashboard_density === 'compact';
  const highContrast = preferences.high_contrast === true;
  const money = (amountCents) =>
    preferences.hide_amounts
      ? '••••'
      : formatCurrency(amountCents, currencyCode);
  const spendingProgress =
    incomeCents > 0 ? Math.min(totalOutflowCents / incomeCents, 1) : 0;
  const planHealth = summary?.planHealth || {
    label: 'Add income',
    tone: 'neutral',
    allocationPercent: 0,
    detail: 'Add income to calculate your current plan.',
  };
  const planTone =
    planHealth.tone === 'success'
      ? { background: colors.successSoft, foreground: colors.success }
      : planHealth.tone === 'danger'
        ? { background: colors.dangerSoft, foreground: colors.danger }
        : planHealth.tone === 'warning'
          ? { background: colors.warningSoft, foreground: colors.warning }
          : { background: colors.infoSoft, foreground: colors.info };
  const setupSteps = [
    {
      id: 'income',
      label: 'Record this month’s income',
      detail: 'Start the monthly plan with money received.',
      isComplete: incomeCents > 0,
      onPress: () => navigation.navigate('AddIncome', { currencyCode }),
    },
    {
      id: 'accounts',
      label: 'Add checking or cash',
      detail: 'Compare the plan with money actually available.',
      isComplete: hasSpendableCashAccounts,
      onPress: () => navigation.navigate('Accounts', { currencyCode }),
    },
    {
      id: 'budget',
      label: 'Set a category limit',
      detail: 'Get warnings before flexible spending runs high.',
      isComplete: (summary?.activeBudgetCaps || 0) > 0,
      onPress: () => navigation.navigate('BudgetCaps', { currencyCode }),
    },
    {
      id: 'savings',
      label: 'Create a savings goal',
      detail: 'Protect savings before daily spending.',
      isComplete: (summary?.activeSavingsGoals || 0) > 0,
      onPress: () => navigation.navigate('SavingsGoals', { currencyCode }),
    },
  ];
  const incompleteSetupSteps = setupSteps.filter((step) => !step.isComplete);

  if (isInitialLoading && !summary) {
    return <LoadingScreen message="Loading your monthly plan..." />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refreshDashboard}
            refreshing={isRefreshing}
            tintColor={colors.white}
          />
        }
        style={styles.scroll}
      >
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <View style={styles.header}>
              <BrandMark compact inverse />
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => navigation.navigate('SettingsTab')}
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && styles.heroButtonPressed,
                ]}
              >
                <Settings2 color={colors.white} size={20} />
              </Pressable>
            </View>

            <View style={styles.heroCopy}>
              <Text style={[styles.dateLabel, highContrast && styles.panelTextHigh]}>
                {formatDashboardDate()}
              </Text>
              <Text style={styles.balanceLabel}>Safe to spend today</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.balanceValue}
              >
                {money(safeToSpendCents)}
              </Text>
              <View style={styles.balanceMeta}>
                <Text style={[styles.availableText, highContrast && styles.panelTextHigh]}>
                  {money(monthlyBalanceCents)} earned minus spent this month
                </Text>
                <View style={styles.metaDot} />
                <Text style={[styles.remainingText, highContrast && styles.panelTextHigh]}>
                  {daysUntilNextPayday}{' '}
                  {daysUntilNextPayday === 1 ? 'day' : 'days'} to payday
                </Text>
              </View>
            </View>

            <View style={styles.forecast}>
              <View style={styles.forecastHeading}>
                <Text style={[styles.forecastLabel, highContrast && styles.panelTextHigh]}>
                  Monthly forecast
                </Text>
                <Text style={styles.forecastValue}>
                  {Math.round(spendingProgress * 100)}% planned
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(spendingProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.resetDate, highContrast && styles.panelTextHigh]}>
                {money(spendableCents)} after commitments · Resets{' '}
                {formatShortDate(summary?.nextMonthStartDate)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.bodyContent}>
            <RetryNotice
              isRetrying={isRefreshing}
              message={error}
              onRetry={refreshDashboard}
            />
            <InlineNotice
              message={
                isUsingCachedSummary
                  ? `Showing saved dashboard from ${formatCachedAt(cachedAt)}. Reconnect to update totals.`
                  : ''
              }
              variant={isOffline ? 'warning' : 'info'}
            />

            {incompleteSetupSteps.length > 0 ? (
              <View style={styles.setupSection}>
                <View style={styles.setupHeading}>
                  <View>
                    <Text style={styles.setupTitle}>Finish your money setup</Text>
                    <Text style={styles.setupSubtitle}>
                      {setupSteps.length - incompleteSetupSteps.length} of{' '}
                      {setupSteps.length} essentials complete
                    </Text>
                  </View>
                  <Text style={styles.setupCount}>{incompleteSetupSteps.length} left</Text>
                </View>
                <View style={styles.setupList}>
                  {setupSteps.map((step, index) => {
                    const StepIcon = step.isComplete ? CircleCheck : Circle;

                    return (
                      <View key={step.id}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={step.isComplete}
                          onPress={step.onPress}
                          style={({ pressed }) => [
                            styles.setupRow,
                            pressed && styles.setupRowPressed,
                          ]}
                        >
                          <StepIcon
                            color={step.isComplete ? colors.success : colors.primary}
                            size={20}
                          />
                          <View style={styles.setupCopy}>
                            <Text
                              style={[
                                styles.setupLabel,
                                step.isComplete && styles.setupLabelComplete,
                              ]}
                            >
                              {step.label}
                            </Text>
                            <Text style={styles.setupDetail}>{step.detail}</Text>
                          </View>
                          {!step.isComplete ? (
                            <ChevronRight color={colors.inkMuted} size={17} />
                          ) : null}
                        </Pressable>
                        {index < setupSteps.length - 1 ? (
                          <View style={styles.setupDivider} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.summary}>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('AddIncome')}
                style={({ pressed }) => [
                  styles.summaryItem,
                  pressed && styles.summaryPressed,
                ]}
              >
                <View style={styles.summaryLabelRow}>
                  <ArrowDownLeft color={colors.success} size={17} />
                  <Text style={styles.summaryLabel}>Income</Text>
                </View>
                <Text style={styles.summaryValue}>
                  {money(incomeCents)}
                </Text>
              </Pressable>
              <View style={styles.summaryDivider} />
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('MonthlyInsights', {
                    currencyCode,
                    monthKey: summary?.monthStartDate?.slice(0, 7),
                  })
                }
                style={({ pressed }) => [
                  styles.summaryItem,
                  pressed && styles.summaryPressed,
                ]}
              >
                <View style={styles.summaryLabelRow}>
                  <ArrowUpRight color={colors.danger} size={17} />
                  <Text style={styles.summaryLabel}>Spent</Text>
                </View>
                <Text style={styles.summaryValue}>
                  {money(expenseCents)}
                </Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Accounts', { currencyCode })}
              style={({ pressed }) => [
                styles.cashRow,
                pressed && styles.cashRowPressed,
              ]}
            >
              <View style={styles.cashIcon}>
                <Landmark color={colors.iconInk} size={20} />
              </View>
              <View style={styles.cashCopy}>
                <Text style={styles.cashTitle}>Cash available now</Text>
                <Text style={styles.cashDetail}>
                  {hasSpendableCashAccounts
                    ? 'Checking and cash balances; protected savings stay excluded.'
                    : 'Add a checking or cash account to compare your plan with real cash.'}
                </Text>
              </View>
              <Text style={styles.cashValue}>
                {hasSpendableCashAccounts ? money(cashAvailableCents) : 'Set up'}
              </Text>
              <ChevronRight color={colors.inkMuted} size={17} />
            </Pressable>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Spending breakdown</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    navigation.navigate('MonthlyInsights', {
                      currencyCode,
                      monthKey: summary?.monthStartDate?.slice(0, 7),
                    })
                  }
                  style={styles.sectionLink}
                >
                  <Text style={styles.sectionLinkText}>View all</Text>
                  <ChevronRight color={colors.inkMuted} size={16} />
                </Pressable>
              </View>

              {summary?.categoryInsights?.length ? (
                <View style={styles.breakdownList}>
                  {summary.categoryInsights.slice(0, isCompact ? 2 : 3).map((row) => (
                    <Pressable
                      accessibilityRole="button"
                      key={row.categoryId}
                      onPress={() =>
                        navigation.navigate('Transactions', {
                          currencyCode,
                          initialMonthKey: summary.monthStartDate.slice(0, 7),
                          initialCategoryId:
                            row.categoryId === 'bill-payments'
                              ? 'all'
                              : row.categoryId,
                          initialType:
                            row.categoryId === 'bill-payments'
                              ? 'bill_payment'
                              : 'expense',
                        })
                      }
                      style={({ pressed }) => [
                        styles.breakdownRow,
                        pressed && styles.breakdownRowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.breakdownSwatch,
                          { backgroundColor: row.color },
                        ]}
                      />
                      <View style={styles.breakdownCopy}>
                        <View style={styles.breakdownHeading}>
                          <Text numberOfLines={1} style={styles.breakdownName}>
                            {row.name}
                          </Text>
                          <Text style={styles.breakdownAmount}>
                            {money(row.amountCents)}
                          </Text>
                        </View>
                        <View style={styles.breakdownTrack}>
                          <View
                            style={[
                              styles.breakdownFill,
                              {
                                backgroundColor: row.color,
                                width: `${Math.max(row.sharePercent, 2)}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.breakdownShare}>
                        {row.sharePercent}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.breakdownEmpty}>
                  Add an expense to see where your money goes.
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Current plan</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('PlanTab')}
                  style={styles.sectionLink}
                >
                  <Text style={styles.sectionLinkText}>Details</Text>
                  <ChevronRight color={colors.inkMuted} size={16} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('PlanTab')}
                style={[
                  styles.planStatus,
                  { backgroundColor: planTone.background },
                ]}
              >
                <View style={styles.planStatusHeading}>
                  <Text
                    style={[
                      styles.planStatusLabel,
                      { color: planTone.foreground },
                    ]}
                  >
                    {planHealth.label}
                  </Text>
                  <Text
                    style={[
                      styles.planStatusPercent,
                      { color: planTone.foreground },
                    ]}
                  >
                    {planHealth.allocationPercent}% allocated
                  </Text>
                </View>
                <Text style={styles.planStatusDetail}>{planHealth.detail}</Text>
                <View style={styles.planTrack}>
                  <View
                    style={[
                      styles.planFill,
                      {
                        backgroundColor: planTone.foreground,
                        width: `${Math.min(planHealth.allocationPercent, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
              <View style={styles.planSignals}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('SavingsGoals', { currencyCode })}
                  style={({ pressed }) => [
                    styles.planSignal,
                    pressed && styles.planSignalPressed,
                  ]}
                >
                  <PiggyBank color={colors.primary} size={18} />
                  <View style={styles.planSignalCopy}>
                    <Text style={styles.planSignalLabel}>Savings protected</Text>
                    <Text style={styles.planSignalValue}>
                      {money(summary?.monthlySavingsCents || 0)} this month
                    </Text>
                  </View>
                  <ChevronRight color={colors.inkMuted} size={16} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('BudgetCaps', { currencyCode })}
                  style={({ pressed }) => [
                    styles.planSignal,
                    pressed && styles.planSignalPressed,
                  ]}
                >
                  <Gauge
                    color={summary?.overBudgetCaps > 0 ? colors.warning : colors.primary}
                    size={18}
                  />
                  <View style={styles.planSignalCopy}>
                    <Text style={styles.planSignalLabel}>Category limits</Text>
                    <Text style={styles.planSignalValue}>
                      {summary?.overBudgetCaps > 0
                        ? `${summary.overBudgetCaps} over limit`
                        : `${summary?.activeBudgetCaps || 0} active`}
                    </Text>
                  </View>
                  <ChevronRight color={colors.inkMuted} size={16} />
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Upcoming bills</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('PlanTab')}
                  style={styles.sectionLink}
                >
                  <Text style={styles.sectionLinkText}>Manage</Text>
                  <ChevronRight color={colors.inkMuted} size={16} />
                </Pressable>
              </View>

              {summary?.upcomingBills?.length ? (
                <View style={styles.billList}>
                  {summary.upcomingBills.slice(0, isCompact ? 2 : 4).map((bill, index, visibleBills) => {
                    const isCard = bill.type === 'card';
                    const isCardSetup = bill.type === 'card_setup';
                    const Icon = isCard || isCardSetup ? CreditCard : ReceiptText;
                    const dueLabel = bill.paymentPlan
                      ? bill.paymentPlan.status === 'completed'
                        ? 'Payment plan complete'
                        : `${bill.paymentPlan.paidCount}/${bill.paymentPlan.installmentCount} paid • Next ${formatShortDate(bill.paymentPlan.nextPaymentOn)}`
                      : isCardSetup
                        ? 'No statement added'
                        : bill.isOverdue
                          ? `Overdue ${formatShortDate(bill.dueOn)}`
                          : `Due ${formatShortDate(bill.dueOn)}`;
                    const amountLabel = isCardSetup
                      ? 'Add bill'
                      : money(bill.amountCents);
                    const handlePress = () => {
                      if (isCardSetup) {
                        navigation.navigate('CardBill', {
                          creditCardId: bill.creditCardId,
                          currencyCode,
                        });
                      } else {
                        navigation.navigate('BillPaymentPlan', {
                          creditCardBillId: bill.creditCardBillId,
                          recurringExpenseId: bill.recurringExpenseId,
                          periodStart:
                            bill.periodStart ||
                            `${bill.dueOn.slice(0, 7)}-01`,
                          title: bill.title,
                          amountCents: bill.amountCents,
                          dueOn: bill.dueOn,
                          currencyCode,
                        });
                      }
                    };

                    return (
                      <View key={bill.id}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={handlePress}
                          style={({ pressed }) => [
                            styles.billRow,
                            pressed && styles.billRowPressed,
                          ]}
                        >
                          <View style={styles.billIcon}>
                            <Icon color={colors.ink} size={19} />
                          </View>
                          <View style={styles.billCopy}>
                            <Text numberOfLines={1} style={styles.billTitle}>
                              {bill.title}
                            </Text>
                            <Text style={styles.billDue}>
                              {dueLabel}
                            </Text>
                          </View>
                          <Text style={styles.billAmount}>
                            {amountLabel}
                          </Text>
                          <ChevronRight color={colors.inkMuted} size={16} />
                        </Pressable>
                        {index < visibleBills.length - 1 ? (
                          <View style={styles.billDivider} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <EmptyBills />
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('AddExpense', { currencyCode })
              }
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <Plus color={colors.white} size={20} strokeWidth={2.4} />
              <Text style={styles.addButtonLabel}>Add expense</Text>
            </Pressable>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.darkPanel,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  hero: {
    backgroundColor: colors.darkPanel,
  },
  heroContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonPressed: {
    backgroundColor: colors.panelTrack,
  },
  heroCopy: {
    gap: spacing.xs,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  panelTextHigh: {
    color: colors.white,
  },
  balanceLabel: {
    ...typography.label,
    color: colors.white,
    marginTop: spacing.sm,
  },
  balanceValue: {
    color: colors.white,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    maxWidth: 330,
  },
  balanceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  availableText: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: radius.round,
    backgroundColor: colors.panelMuted,
  },
  remainingText: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  forecast: {
    gap: spacing.sm,
  },
  forecastHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastLabel: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  forecastValue: {
    ...typography.caption,
    color: colors.white,
  },
  progressTrack: {
    height: 5,
    borderRadius: radius.round,
    backgroundColor: colors.panelTrack,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  resetDate: {
    ...typography.caption,
    color: colors.panelMuted,
    textAlign: 'right',
  },
  body: {
    backgroundColor: colors.canvas,
  },
  bodyContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  setupSection: {
    gap: spacing.md,
  },
  setupHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  setupTitle: {
    ...typography.section,
    color: colors.ink,
  },
  setupSubtitle: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  setupCount: {
    ...typography.caption,
    color: colors.primary,
  },
  setupList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  setupRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  setupRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  setupCopy: {
    flex: 1,
    minWidth: 0,
  },
  setupLabel: {
    ...typography.label,
    color: colors.ink,
  },
  setupLabelComplete: {
    color: colors.inkMuted,
    textDecorationLine: 'line-through',
  },
  setupDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  setupDivider: {
    height: 1,
    marginLeft: 32,
    backgroundColor: colors.border,
  },
  summary: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  summaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  summaryValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  cashRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cashRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cashIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashCopy: {
    flex: 1,
    minWidth: 0,
  },
  cashTitle: {
    ...typography.label,
    color: colors.ink,
  },
  cashDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  cashValue: {
    ...typography.label,
    color: colors.ink,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  sectionLink: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionLinkText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  breakdownList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  breakdownRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  breakdownRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  breakdownSwatch: {
    width: 10,
    height: 36,
    borderRadius: radius.sm,
  },
  breakdownCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  breakdownHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  breakdownName: {
    ...typography.label,
    color: colors.ink,
    flex: 1,
  },
  breakdownAmount: {
    ...typography.caption,
    color: colors.ink,
  },
  breakdownTrack: {
    height: 4,
    borderRadius: radius.round,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  breakdownShare: {
    ...typography.caption,
    color: colors.inkMuted,
    width: 36,
    textAlign: 'right',
  },
  breakdownEmpty: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  planStatus: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  planStatusHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planStatusLabel: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  planStatusPercent: {
    ...typography.caption,
  },
  planStatusDetail: {
    ...typography.caption,
    color: colors.ink,
  },
  planTrack: {
    height: 4,
    borderRadius: radius.round,
    backgroundColor: 'rgba(16, 28, 44, 0.12)',
    overflow: 'hidden',
  },
  planFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  planSignals: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  planSignal: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planSignalPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  planSignalCopy: {
    flex: 1,
    minWidth: 0,
  },
  planSignalLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  planSignalValue: {
    ...typography.label,
    color: colors.ink,
  },
  billList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  billRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  billRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  billIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billCopy: {
    flex: 1,
    minWidth: 0,
  },
  billTitle: {
    ...typography.label,
    color: colors.ink,
  },
  billDue: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  billAmount: {
    ...typography.label,
    color: colors.ink,
  },
  billDivider: {
    height: 1,
    marginLeft: 50,
    backgroundColor: colors.border,
  },
  emptyState: {
    minHeight: 76,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    ...typography.label,
    color: colors.ink,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  addButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  addButtonLabel: {
    ...typography.label,
    color: colors.white,
    fontSize: 16,
  },
});
