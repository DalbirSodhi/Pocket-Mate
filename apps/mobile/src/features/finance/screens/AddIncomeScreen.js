import { Banknote, Check } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { createIncomeEntry } from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateEntry,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function AddIncomeScreen({ navigation }) {
  const { user } = useAuthSession();
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const nextErrors = validateEntry({ amount, date });
    setErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await createIncomeEntry({
        userId: user.id,
        amountCents: parseAmountToCents(amount),
        source,
        receivedOn: date,
        note,
      });
      navigation.goBack();
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to save this income entry.'),
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
              subtitle="Record money received"
              title="Add income"
            />

            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Banknote color={colors.primary} size={24} />
              </View>
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>
                  Increase this month&apos;s available money
                </Text>
                <Text style={styles.introBody}>
                  Add salary, freelance work, refunds, or any other income.
                </Text>
              </View>
            </View>

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
              <FormField
                label="Source"
                maxLength={80}
                onChangeText={setSource}
                placeholder="Salary, freelance, refund"
                value={source}
              />
              <FormField
                autoCapitalize="none"
                error={errors.date}
                keyboardType="numbers-and-punctuation"
                label="Date received"
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
              icon={Check}
              isLoading={isSaving}
              label="Save income"
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
    minHeight: 96,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  introTitle: {
    ...typography.label,
    color: colors.ink,
  },
  introBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  form: {
    gap: spacing.lg,
  },
});
