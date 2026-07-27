import { Check, Tags } from 'lucide-react-native';
import { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import {
  createExpenseEntry,
  ensureExpenseCategories,
} from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateEntry,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function OneTimeExpenseScreen({ navigation }) {
  const { user } = useAuthSession();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setRequestError('');

    try {
      const nextCategories = await ensureExpenseCategories(user.id);
      setCategories(nextCategories);
      setCategoryId((current) => {
        const stillExists = nextCategories.some((category) => category.id === current);
        return stillExists ? current : nextCategories[0]?.id || '';
      });
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to load expense categories.'),
      );
    } finally {
      setIsLoadingCategories(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories]),
  );

  async function handleSave() {
    const nextErrors = validateEntry({ amount, date });

    if (!categoryId) {
      nextErrors.category = 'Choose an expense category.';
    }

    setErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await createExpenseEntry({
        userId: user.id,
        categoryId,
        amountCents: parseAmountToCents(amount),
        spentOn: date,
        merchant,
        note,
      });
      navigation.popTo('Dashboard');
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to save this expense.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

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
              subtitle="Record where money went"
              title="One-time expense"
            />

            <InlineNotice message={requestError} variant="error" />

            <View style={styles.form}>
              <FormField
                error={errors.amount}
                keyboardType="decimal-pad"
                label="Amount"
                onChangeText={setAmount}
                placeholder="0.00"
                value={amount}
              />

              <View style={styles.categoryBlock}>
                <View style={styles.categoryHeading}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('Categories')}
                    style={styles.manageButton}
                  >
                    <Tags color={colors.primary} size={16} />
                    <Text style={styles.manageLabel}>Manage</Text>
                  </Pressable>
                </View>
                {isLoadingCategories ? (
                  <Text style={styles.helperText}>Loading categories...</Text>
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
                )}
                {errors.category ? (
                  <Text style={styles.errorText}>{errors.category}</Text>
                ) : null}
              </View>

              <FormField
                label="Merchant"
                maxLength={100}
                onChangeText={setMerchant}
                placeholder="Grocery store, landlord, coffee shop"
                value={merchant}
              />
              <FormField
                autoCapitalize="none"
                error={errors.date}
                keyboardType="numbers-and-punctuation"
                label="Date spent"
                maxLength={10}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                value={date}
              />
              <FormField
                label="Note (optional)"
                maxLength={240}
                multiline
                numberOfLines={3}
                onChangeText={setNote}
                placeholder="Add any useful context"
                value={note}
              />
            </View>

            <AppButton
              disabled={isLoadingCategories}
              icon={Check}
              isLoading={isSaving}
              label="Save expense"
              onPress={handleSave}
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
    maxWidth: 640,
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
    minHeight: 24,
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
    ...typography.label,
    color: colors.primary,
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
  helperText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});
