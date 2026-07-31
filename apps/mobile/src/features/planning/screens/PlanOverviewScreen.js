import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Gauge,
  Landmark,
  Target,
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

import { LoadingScreen } from '../../../components/LoadingScreen';
import { RetryNotice } from '../../../components/RetryNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { getDashboardSummary } from '../../dashboard/services/dashboardService';
import { getBudgetPressure } from '../../dashboard/utils/dashboardMath.cjs';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { getBudgetCaps } from '../services/planningService';

function PlanRow({
  icon: Icon,
  title,
  detail,
  value,
  onPress,
  isLast = false,
}) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.planRow,
          pressed && styles.planRowPressed,
        ]}
      >
        <View style={styles.planIcon}>
          <Icon color={colors.ink} size={20} />
        </View>
        <View style={styles.planCopy}>
          <Text style={styles.planTitle}>{title}</Text>
          <Text style={styles.planDetail}>{detail}</Text>
        </View>
        <Text style={styles.planValue}>{value}</Text>
        <ChevronRight color={colors.inkMuted} size={18} />
      </Pressable>
      {!isLast ? <View style={styles.divider} /> : null}
    </>
  );
}

export function PlanOverviewScreen({ navigation, profile }) {
  const { user } = useAuthSession();
  const [summary, setSummary] = useState(null);
  const [budgetCaps, setBudgetCaps] = useState([]);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const currencyCode = profile.currency_code || 'CAD';

  const loadPlan = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      const [nextSummary, nextBudgetCaps] = await Promise.all([
        getDashboardSummary(user.id, profile),
        getBudgetCaps(user.id),
      ]);
      setSummary(nextSummary);
      setBudgetCaps(nextBudgetCaps);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your plan.');
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [profile, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [loadPlan]),
  );

  const planHealth = summary?.planHealth || {
    label: 'Building your plan',
    allocationPercent: 0,
    detail: 'Add income and commitments to see your plan health.',
  };
  const budgetPressure = getBudgetPressure(budgetCaps);
  const pressureColor =
    budgetPressure.tone === 'danger'
      ? colors.danger
      : budgetPressure.tone === 'warning'
        ? colors.warning
        : budgetPressure.tone === 'success'
          ? colors.success
          : colors.info;
  const visibleCaps = [...budgetCaps]
    .sort((left, right) => right.usageRatio - left.usageRatio)
    .slice(0, 3);

  if (isInitialLoading && !summary) {
    return <LoadingScreen message="Loading your plan..." />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadPlan}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            subtitle="Commitments, limits, and savings"
            title="Plan"
          />

          <RetryNotice
            isRetrying={isRefreshing}
            message={error}
            onRetry={loadPlan}
          />

          <View style={styles.health}>
            <View style={styles.healthHeading}>
              <View>
                <Text style={styles.healthEyebrow}>THIS MONTH</Text>
                <Text style={styles.healthTitle}>{planHealth.label}</Text>
              </View>
              <Text style={styles.healthPercent}>
                {planHealth.allocationPercent}%
              </Text>
            </View>
            <Text style={styles.healthDetail}>{planHealth.detail}</Text>
            <View style={styles.healthTrack}>
              <View
                style={[
                  styles.healthFill,
                  {
                    width: `${Math.min(planHealth.allocationPercent, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Committed</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary?.committedCents || 0, currencyCode)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>After commitments</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(summary?.spendableCents || 0, currencyCode)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>Budget pressure</Text>
                <Text style={styles.sectionSubtitle}>
                  Combined usage across category limits
                </Text>
              </View>
              <View style={styles.pressureScore}>
                <Gauge color={pressureColor} size={18} />
                <Text style={[styles.pressureValue, { color: pressureColor }]}>
                  {budgetPressure.usagePercent}%
                </Text>
              </View>
            </View>

            <View style={styles.pressureSummary}>
              <Text style={[styles.pressureLabel, { color: pressureColor }]}>
                {budgetPressure.label}
              </Text>
              <Text style={styles.pressureDetail}>{budgetPressure.detail}</Text>
            </View>

            {visibleCaps.length > 0 ? (
              <View style={styles.categoryProgress}>
                {visibleCaps.map((cap) => {
                  const progressColor =
                    cap.usageRatio >= 1
                      ? colors.danger
                      : cap.usageRatio >= 0.8
                        ? colors.warning
                        : colors.primary;

                  return (
                    <View key={cap.id} style={styles.categoryRow}>
                      <View style={styles.categoryHeading}>
                        <Text style={styles.categoryName}>
                          {cap.category?.name || 'Category'}
                        </Text>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(cap.spentCents, currencyCode)} of{' '}
                          {formatCurrency(cap.amount_cents, currencyCode)}
                        </Text>
                      </View>
                      <View style={styles.categoryTrack}>
                        <View
                          style={[
                            styles.categoryFill,
                            {
                              backgroundColor: progressColor,
                              width: `${Math.min(
                                Math.round(cap.usageRatio * 100),
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('BudgetCaps', { currencyCode })
                }
                style={styles.emptyBudgetAction}
              >
                <Text style={styles.emptyBudgetLabel}>Create a budget cap</Text>
                <ChevronRight color={colors.primary} size={17} />
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage plan</Text>
            <View style={styles.planList}>
              <PlanRow
                detail="Preview cash, daily pace, and category limits"
                icon={CircleDollarSign}
                onPress={() =>
                  navigation.navigate('PurchaseImpact', { currencyCode })
                }
                title="Check a purchase"
                value="Try it"
              />
              <PlanRow
                detail={`${summary?.activeSavingsGoals || 0} active goals`}
                icon={Target}
                onPress={() =>
                  navigation.navigate('SavingsGoals', { currencyCode })
                }
                title="Savings goals"
                value={formatCurrency(
                  summary?.monthlySavingsCents || 0,
                  currencyCode,
                )}
              />
              <PlanRow
                detail={`${summary?.dueRecurringExpenses || 0} due this month`}
                icon={CalendarClock}
                onPress={() =>
                  navigation.navigate('FixedExpenses', { currencyCode })
                }
                title="Monthly fixed"
                value={formatCurrency(
                  summary?.fixedExpenseCents || 0,
                  currencyCode,
                )}
              />
              <PlanRow
                detail={`${summary?.unpaidCardBills || 0} unpaid bills`}
                icon={CreditCard}
                onPress={() =>
                  navigation.navigate('CreditCards', { currencyCode })
                }
                title="Credit cards"
                value={formatCurrency(
                  summary?.cardBillCents || 0,
                  currencyCode,
                )}
              />
              <PlanRow
                detail={`${summary?.overBudgetCaps || 0} over limit`}
                icon={Landmark}
                isLast
                onPress={() =>
                  navigation.navigate('BudgetCaps', { currencyCode })
                }
                title="Budget caps"
                value={`${summary?.activeBudgetCaps || 0} active`}
              />
            </View>
          </View>
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
  health: {
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.xl,
    gap: spacing.md,
  },
  healthHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  healthEyebrow: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  healthTitle: {
    ...typography.section,
    color: colors.white,
    marginTop: spacing.xs,
  },
  healthPercent: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  healthDetail: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  healthTrack: {
    height: 5,
    borderRadius: radius.round,
    backgroundColor: colors.panelTrack,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  summary: {
    minHeight: 72,
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  summaryValue: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.ink,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  pressureScore: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressureValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  pressureSummary: {
    gap: spacing.xs,
  },
  pressureLabel: {
    ...typography.label,
  },
  pressureDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  categoryProgress: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryName: {
    ...typography.label,
    color: colors.ink,
    flex: 1,
  },
  categoryAmount: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  categoryTrack: {
    height: 5,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: radius.round,
  },
  emptyBudgetAction: {
    minHeight: 44,
    borderTopWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyBudgetLabel: {
    ...typography.label,
    color: colors.primary,
  },
  planList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  planRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
  },
  planTitle: {
    ...typography.label,
    color: colors.ink,
  },
  planDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  planValue: {
    ...typography.label,
    color: colors.ink,
    maxWidth: 110,
  },
  divider: {
    height: 1,
    marginLeft: 52,
    backgroundColor: colors.border,
  },
});
