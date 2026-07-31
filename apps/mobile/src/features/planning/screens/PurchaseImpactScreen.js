import { useFocusEffect } from '@react-navigation/native';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { getDashboardSummary } from '../../dashboard/services/dashboardService';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../../finance/services/financeService';
import { parseAmountToCents } from '../../finance/utils/financeValidation.cjs';
import { getBudgetCaps } from '../services/planningService';
import { calculatePurchaseImpact } from '../utils/purchaseImpactMath.cjs';

const tonePalettes = {
  success: {
    background: colors.successSoft,
    foreground: colors.success,
    icon: CheckCircle2,
  },
  warning: {
    background: colors.warningSoft,
    foreground: colors.warning,
    icon: TriangleAlert,
  },
  danger: {
    background: colors.dangerSoft,
    foreground: colors.danger,
    icon: ShieldAlert,
  },
};

function ImpactMetric({ label, value, detail, isLast = false }) {
  return (
    <View style={[styles.metric, !isLast && styles.metricBorder]}>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
      </View>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={styles.metricValue}
      >
        {value}
      </Text>
    </View>
  );
}

export function PurchaseImpactScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [budgetCaps, setBudgetCaps] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showValidation, setShowValidation] = useState(false);

  const loadImpactData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [nextSummary, nextCategories, nextBudgetCaps] = await Promise.all([
        getDashboardSummary(user.id, null),
        ensureExpenseCategories(user.id),
        getBudgetCaps(user.id),
      ]);
      setSummary(nextSummary);
      setCategories(nextCategories);
      setBudgetCaps(nextBudgetCaps);
      setCategoryId((current) => {
        const stillExists = nextCategories.some(
          (category) => category.id === current,
        );
        return stillExists ? current : nextCategories[0]?.id || '';
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to calculate purchase impact.');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadImpactData();
    }, [loadImpactData]),
  );

  const amountCents = parseAmountToCents(amount);
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  const selectedCap = budgetCaps.find(
    (cap) => cap.category_id === categoryId,
  );
  const impact = useMemo(() => {
    if (!summary || amountCents === null) {
      return null;
    }

    return calculatePurchaseImpact({
      amountCents,
      incomeCents: summary.incomeCents,
      availableCents: summary.availableCents,
      spendableCents: summary.spendableCents,
      safeToSpendCents: summary.safeToSpendCents,
      daysRemaining: summary.daysUntilReset,
      shortfallCents: summary.shortfallCents,
      budgetCap: selectedCap,
    });
  }, [amountCents, selectedCap, summary]);

  function handleContinue() {
    setShowValidation(true);

    if (!impact || !categoryId) {
      return;
    }

    navigation.navigate('OneTimeExpense', {
      currencyCode,
      prefill: {
        amountCents: impact.amountCents,
        categoryId,
        merchant: merchant.trim(),
      },
    });
  }

  const amountError =
    showValidation && amountCents === null
      ? 'Enter an amount greater than zero with up to two decimals.'
      : '';
  const palette = impact ? tonePalettes[impact.tone] : null;
  const DecisionIcon = palette?.icon;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <ScreenHeader
              onBack={navigation.goBack}
              subtitle="Preview the effect before spending"
              title="Check a purchase"
            />

            <InlineNotice message={error} variant="error" />
            {error ? (
              <AppButton
                isLoading={isLoading}
                label="Try again"
                onPress={loadImpactData}
                variant="secondary"
              />
            ) : null}

            <View style={styles.form}>
              <FormField
                error={amountError}
                keyboardType="decimal-pad"
                label="Purchase amount"
                onChangeText={(value) => {
                  setAmount(value);
                  setShowValidation(false);
                }}
                placeholder="0.00"
                value={amount}
              />
              <FormField
                label="Merchant or purchase (optional)"
                maxLength={100}
                onChangeText={setMerchant}
                placeholder="Groceries, shoes, concert tickets"
                value={merchant}
              />

              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeading}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('BudgetCaps', { currencyCode })
                    }
                    style={styles.manageButton}
                  >
                    <Text style={styles.manageLabel}>Manage caps</Text>
                    <ChevronRight color={colors.primary} size={16} />
                  </Pressable>
                </View>
                {isLoading ? (
                  <Text style={styles.helperText}>Loading your plan...</Text>
                ) : (
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
                              styles.categorySwatch,
                              {
                                backgroundColor:
                                  category.color || colors.inkMuted,
                              },
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
                )}
              </View>
            </View>

            <View style={styles.impactSection}>
              <Text style={styles.sectionTitle}>Purchase impact</Text>
              {impact ? (
                <>
                  <View
                    style={[
                      styles.decision,
                      { backgroundColor: palette.background },
                    ]}
                  >
                    <DecisionIcon color={palette.foreground} size={22} />
                    <View style={styles.decisionCopy}>
                      <Text
                        style={[
                          styles.decisionTitle,
                          { color: palette.foreground },
                        ]}
                      >
                        {impact.label}
                      </Text>
                      <Text style={styles.decisionDetail}>{impact.detail}</Text>
                    </View>
                  </View>

                  <View style={styles.metrics}>
                    <ImpactMetric
                      detail="Income minus recorded spending"
                      label="Available after"
                      value={formatCurrency(
                        impact.projectedAvailableCents,
                        currencyCode,
                      )}
                    />
                    <ImpactMetric
                      detail="After bills and savings are protected"
                      label="Flexible money after"
                      value={formatCurrency(
                        impact.projectedSpendableCents,
                        currencyCode,
                      )}
                    />
                    <ImpactMetric
                      detail={`Across ${summary.daysUntilReset} remaining ${summary.daysUntilReset === 1 ? 'day' : 'days'}`}
                      label="Safe per day after"
                      value={formatCurrency(
                        impact.projectedSafeToSpendCents,
                        currencyCode,
                      )}
                    />
                    <ImpactMetric
                      detail={
                        selectedCap
                          ? `${formatCurrency(impact.projectedCategorySpentCents, currencyCode)} of ${formatCurrency(selectedCap.amount_cents, currencyCode)} used`
                          : 'No monthly cap set for this category'
                      }
                      isLast
                      label={selectedCategory?.name || 'Category'}
                      value={
                        selectedCap
                          ? formatCurrency(
                              impact.projectedCategoryRemainingCents,
                              currencyCode,
                            )
                          : 'No cap'
                      }
                    />
                  </View>

                  {impact.reductionCents > 0 ? (
                    <InlineNotice
                      message={`To stay inside your current plan, keep this purchase at or below ${formatCurrency(impact.maxWithinPlanCents, currencyCode)}.`}
                      variant="info"
                    />
                  ) : null}
                </>
              ) : (
                <View style={styles.emptyImpact}>
                  <Text style={styles.emptyImpactTitle}>Enter an amount</Text>
                  <Text style={styles.emptyImpactDetail}>
                    The impact updates here without saving anything.
                  </Text>
                </View>
              )}
            </View>

            <AppButton
              disabled={isLoading || Boolean(error)}
              icon={Check}
              label="Continue to record expense"
              onPress={handleContinue}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    maxWidth: 680,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  categoryBlock: {
    gap: spacing.sm,
  },
  categoryHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.ink,
  },
  manageButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manageLabel: {
    ...typography.caption,
    color: colors.primary,
  },
  helperText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    maxWidth: '100%',
    minHeight: 40,
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
    borderColor: colors.ink,
    backgroundColor: colors.surfaceMuted,
  },
  categorySwatch: {
    width: 10,
    height: 10,
    borderRadius: radius.round,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    maxWidth: 150,
  },
  categoryLabelSelected: {
    color: colors.ink,
    fontWeight: '700',
  },
  impactSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  decision: {
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  decisionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  decisionTitle: {
    ...typography.label,
    fontSize: 16,
  },
  decisionDetail: {
    ...typography.caption,
    color: colors.ink,
  },
  metrics: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  metric: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  metricBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  metricLabel: {
    ...typography.label,
    color: colors.ink,
  },
  metricDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  metricValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.ink,
    maxWidth: 140,
    textAlign: 'right',
  },
  emptyImpact: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyImpactTitle: {
    ...typography.label,
    color: colors.ink,
  },
  emptyImpactDetail: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
