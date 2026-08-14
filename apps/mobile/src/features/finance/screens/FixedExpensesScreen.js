import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock, Check, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  deleteRecurringExpense,
  getExpenseCategories,
  getRecurringExpenses,
  setRecurringExpenseActive,
  updateRecurringExpense,
} from '../services/financeService';
import { parseAmountToCents, validateEntry } from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function FixedExpensesScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [plans, setPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editStartsOn, setEditStartsOn] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editErrors, setEditErrors] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadPlans = useCallback(async () => {
    setIsRefreshing(true);
    setError('');

    try {
      const [nextPlans, nextCategories] = await Promise.all([
        getRecurringExpenses(user.id),
        getExpenseCategories(user.id),
      ]);
      setPlans(nextPlans);
      setCategories(nextCategories);
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

  function handleStartEdit(plan) {
    setEditingId(plan.id);
    setEditName(plan.name);
    setEditAmount((plan.amount_cents / 100).toFixed(2));
    setEditCategoryId(plan.category_id);
    setEditStartsOn(plan.starts_on);
    setEditNote(plan.note || '');
    setEditErrors({});
    setError('');
  }

  function handleCancelEdit() {
    setEditingId('');
    setEditErrors({});
  }

  async function handleSaveEdit(plan) {
    const nextErrors = validateEntry({ amount: editAmount, date: editStartsOn });

    if (!editName.trim()) {
      nextErrors.name = 'Enter a name for this monthly expense.';
    }

    if (!editCategoryId) {
      nextErrors.category = 'Choose an expense category.';
    }

    setEditErrors(nextErrors);
    setError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSavingEdit(true);

    try {
      await updateRecurringExpense({
        userId: user.id,
        recurringExpenseId: plan.id,
        categoryId: editCategoryId,
        name: editName,
        amountCents: parseAmountToCents(editAmount),
        startsOn: editStartsOn,
        note: editNote,
      });
      setEditingId('');
      await loadPlans();
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(
          requestError,
          'Unable to save changes to this monthly expense.',
        ),
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  function confirmDelete(plan) {
    Alert.alert(
      'Delete monthly expense?',
      `Remove ${plan.name} from future monthly planning? Past one-time expense entries remain in your activity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUpdatingId(plan.id);
            setError('');

            try {
              await deleteRecurringExpense({
                userId: user.id,
                recurringExpenseId: plan.id,
              });
              setPlans((current) => current.filter((item) => item.id !== plan.id));
              if (editingId === plan.id) {
                handleCancelEdit();
              }
            } catch (requestError) {
              setError(
                getFinanceErrorMessage(
                  requestError,
                  'Unable to delete this monthly expense.',
                ),
              );
            } finally {
              setUpdatingId('');
            }
          },
        },
      ],
    );
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
                      <View style={styles.rowActions}>
                        <Pressable
                          accessibilityLabel={`Edit ${plan.name}`}
                          accessibilityRole="button"
                          disabled={Boolean(updatingId) || isSavingEdit}
                          onPress={() => handleStartEdit(plan)}
                          style={styles.iconButton}
                        >
                          <Pencil color={colors.primary} size={17} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Delete ${plan.name}`}
                          accessibilityRole="button"
                          disabled={Boolean(updatingId) || isSavingEdit}
                          onPress={() => confirmDelete(plan)}
                          style={styles.iconButton}
                        >
                          <Trash2 color={colors.danger} size={17} />
                        </Pressable>
                        <Switch
                          accessibilityLabel={`${plan.is_active ? 'Pause' : 'Resume'} ${plan.name}`}
                          disabled={updatingId === plan.id || isSavingEdit}
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
                  </View>
                  {editingId === plan.id ? (
                    <View style={styles.editForm}>
                      <Text style={styles.editTitle}>Edit monthly expense</Text>
                      <FormField
                        error={editErrors.name}
                        label="Expense name"
                        maxLength={80}
                        onChangeText={setEditName}
                        value={editName}
                      />
                      <FormField
                        error={editErrors.amount}
                        keyboardType="decimal-pad"
                        label="Monthly amount"
                        onChangeText={setEditAmount}
                        value={editAmount}
                      />
                      <View style={styles.categoryBlock}>
                        <Text style={styles.fieldLabel}>Category</Text>
                        <View style={styles.categoryGrid}>
                          {categories.map((category) => {
                            const isSelected = category.id === editCategoryId;

                            return (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                key={category.id}
                                onPress={() => setEditCategoryId(category.id)}
                                style={[
                                  styles.categoryChip,
                                  isSelected && styles.categoryChipSelected,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.categorySwatch,
                                    { backgroundColor: category.color || colors.inkMuted },
                                  ]}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.categoryLabel,
                                    isSelected && styles.categoryLabelSelected,
                                  ]}
                                >
                                  {category.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {editErrors.category ? (
                          <Text style={styles.errorText}>{editErrors.category}</Text>
                        ) : null}
                      </View>
                      <FormField
                        autoCapitalize="none"
                        error={editErrors.date}
                        keyboardType="numbers-and-punctuation"
                        label="Starts on"
                        maxLength={10}
                        onChangeText={setEditStartsOn}
                        value={editStartsOn}
                      />
                      <FormField
                        label="Note (optional)"
                        maxLength={240}
                        multiline
                        numberOfLines={3}
                        onChangeText={setEditNote}
                        value={editNote}
                      />
                      <View style={styles.editActions}>
                        <AppButton
                          label="Cancel"
                          onPress={handleCancelEdit}
                          style={styles.editAction}
                          variant="secondary"
                        />
                        <AppButton
                          icon={Check}
                          isLoading={isSavingEdit}
                          label="Save changes"
                          onPress={() => handleSaveEdit(plan)}
                          style={styles.editAction}
                        />
                      </View>
                    </View>
                  ) : null}
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    ...typography.label,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  editForm: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: -spacing.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  editTitle: {
    ...typography.label,
    color: colors.ink,
  },
  categoryBlock: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.ink,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    maxWidth: '48%',
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  categorySwatch: {
    width: 10,
    height: 10,
    borderRadius: radius.round,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.ink,
    flexShrink: 1,
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editAction: {
    flex: 1,
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
