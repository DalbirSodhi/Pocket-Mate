import { useFocusEffect } from '@react-navigation/native';
import { Landmark, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
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

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../../finance/services/financeService';
import { parseAmountToCents } from '../../finance/utils/financeValidation.cjs';
import {
  createBudgetCap,
  deleteBudgetCap,
  getBudgetCaps,
} from '../services/planningService';

export function BudgetCapsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [caps, setCaps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setRequestError('');

    try {
      const [nextCaps, nextCategories] = await Promise.all([
        getBudgetCaps(user.id),
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
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleCreate() {
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
      await createBudgetCap({ userId: user.id, categoryId, amountCents });
      setAmount('');
      await loadData();
    } catch (error) {
      setRequestError(
        error?.code === '23505'
          ? 'This category already has a monthly cap.'
          : error.message || 'Unable to create this budget cap.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(cap) {
    Alert.alert(
      'Remove budget cap?',
      `${cap.category?.name || 'This category'} will no longer have a monthly limit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudgetCap({ userId: user.id, capId: cap.id });
              setCaps((current) => current.filter((item) => item.id !== cap.id));
            } catch (error) {
              setRequestError(error.message || 'Unable to remove this cap.');
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
        keyboardShouldPersistTaps="handled"
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
            subtitle="Set limits for flexible spending"
            title="Budget caps"
          />

          <InlineNotice message={requestError} variant="error" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New monthly cap</Text>
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
            <AppButton
              icon={Plus}
              isLoading={isSaving}
              label="Create budget cap"
              onPress={handleCreate}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current month</Text>
            <View style={styles.list}>
              {caps.map((cap, index) => {
                const overCap = cap.spentCents > cap.amount_cents;

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
                        <Pressable
                          accessibilityLabel={`Remove ${cap.category?.name || 'category'} cap`}
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => confirmDelete(cap)}
                          style={styles.deleteButton}
                        >
                          <Trash2 color={colors.danger} size={18} />
                        </Pressable>
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
                                Math.min(cap.usageRatio, 1) * 100,
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
                          {formatCurrency(cap.spentCents, currencyCode)} spent
                        </Text>
                        <Text style={styles.capLimit}>
                          {formatCurrency(cap.amount_cents, currencyCode)} cap
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
                <Text style={styles.emptyLabel}>No budget caps yet.</Text>
              ) : null}
            </View>
          </View>
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
    gap: spacing.xxl,
  },
  section: { gap: spacing.lg },
  sectionTitle: { ...typography.section, color: colors.ink },
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
