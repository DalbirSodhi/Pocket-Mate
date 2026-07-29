import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  ReceiptText,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { getTransactions } from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'card_bill', label: 'Card bills' },
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
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      setTransactions(await getTransactions(user.id));
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(requestError, 'Unable to load your activity.'),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions]),
  );

  const visibleTransactions = useMemo(
    () =>
      filter === 'all'
        ? transactions
        : transactions.filter((transaction) => transaction.type === filter),
    [filter, transactions],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            onBack={isTabRoot ? undefined : navigation.goBack}
            subtitle="Income and expenses in one place"
            title="Activity"
          />

          <View accessibilityRole="tablist" style={styles.filters}>
            {FILTERS.map((item) => {
              const isSelected = item.id === filter;

              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  key={item.id}
                  onPress={() => setFilter(item.id)}
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

          <InlineNotice message={error} variant="error" />

          {visibleTransactions.length > 0 ? (
            <View style={styles.list}>
              {visibleTransactions.map((transaction, index) => {
                const isIncome = transaction.type === 'income';
                const isCardBill = transaction.type === 'card_bill';
                const Icon = isIncome
                  ? ArrowDownLeft
                  : isCardBill
                    ? CreditCard
                    : ArrowUpRight;
                const tone = {
                  background: colors.iconSurface,
                  foreground: colors.iconInk,
                };

                return (
                  <View key={`${transaction.type}-${transaction.id}`}>
                    <Pressable
                      accessibilityRole={transaction.type === 'expense' ? 'button' : undefined}
                      disabled={transaction.type !== 'expense'}
                      onPress={() =>
                        navigation.navigate('ExpenseDetail', {
                          expenseId: transaction.id,
                          currencyCode,
                        })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.icon,
                          {
                            backgroundColor: tone.background,
                          },
                        ]}
                      >
                        <Icon color={tone.foreground} size={19} />
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
                          { color: isIncome ? colors.success : colors.danger },
                        ]}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrency(transaction.amountCents, currencyCode)}
                      </Text>
                      {transaction.type === 'expense' ? (
                        <ChevronRight color={colors.inkMuted} size={17} />
                      ) : null}
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
              <View style={styles.emptyIcon}>
                <ReceiptText color={colors.inkMuted} size={24} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>No activity here yet</Text>
                <Text style={styles.emptyBody}>
                  Entries matching this filter will appear here.
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
    paddingHorizontal: spacing.sm,
  },
  filterSelected: {
    backgroundColor: colors.primarySoft,
  },
  filterLabel: {
    ...typography.label,
    color: colors.inkMuted,
  },
  filterLabelSelected: {
    color: colors.primary,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.label,
    color: colors.ink,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  amount: {
    ...typography.label,
    maxWidth: 112,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyState: {
    minHeight: 112,
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
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
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
