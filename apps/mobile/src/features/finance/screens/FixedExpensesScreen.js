import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  getRecurringExpenses,
  setRecurringExpenseActive,
} from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function FixedExpensesScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadPlans = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      setPlans(await getRecurringExpenses(user.id));
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(
          requestError,
          'Unable to load monthly fixed expenses.',
        ),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  const activeTotal = useMemo(
    () =>
      plans
        .filter((plan) => plan.is_active)
        .reduce((total, plan) => total + plan.amount_cents, 0),
    [plans],
  );

  async function handleToggle(plan) {
    setUpdatingId(plan.id);
    setError('');

    try {
      await setRecurringExpenseActive({
        userId: user.id,
        recurringExpenseId: plan.id,
        isActive: !plan.is_active,
      });
      setPlans((current) =>
        current.map((item) =>
          item.id === plan.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(
          requestError,
          'Unable to update this monthly expense.',
        ),
      );
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadPlans}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Known costs reserved every month"
            title="Monthly fixed"
          />

          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <CalendarClock color={colors.primary} size={23} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Active monthly total</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(activeTotal, currencyCode)}
              </Text>
            </View>
          </View>

          <InlineNotice message={error} variant="error" />

          {plans.length > 0 ? (
            <View style={styles.list}>
              {plans.map((plan, index) => (
                <View key={plan.id}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor:
                            plan.category?.color || colors.inkMuted,
                        },
                      ]}
                    />
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {plan.name}
                      </Text>
                      <Text style={styles.rowBody}>
                        {plan.category?.name || 'Expense'} - day {plan.charge_day}
                      </Text>
                    </View>
                    <View style={styles.rowValue}>
                      <Text style={styles.amount}>
                        {formatCurrency(plan.amount_cents, currencyCode)}
                      </Text>
                      <Switch
                        accessibilityLabel={`${plan.is_active ? 'Pause' : 'Resume'} ${plan.name}`}
                        disabled={updatingId === plan.id}
                        onValueChange={() => handleToggle(plan)}
                        thumbColor={colors.white}
                        trackColor={{
                          false: colors.border,
                          true: colors.primary,
                        }}
                        value={plan.is_active}
                      />
                    </View>
                  </View>
                  {index < plans.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No monthly fixed expenses</Text>
              <Text style={styles.emptyBody}>
                Add one from the expense menu to reserve it automatically.
              </Text>
            </View>
          )}
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
  summary: {
    minHeight: 92,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  summaryValue: {
    ...typography.section,
    color: colors.ink,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: {
    width: 10,
    height: 40,
    borderRadius: radius.sm,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.label,
    color: colors.ink,
  },
  rowBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  rowValue: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amount: {
    ...typography.label,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  empty: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.label,
    color: colors.ink,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
