import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ReceiptText,
  Search,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '../../../components/LoadingScreen';
import { RetryNotice } from '../../../components/RetryNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  getExpenseCategories,
  getTransactions,
} from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';
import {
  filterTransactions,
  getMonthKey,
  getMonthRangeForKey,
  shiftMonthKey,
  summarizeTransactions,
} from '../../insights/utils/monthlyInsights.cjs';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'bill_payment', label: 'Bills' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'refund', label: 'Refunds' },
  { id: 'income', label: 'Income' },
];

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function TransactionsScreen({
  navigation,
  route,
  currencyCode: currencyCodeProp,
  isTabRoot = false,
}) {
  const { user } = useAuthSession();
  const currencyCode = currencyCodeProp || route.params?.currencyCode || 'CAD';
  const [monthKey, setMonthKey] = useState(
    route.params?.initialMonthKey || getMonthKey(),
  );
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState(route.params?.initialType || 'all');
  const [categoryId, setCategoryId] = useState(
    route.params?.initialCategoryId || 'all',
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const month = getMonthRangeForKey(monthKey);

  const loadTransactions = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      const [nextTransactions, nextCategories] = await Promise.all([
        getTransactions(user.id, {
          startDate: month.startDate,
          endDate: month.endDate,
        }),
        getExpenseCategories(user.id),
      ]);
      setTransactions(nextTransactions);
      setCategories(nextCategories);
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(requestError, 'Unable to load your activity.'),
      );
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [month.endDate, month.startDate, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions]),
  );

  const visibleTransactions = useMemo(
    () => filterTransactions(transactions, { type: filter, categoryId, query }),
    [categoryId, filter, query, transactions],
  );
  const totals = useMemo(
    () => summarizeTransactions(transactions),
    [transactions],
  );

  function selectCategory(nextCategoryId) {
    setCategoryId(nextCategoryId);
    if (nextCategoryId !== 'all') {
      setFilter('expense');
    }
  }

  function openTransaction(transaction) {
    if (transaction.type === 'transfer') {
      navigation.navigate('Accounts', { currencyCode });
      return;
    }

    if (transaction.type === 'refund') {
      navigation.navigate('ExpenseDetail', {
        expenseId: transaction.expenseId,
        currencyCode,
      });
      return;
    }

    if (transaction.type === 'income') {
      navigation.navigate('IncomeDetail', {
        incomeId: transaction.id,
        currencyCode,
      });
      return;
    }

    if (transaction.type === 'expense') {
      navigation.navigate('ExpenseDetail', {
        expenseId: transaction.id,
        currencyCode,
      });
      return;
    }

    if (transaction.paymentPlan) {
      navigation.navigate('BillPaymentPlan', {
        creditCardBillId: transaction.paymentPlan.credit_card_bill_id,
        recurringExpenseId: transaction.paymentPlan.recurring_expense_id,
        periodStart: transaction.paymentPlan.period_start,
        title: transaction.paymentPlan.title,
        amountCents: transaction.paymentPlan.total_amount_cents,
        dueOn: transaction.paymentPlan.due_on,
        currencyCode,
      });
    } else {
      navigation.navigate('CreditCards', { currencyCode });
    }
  }

  if (isInitialLoading) {
    return <LoadingScreen message="Loading your activity..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadTransactions}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            action={
              <Pressable
                accessibilityLabel="Open monthly insights"
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('MonthlyInsights', {
                    currencyCode,
                    monthKey,
                  })
                }
                style={styles.headerAction}
              >
                <BarChart3 color={colors.ink} size={20} />
              </Pressable>
            }
            onBack={isTabRoot ? undefined : navigation.goBack}
            subtitle="Search and correct monthly cash movement"
            title="Activity"
          />

          <View style={styles.monthPicker}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              onPress={() => setMonthKey(shiftMonthKey(monthKey, -1))}
              style={styles.monthButton}
            >
              <ChevronLeft color={colors.ink} size={19} />
            </Pressable>
            <Text style={styles.monthLabel}>{month.label}</Text>
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
              <ChevronRight color={colors.ink} size={19} />
            </Pressable>
          </View>

          <View style={styles.totals}>
            {[
              ['Income', totals.incomeCents, colors.success],
              ['Spent', totals.spentCents, colors.danger],
              ['Net', totals.netCents, colors.ink],
            ].map(([label, amountCents, color]) => (
              <View key={label} style={styles.totalItem}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[styles.totalValue, { color }]}
                >
                  {formatCurrency(amountCents, currencyCode)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.searchShell}>
            <Search color={colors.inkMuted} size={19} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search merchant, source, or note"
              placeholderTextColor={colors.inkMuted}
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View accessibilityRole="tablist" style={styles.filters}>
            {FILTERS.map((item) => {
              const isSelected = item.id === filter;

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  key={item.id}
                  onPress={() => {
                    setFilter(item.id);
                    if (item.id !== 'expense') setCategoryId('all');
                  }}
                  style={[styles.filter, isSelected && styles.filterSelected]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      isSelected && styles.filterLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            contentContainerStyle={styles.categoryFilters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {[{ id: 'all', name: 'All categories' }, ...categories].map(
              (category) => {
                const isSelected = category.id === categoryId;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={category.id}
                    onPress={() => selectCategory(category.id)}
                    style={[
                      styles.categoryFilter,
                      isSelected && styles.categoryFilterSelected,
                    ]}
                  >
                    {category.color ? (
                      <View
                        style={[
                          styles.categorySwatch,
                          { backgroundColor: category.color },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.categoryFilterLabel,
                        isSelected && styles.categoryFilterLabelSelected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>

          <RetryNotice
            isRetrying={isRefreshing}
            message={error}
            onRetry={loadTransactions}
          />

          {visibleTransactions.length > 0 ? (
            <View style={styles.list}>
              {visibleTransactions.map((transaction, index) => {
                const isIncome = transaction.type === 'income';
                const isRefund = transaction.type === 'refund';
                const isBillPayment = transaction.type === 'bill_payment';
                const isTransfer =
                  transaction.type === 'transfer' || transaction.isTransfer;
                const Icon = isIncome || isRefund
                  ? ArrowDownLeft
                  : isTransfer
                    ? ArrowRightLeft
                  : isBillPayment
                    ? CreditCard
                    : ArrowUpRight;

                return (
                  <View key={`${transaction.type}-${transaction.id}`}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openTransaction(transaction)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.icon}>
                        <Icon color={colors.iconInk} size={19} />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text numberOfLines={1} style={styles.rowTitle}>
                          {transaction.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.rowSubtitle}>
                          {transaction.subtitle} - {formatDate(transaction.date)}
                        </Text>
                      </View>
                      <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={[
                          styles.amount,
                          { color: isTransfer ? colors.ink : isIncome || isRefund ? colors.success : colors.danger },
                        ]}
                      >
                        {isTransfer ? '' : isIncome || isRefund ? '+' : '-'}
                        {formatCurrency(transaction.amountCents, currencyCode)}
                      </Text>
                      <ChevronRight color={colors.inkMuted} size={17} />
                    </Pressable>
                    {index < visibleTransactions.length - 1 ? (
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
                <Text style={styles.emptyTitle}>No matching activity</Text>
                <Text style={styles.emptyBody}>
                  Change the month or filters to broaden your search.
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
    gap: spacing.lg,
  },
  headerAction: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPicker: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  monthLabel: { ...typography.section, color: colors.ink },
  totals: {
    minHeight: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  totalItem: { flex: 1, minWidth: 0, gap: spacing.xs },
  totalLabel: { ...typography.caption, color: colors.inkMuted },
  totalValue: { ...typography.label, fontSize: 16 },
  searchShell: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { ...typography.body, color: colors.ink, flex: 1, minHeight: 48 },
  filters: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xs,
    flexDirection: 'row',
  },
  filter: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  filterSelected: { backgroundColor: colors.primarySoft },
  filterLabel: { ...typography.caption, color: colors.inkMuted },
  filterLabelSelected: { color: colors.primary, fontWeight: '700' },
  categoryFilters: { gap: spacing.sm, paddingRight: spacing.lg },
  categoryFilter: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryFilterSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categorySwatch: { width: 9, height: 9, borderRadius: radius.round },
  categoryFilterLabel: { ...typography.caption, color: colors.inkMuted },
  categoryFilterLabelSelected: { color: colors.primary },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 76,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.label, color: colors.ink },
  rowSubtitle: { ...typography.caption, color: colors.inkMuted },
  amount: { ...typography.label, maxWidth: 120 },
  divider: { height: 1, marginLeft: 66, backgroundColor: colors.border },
  emptyState: {
    minHeight: 104,
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
