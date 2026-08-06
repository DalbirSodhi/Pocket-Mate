import { useFocusEffect } from '@react-navigation/native';
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  ReceiptText,
  Split,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  convertExpenseToRecurring,
  deleteExpenseEntry,
  getExpenseDetail,
} from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ExpenseDetailScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { expenseId, currencyCode = 'CAD' } = route.params;
  const [expense, setExpense] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadExpense = useCallback(async () => {
    setError('');

    try {
      setExpense(await getExpenseDetail({ userId: user.id, expenseId }));
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(requestError, 'Unable to load this expense.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [expenseId, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadExpense();
    }, [loadExpense]),
  );

  async function handleMakeMonthly() {
    setIsConverting(true);
    setError('');

    try {
      const recurringExpense = await convertExpenseToRecurring({
        userId: user.id,
        expense,
      });
      setExpense((current) => ({ ...current, recurringExpense }));
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(
          requestError,
          'Unable to make this expense monthly.',
          'This expense is already part of a monthly plan.',
        ),
      );
    } finally {
      setIsConverting(false);
    }
  }

  function confirmDelete() {
    const monthlyNote = expense?.recurringExpense
      ? ' The separate monthly plan will remain active.'
      : '';

    Alert.alert(
      'Delete expense?',
      `This updates your monthly totals immediately and cannot be undone.${monthlyNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            setError('');

            try {
              await deleteExpenseEntry({ userId: user.id, expenseId });
              navigation.goBack();
            } catch (requestError) {
              setError(
                getFinanceErrorMessage(
                  requestError,
                  'Unable to delete this expense.',
                ),
              );
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Expense details"
            title={expense?.merchant || expense?.category?.name || 'Expense'}
          />

          <InlineNotice message={error} variant="error" />

          {expense ? (
            <>
              <View style={styles.amountPanel}>
                <View style={styles.amountIcon}>
                  <ReceiptText color={colors.iconInk} size={23} />
                </View>
                <View style={styles.amountCopy}>
                  <Text style={styles.amountLabel}>Amount spent</Text>
                  <Text style={styles.amountValue}>
                    {formatCurrency(expense.amount_cents, currencyCode)}
                  </Text>
                </View>
              </View>

              <View style={styles.details}>
                <DetailRow
                  label="Category"
                  value={expense.category?.name || 'Uncategorized'}
                />
                <View style={styles.divider} />
                <DetailRow label="Date" value={expense.spent_on} />
                {expense.note ? (
                  <>
                    <View style={styles.divider} />
                    <DetailRow label="Note" value={expense.note} />
                  </>
                ) : null}
              </View>

              <View style={styles.editActions}>
                <AppButton
                  icon={Pencil}
                  label="Edit expense"
                  onPress={() =>
                    navigation.navigate('OneTimeExpense', {
                      expenseId,
                      currencyCode,
                    })
                  }
                  style={styles.editAction}
                  variant="secondary"
                />
                <AppButton
                  icon={Trash2}
                  isLoading={isDeleting}
                  label="Delete"
                  onPress={confirmDelete}
                  style={styles.editAction}
                  variant="danger"
                />
              </View>

              <AppButton
                icon={Split}
                label="Split or record refund"
                onPress={() =>
                  navigation.navigate('ExpenseAdjustments', {
                    expenseId,
                    currencyCode,
                  })
                }
                variant="secondary"
              />

              {expense.recurringExpense ? (
                <View style={styles.monthlyState}>
                  <CheckCircle2 color={colors.success} size={22} />
                  <View style={styles.monthlyCopy}>
                    <Text style={styles.monthlyTitle}>Monthly plan created</Text>
                    <Text style={styles.monthlyBody}>
                      Starts {expense.recurringExpense.starts_on}. The original
                      payment remains in activity.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.actionSection}>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>Is this a regular payment?</Text>
                    <Text style={styles.actionBody}>
                      Create a monthly fixed expense beginning next month. This
                      payment will not be counted twice.
                    </Text>
                  </View>
                  <AppButton
                    icon={CalendarClock}
                    isLoading={isConverting}
                    label="Make monthly"
                    onPress={handleMakeMonthly}
                  />
                </View>
              )}
            </>
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
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  amountPanel: {
    minHeight: 96,
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  amountIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCopy: {
    flex: 1,
  },
  amountLabel: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  amountValue: {
    ...typography.title,
    color: colors.white,
  },
  details: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  detailRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  detailValue: {
    ...typography.label,
    color: colors.ink,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editAction: {
    flex: 1,
  },
  actionSection: {
    gap: spacing.lg,
  },
  actionCopy: {
    gap: spacing.xs,
  },
  actionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  actionBody: {
    ...typography.body,
    color: colors.inkMuted,
  },
  monthlyState: {
    minHeight: 88,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  monthlyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  monthlyTitle: {
    ...typography.label,
    color: colors.success,
  },
  monthlyBody: {
    ...typography.caption,
    color: colors.ink,
  },
});
