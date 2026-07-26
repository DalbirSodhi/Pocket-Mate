import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  LogOut,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Target,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { signOut, useAuthSession } from '../../auth';
import { getDashboardSummary } from '../services/dashboardService';
import { formatCurrency } from '../utils/formatCurrency';

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: tone.background }]}>
        <Icon color={tone.foreground} size={20} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function EmptyActivity() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <ReceiptText color={colors.inkMuted} size={24} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>No expenses yet</Text>
        <Text style={styles.emptyBody}>Your latest activity will appear here.</Text>
      </View>
    </View>
  );
}

export function DashboardScreen({ profile }) {
  const { user } = useAuthSession();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      const nextSummary = await getDashboardSummary(user.id);
      setSummary(nextSummary);
    } catch (dashboardError) {
      setError(dashboardError.message || 'Unable to load your dashboard.');
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    let isActive = true;

    getDashboardSummary(user.id)
      .then((nextSummary) => {
        if (isActive) {
          setSummary(nextSummary);
        }
      })
      .catch((dashboardError) => {
        if (isActive) {
          setError(dashboardError.message || 'Unable to load your dashboard.');
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
  }, [user.id]);

  const firstName = useMemo(() => {
    const displayName = profile.display_name || user.email || 'there';
    return displayName.split(' ')[0];
  }, [profile.display_name, user.email]);

  const currencyCode = profile.currency_code || 'CAD';
  const availableCents = summary?.availableCents || 0;
  const incomeCents = summary?.incomeCents || 0;
  const expenseCents = summary?.expenseCents || 0;
  const savingsCurrentCents = summary?.savingsCurrentCents || 0;
  const spendingProgress =
    incomeCents > 0 ? Math.min(expenseCents / incomeCents, 1) : 0;

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refreshDashboard}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <BrandMark compact />
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Refresh dashboard"
                accessibilityRole="button"
                hitSlop={8}
                onPress={refreshDashboard}
                style={styles.iconButton}
              >
                <RefreshCw color={colors.ink} size={20} />
              </Pressable>
              <Pressable
                accessibilityLabel="Sign out"
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleSignOut}
                style={styles.iconButton}
              >
                <LogOut color={colors.ink} size={20} />
              </Pressable>
            </View>
          </View>

          <View style={styles.greeting}>
            <Text style={styles.eyebrow}>{summary?.periodLabel || 'This month'}</Text>
            <Text style={styles.title}>Good to see you, {firstName}.</Text>
          </View>

          <InlineNotice message={error} variant="error" />

          <View style={styles.balancePanel}>
            <View style={styles.balanceHeading}>
              <View>
                <Text style={styles.balanceLabel}>Available this month</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.balanceValue}
                >
                  {formatCurrency(availableCents, currencyCode)}
                </Text>
              </View>
              <View style={styles.balanceIcon}>
                <WalletCards color={colors.darkPanel} size={24} />
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(spendingProgress * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>
                {formatCurrency(expenseCents, currencyCode)} spent
              </Text>
              <Text style={styles.progressText}>
                {formatCurrency(incomeCents, currencyCode)} income
              </Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <Metric
              icon={ArrowDownLeft}
              label="Income"
              tone={{ background: colors.primarySoft, foreground: colors.primary }}
              value={formatCurrency(incomeCents, currencyCode)}
            />
            <Metric
              icon={ArrowUpRight}
              label="Spent"
              tone={{ background: colors.accentSoft, foreground: colors.accent }}
              value={formatCurrency(expenseCents, currencyCode)}
            />
            <Metric
              icon={PiggyBank}
              label="Saved"
              tone={{ background: colors.warningSoft, foreground: colors.warning }}
              value={formatCurrency(savingsCurrentCents, currencyCode)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plan health</Text>
            <View style={styles.healthRows}>
              <View style={styles.healthRow}>
                <View style={styles.healthIcon}>
                  <Target color={colors.primary} size={20} />
                </View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>Savings goals</Text>
                  <Text style={styles.healthBody}>
                    {summary?.activeSavingsGoals || 0} active
                  </Text>
                </View>
                <Text style={styles.healthValue}>
                  {formatCurrency(summary?.savingsTargetCents || 0, currencyCode)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.healthRow}>
                <View style={styles.healthIcon}>
                  <Landmark color={colors.accent} size={20} />
                </View>
                <View style={styles.healthCopy}>
                  <Text style={styles.healthTitle}>Budget caps</Text>
                  <Text style={styles.healthBody}>Category limits</Text>
                </View>
                <Text style={styles.healthValue}>
                  {summary?.activeBudgetCaps || 0} active
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            {summary?.recentExpenses?.length ? (
              <View style={styles.activityList}>
                {summary.recentExpenses.map((expense, index) => (
                  <View key={expense.id}>
                    <View style={styles.activityRow}>
                      <View style={styles.activityIcon}>
                        <ReceiptText color={colors.inkMuted} size={19} />
                      </View>
                      <View style={styles.activityCopy}>
                        <Text numberOfLines={1} style={styles.activityTitle}>
                          {expense.merchant || expense.category?.name || 'Expense'}
                        </Text>
                        <Text style={styles.activityBody}>
                          {expense.category?.name || expense.spent_on}
                        </Text>
                      </View>
                      <Text style={styles.activityAmount}>
                        -{formatCurrency(expense.amount_cents, currencyCode)}
                      </Text>
                    </View>
                    {index < summary.recentExpenses.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyActivity />
            )}
          </View>

          {isInitialLoading ? (
            <Text style={styles.loadingLabel}>Refreshing totals...</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.label,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  balancePanel: {
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  balanceHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  balanceLabel: {
    ...typography.label,
    color: '#B8C6BC',
  },
  balanceValue: {
    color: colors.white,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#BDE7D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: '#324039',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    minWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressText: {
    ...typography.caption,
    color: '#B8C6BC',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  healthRows: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  healthRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  healthIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthCopy: {
    flex: 1,
  },
  healthTitle: {
    ...typography.label,
    color: colors.ink,
  },
  healthBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  healthValue: {
    ...typography.label,
    color: colors.ink,
    maxWidth: 120,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyState: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    ...typography.label,
    color: colors.ink,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  activityList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  activityRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    ...typography.label,
    color: colors.ink,
  },
  activityBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  activityAmount: {
    ...typography.label,
    color: colors.danger,
    maxWidth: 120,
  },
  loadingLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
