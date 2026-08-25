import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Landmark, Pencil, Save, Trash2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { KeyboardAwareScrollView } from '../../../components/KeyboardAwareScrollView';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../../finance/services/financeService';
import { parseAmountToCents } from '../../finance/utils/financeValidation.cjs';
import { getMonthKey, getMonthRangeForKey, shiftMonthKey } from '../../insights/utils/monthlyInsights.cjs';
import { getMonthlyBudget, removeMonthlyBudget, saveMonthlyBudget } from '../services/budgetService';

const ROLLOVER_OPTIONS = [
  { id: 'none', label: 'No rollover' },
  { id: 'positive_only', label: 'Carry extra' },
  { id: 'full', label: 'Carry extra or overspend' },
];

export function BudgetCapsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [caps, setCaps] = useState([]);
  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [rolloverMode, setRolloverMode] = useState('none');
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [editingCapId, setEditingCapId] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setRequestError('');

    try {
      const [nextCaps, nextCategories] = await Promise.all([
        getMonthlyBudget({ userId: user.id, monthKey }),
        ensureExpenseCategories(user.id),
      ]);
      setCaps(nextCaps);
      setCategories(nextCategories);
      setCategoryId((current) =>
        nextCategories.some((category) => category.id === current)
          ? current
          : nextCategories[0]?.id || '',
      );
    } catch (error) {
      setRequestError(error.message || 'Unable to load budget caps.');
    } finally {
      setIsRefreshing(false);
    }
  }, [monthKey, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  function resetForm() {
    setEditingCapId('');
    setCategoryId(categories[0]?.id || '');
    setAmount('');
    setRolloverMode('none');
    setApplyToFuture(true);
    setErrors({});
  }

  function startEditing(cap) {
    setEditingCapId(cap.id);
    setCategoryId(cap.category_id);
    setAmount(String((cap.plannedAmountCents || 0) / 100));
    setRolloverMode(cap.rolloverMode || 'none');
    setApplyToFuture(true);
    setErrors({});
    setRequestError('');
  }

  async function handleSave() {
    const nextErrors = {};
    const amountCents = parseAmountToCents(amount);

    if (!categoryId) {
      nextErrors.category = 'Choose a category.';
    }
    if (amountCents === null) {
      nextErrors.amount = 'Enter a valid monthly cap.';
    }

    setErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await saveMonthlyBudget({
        monthStart: getMonthRangeForKey(monthKey).startDate,
        categoryId,
        amountCents,
        rolloverMode,
        applyToFuture,
      });
      resetForm();
      await loadData();
    } catch (error) {
      setRequestError(
        error?.code === '23505'
          ? 'This category already has a monthly budget.'
          : error.message || 'Unable to save this monthly budget.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function cancelEditing() {
    resetForm();
    setRequestError('');
  }

  async function removeBudget(cap) {
    setRequestError('');
    try {
      await removeMonthlyBudget({
        monthStart: getMonthRangeForKey(monthKey).startDate,
        categoryId: cap.category_id,
        removeFuture: true,
      });
      await loadData();
    } catch (error) {
      setRequestError(error.message || 'Unable to remove this monthly budget.');
    }
  }

  function confirmRemove(cap) {
    const categoryName = cap.category?.name || 'This category';
    const message = `${categoryName} will be removed from this month and will not be copied into future months.`;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(message)) {
        removeBudget(cap);
      }
      return;
    }

    Alert.alert('Remove monthly budget?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeBudget(cap) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadData}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Plan each month and choose what rolls forward"
            title="Monthly budget"
          />

          <InlineNotice message={requestError} variant="error" />

          <View style={styles.monthNavigation}>
            <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setMonthKey((current) => shiftMonthKey(current, -1))} style={styles.monthButton}>
              <ChevronLeft color={colors.ink} size={20} />
            </Pressable>
            <Text style={styles.monthLabel}>{getMonthRangeForKey(monthKey).label}</Text>
            <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setMonthKey((current) => shiftMonthKey(current, 1))} style={styles.monthButton}>
              <ChevronRight color={colors.ink} size={20} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Set category amount</Text>
            {editingCapId ? (
              <View style={styles.editingNotice}>
                <Text style={styles.editingLabel}>Editing monthly budget</Text>
                <Pressable accessibilityLabel="Cancel budget edit" accessibilityRole="button" onPress={cancelEditing} style={styles.cancelEditButton}>
                  <X color={colors.inkMuted} size={18} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const isSelected = category.id === categoryId;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.swatch,
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
            {errors.category ? (
              <Text style={styles.errorText}>{errors.category}</Text>
            ) : null}
            <FormField
              error={errors.amount}
              keyboardType="decimal-pad"
              label="Monthly limit"
              onChangeText={setAmount}
              placeholder="0.00"
              value={amount}
            />
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Rollover</Text>
              <View style={styles.rolloverGrid}>
                {ROLLOVER_OPTIONS.map((option) => {
                  const selected = rolloverMode === option.id;
                  return (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={option.id} onPress={() => setRolloverMode(option.id)} style={[styles.rolloverOption, selected && styles.rolloverOptionSelected]}>
                      <Text style={[styles.rolloverLabel, selected && styles.rolloverLabelSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.futureRow}>
              <View style={styles.futureCopy}>
                <Text style={styles.fieldLabel}>Use for future months</Text>
                <Text style={styles.futureBody}>Turn off to change only this month.</Text>
              </View>
              <Switch value={applyToFuture} onValueChange={setApplyToFuture} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
            </View>
            <AppButton
              icon={Save}
              isLoading={isSaving}
              label={editingCapId ? 'Update monthly budget' : 'Save monthly budget'}
              onPress={handleSave}
            />
            {editingCapId ? (
              <AppButton label="Cancel" onPress={cancelEditing} variant="secondary" />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{getMonthRangeForKey(monthKey).label}</Text>
            <View style={styles.list}>
              {caps.map((cap, index) => {
                const overCap = cap.remainingCents < 0;

                return (
                  <View key={cap.id}>
                    <View style={styles.capRow}>
                      <View style={styles.capHeading}>
                        <View style={styles.capTitleRow}>
                          <Landmark
                            color={cap.category?.color || colors.primary}
                            size={18}
                          />
                          <Text style={styles.capTitle}>
                            {cap.category?.name || 'Category'}
                          </Text>
                        </View>
                        <View style={styles.capActions}>
                          <Text style={styles.rolloverValue}>{cap.rolloverMode === 'none' ? 'No rollover' : `${formatCurrency(cap.rolloverInCents, currencyCode)} carried in`}</Text>
                          <Pressable accessibilityLabel={`Edit ${cap.category?.name || 'category'} budget`} accessibilityRole="button" onPress={() => startEditing(cap)} style={styles.deleteButton}>
                            <Pencil color={colors.primary} size={17} />
                          </Pressable>
                          <Pressable accessibilityLabel={`Remove ${cap.category?.name || 'category'} budget`} accessibilityRole="button" onPress={() => confirmRemove(cap)} style={styles.deleteButton}>
                            <Trash2 color={colors.danger} size={18} />
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: overCap
                                ? colors.danger
                                : colors.gold,
                              width: `${Math.round(
                                Math.min(cap.spentAmountCents / Math.max(cap.availableCents, 1), 1) * 100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.capValues}>
                        <Text
                          style={[
                            styles.capSpent,
                            overCap && styles.capSpentOver,
                          ]}
                        >
                          {formatCurrency(cap.spentAmountCents, currencyCode)} spent
                        </Text>
                        <Text style={styles.capLimit}>
                          {formatCurrency(cap.availableCents, currencyCode)} available
                        </Text>
                      </View>
                    </View>
                    {index < caps.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                );
              })}
              {caps.length === 0 ? (
                <Text style={styles.emptyLabel}>No category budgets for this month yet.</Text>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
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
    gap: spacing.xxl,
  },
  section: { gap: spacing.lg },
  editingNotice: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editingLabel: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  cancelEditButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.section, color: colors.ink },
  monthNavigation: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { ...typography.section, color: colors.ink },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.ink },
  rolloverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rolloverOption: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolloverOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rolloverLabel: { ...typography.caption, color: colors.inkMuted },
  rolloverLabelSelected: { color: colors.primary, fontWeight: '700' },
  futureRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  futureCopy: { flex: 1, gap: spacing.xs },
  futureBody: { ...typography.caption, color: colors.inkMuted },
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
  swatch: { width: 10, height: 10, borderRadius: radius.round },
  categoryLabel: {
    ...typography.caption,
    color: colors.ink,
    flexShrink: 1,
  },
  categoryLabelSelected: { color: colors.primary, fontWeight: '700' },
  errorText: { ...typography.caption, color: colors.danger },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  capRow: { minHeight: 112, paddingVertical: spacing.lg, gap: spacing.md },
  capHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  capTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capTitle: { ...typography.label, color: colors.ink },
  rolloverValue: { ...typography.caption, color: colors.inkMuted, textAlign: 'right' },
  capActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.sm },
  capValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  capSpent: { ...typography.caption, color: colors.ink },
  capSpentOver: { color: colors.danger, fontWeight: '700' },
  capLimit: { ...typography.caption, color: colors.inkMuted },
  divider: { height: 1, backgroundColor: colors.border },
  emptyLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
