import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock, Check, Tags } from 'lucide-react-native';
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

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import {
  createRecurringExpense,
  ensureExpenseCategories,
} from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateEntry,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function RecurringExpenseScreen({ navigation }) {
  const { user } = useAuthSession();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startsOn, setStartsOn] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setRequestError('');
    setIsLoadingCategories(true);

    try {
      const nextCategories = await ensureExpenseCategories(user.id);
      setCategories(nextCategories);
      setCategoryId((current) =>
        nextCategories.some((category) => category.id === current)
          ? current
          : nextCategories[0]?.id || '',
      );
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
    const nextErrors = validateEntry({ amount, date: startsOn });

    if (!name.trim()) {
      nextErrors.name = 'Enter a name for this monthly expense.';
    }

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
      await createRecurringExpense({
        userId: user.id,
        categoryId,
        name,
        amountCents: parseAmountToCents(amount),
        startsOn,
        note,
      });
      navigation.popToTop();
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to save this monthly expense.'),
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
              subtitle="Count it automatically every month"
              title="Monthly fixed expense"
            />

            <View style={styles.intro}>
              <CalendarClock color={colors.primary} size={23} />
              <Text style={styles.introText}>
                This amount is reserved in every monthly plan while the expense
                remains active.
              </Text>
            </View>

            <InlineNotice message={requestError} variant="error" />

            <View style={styles.form}>
              <FormField
                error={errors.name}
                label="Expense name"
                maxLength={80}
                onChangeText={setName}
                placeholder="Rent, internet, gym membership"
                value={name}
              />
              <FormField
                error={errors.amount}
                keyboardType="decimal-pad"
                label="Monthly amount"
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
                autoCapitalize="none"
                error={errors.date}
                keyboardType="numbers-and-punctuation"
                label="Starts on"
                maxLength={10}
                onChangeText={setStartsOn}
                placeholder="YYYY-MM-DD"
                value={startsOn}
              />
              <Text style={styles.dateHint}>
                The day in this date becomes the monthly charge day.
              </Text>
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
              label="Save monthly expense"
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
  intro: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  introText: {
    ...typography.caption,
    color: colors.ink,
    flex: 1,
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
  dateHint: {
    ...typography.caption,
    color: colors.inkMuted,
    marginTop: -spacing.md,
  },
});
