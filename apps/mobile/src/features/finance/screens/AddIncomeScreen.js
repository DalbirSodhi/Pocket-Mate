import { useFocusEffect } from '@react-navigation/native';
import { Banknote, Check } from 'lucide-react-native';
import { useCallback, useState } from 'react';
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
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { getOfflineMutationMessage } from '../../../infrastructure/network/errorClassifier.cjs';
import { useNetworkStatus } from '../../../infrastructure/network';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { AccountPicker, getAccounts } from '../../accounts';
import {
  createIncomeEntry,
  getIncomeDetail,
  updateIncomeEntry,
} from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateEntry,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

function formatAmount(amountCents) {
  return (Number(amountCents || 0) / 100).toFixed(2);
}

export function AddIncomeScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { isOffline } = useNetworkStatus();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const incomeId = route.params?.incomeId;
  const isEditing = Boolean(incomeId);
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  const loadIncome = useCallback(async () => {
    setRequestError('');

    try {
      const [nextAccounts, income] = await Promise.all([
        getAccounts(user.id),
        incomeId
          ? getIncomeDetail({ userId: user.id, incomeId })
          : Promise.resolve(null),
      ]);
      setAccounts(nextAccounts.filter((account) => account.is_active && account.isAsset));
      if (income) {
        setAmount(formatAmount(income.amount_cents));
        setSource(income.source || '');
        setDate(income.received_on);
        setNote(income.note || '');
        setAccountId(income.account_id || '');
      }
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to load this income entry.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [incomeId, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadIncome();
    }, [loadIncome]),
  );

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const nextErrors = validateEntry({ amount, date });
    setErrors(nextErrors);
    setRequestError('');

    if (isOffline) {
      setRequestError(getOfflineMutationMessage('save income'));
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      const entry = {
        userId: user.id,
        accountId,
        amountCents: parseAmountToCents(amount),
        source,
        receivedOn: date,
        note,
      };

      if (isEditing) {
        await updateIncomeEntry({ ...entry, incomeId });
      } else {
        await createIncomeEntry(entry);
      }
      navigation.goBack();
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to save this income entry.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingScreen message="Loading income entry..." />;
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
              subtitle={isEditing ? 'Correct money received' : 'Record money received'}
              title={isEditing ? 'Edit income' : 'Add income'}
            />

            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Banknote color={colors.primary} size={24} />
              </View>
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>
                  {isEditing
                    ? 'Keep your monthly totals accurate'
                    : 'Increase this month\'s available money'}
                </Text>
                <Text style={styles.introBody}>
                  {isEditing
                    ? 'Changes update your activity, balance, and monthly plan.'
                    : 'Add salary, freelance work, refunds, or any other income.'}
                </Text>
              </View>
            </View>

            <InlineNotice message={requestError} variant="error" />
            <InlineNotice
              message={
                isOffline
                  ? 'You can review this income entry offline. Saving needs a connection.'
                  : ''
              }
              variant="warning"
            />

            <View style={styles.form}>
              {accounts.length ? (
                <AccountPicker
                  accounts={accounts}
                  currencyCode={currencyCode}
                  label="Deposit to"
                  onSelect={setAccountId}
                  selectedId={accountId}
                />
              ) : null}
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
              label={isEditing ? 'Save changes' : 'Save income'}
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
