import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  ReceiptText,
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
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { getMonthlyInsights } from '../services/insightsService';
import {
  getMonthKey,
  shiftMonthKey,
} from '../utils/monthlyInsights.cjs';

function getCapCopy(row, currencyCode) {
  if (!row.capCents) {
    return `${row.sharePercent}% of monthly spending`;
  }

  if (row.capRemainingCents < 0) {
    return `${formatCurrency(Math.abs(row.capRemainingCents), currencyCode)} over cap`;
  }

  return `${formatCurrency(row.capRemainingCents, currencyCode)} left in cap`;
}

export function MonthlyInsightsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [monthKey, setMonthKey] = useState(
    route.params?.monthKey || getMonthKey(),
  );
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      setInsights(await getMonthlyInsights({ userId: user.id, monthKey }));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load monthly insights.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [monthKey, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [loadInsights]),
  );

  function openCategory(row) {
    navigation.navigate('Transactions', {
      currencyCode,
      initialMonthKey: monthKey,
      initialCategoryId:
        row.categoryId === 'bill-payments' ? 'all' : row.categoryId,
      initialType:
        row.categoryId === 'bill-payments' ? 'bill_payment' : 'expense',
    });
  }

  if (isLoading && !insights) {
    return <LoadingScreen message="Calculating monthly insights..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadInsights}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Where your money went"
            title="Monthly insights"
          />

          <View style={styles.monthPicker}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              onPress={() => setMonthKey(shiftMonthKey(monthKey, -1))}
              style={styles.monthButton}
            >
              <ChevronLeft color={colors.ink} size={20} />
            </Pressable>
            <Text style={styles.monthLabel}>{insights?.label}</Text>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              disabled={monthKey === getMonthKey()}
              onPress={() => setMonthKey(shiftMonthKey(monthKey, 1))}
              style={[
                styles.monthButton,
                monthKey === getMonthKey() && styles.disabled,
              ]}
            >
              <ChevronRight color={colors.ink} size={20} />
            </Pressable>
          </View>

          <RetryNotice
            isRetrying={isRefreshing}
            message={error}
            onRetry={loadInsights}
          />

          <View style={styles.totalPanel}>
            <Text style={styles.totalLabel}>Total spent</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.totalValue}>
              {formatCurrency(insights?.totalSpentCents || 0, currencyCode)}
            </Text>
            <Text style={styles.totalDetail}>
              {insights?.largestCategory
                ? `${insights.largestCategory.name} was your largest category.`
                : 'Your spending breakdown will appear after an expense.'}
            </Text>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Category breakdown</Text>
            <Text style={styles.sectionMeta}>
              {insights?.rows?.length || 0} categories
            </Text>
          </View>

          {insights?.rows?.length ? (
            <View style={styles.breakdown}>
              {insights.rows.map((row, index) => {
                const capColor =
                  row.capTone === 'danger'
                    ? colors.danger
                    : row.capTone === 'warning'
                      ? colors.warning
                      : colors.success;

                return (
                  <View key={row.categoryId}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openCategory(row)}
                      style={({ pressed }) => [
                        styles.categoryRow,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: row.color },
                        ]}
                      />
                      <View style={styles.categoryCopy}>
                        <View style={styles.categoryHeading}>
                          <Text numberOfLines={1} style={styles.categoryName}>
                            {row.name}
                          </Text>
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(row.amountCents, currencyCode)}
                          </Text>
                        </View>
                        <View style={styles.shareTrack}>
                          <View
                            style={[
                              styles.shareFill,
                              {
                                backgroundColor: row.color,
                                width: `${Math.max(row.sharePercent, 2)}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryMeta,
                            row.capCents ? { color: capColor } : null,
                          ]}
                        >
                          {getCapCopy(row, currencyCode)}
                        </Text>
                      </View>
                      <ChevronRight color={colors.inkMuted} size={17} />
                    </Pressable>
                    {index < insights.rows.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ReceiptText color={colors.inkMuted} size={24} />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>No spending this month</Text>
                <Text style={styles.emptyBody}>
                  Expenses and completed bill payments will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
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
  monthPicker: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  monthLabel: { ...typography.section, color: colors.ink },
  totalPanel: {
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  totalLabel: { ...typography.label, color: colors.panelMuted },
  totalValue: { ...typography.hero, color: colors.white },
  totalDetail: { ...typography.caption, color: colors.panelMuted },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...typography.section, color: colors.ink },
  sectionMeta: { ...typography.caption, color: colors.inkMuted },
  breakdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  categoryRow: {
    minHeight: 92,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  swatch: { width: 12, height: 44, borderRadius: radius.sm },
  categoryCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryName: { ...typography.label, color: colors.ink, flex: 1 },
  categoryAmount: { ...typography.label, color: colors.ink },
  shareTrack: {
    height: 5,
    borderRadius: radius.round,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  shareFill: { height: '100%', borderRadius: radius.round },
  categoryMeta: { ...typography.caption, color: colors.inkMuted },
  divider: { height: 1, marginLeft: 44, backgroundColor: colors.border },
  emptyState: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyCopy: { flex: 1, gap: spacing.xs },
  emptyTitle: { ...typography.label, color: colors.ink },
  emptyBody: { ...typography.caption, color: colors.inkMuted },
});
