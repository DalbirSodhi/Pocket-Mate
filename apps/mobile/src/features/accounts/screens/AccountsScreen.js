import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowRightLeft,
  CreditCard,
  Landmark,
  Plus,
  Power,
  RotateCcw,
  Scale,
  Wallet,
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
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  getLocalDateString,
  isValidDateString,
  parseAmountToCents,
  validateEntry,
} from '../../finance/utils/financeValidation.cjs';
import { AccountPicker } from '../components/AccountPicker';
import {
  createAccount,
  createAccountBalanceAdjustment,
  createAccountTransfer,
  deleteAccountBalanceAdjustment,
  getAccountBalanceAdjustments,
  getAccounts,
  setAccountActive,
} from '../services/accountService';
import { parseBalanceToCents, summarizeAccounts } from '../utils/accountMath.cjs';

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Checking' },
  { id: 'savings', label: 'Savings' },
  { id: 'cash', label: 'Cash' },
  { id: 'investment', label: 'Investment' },
  { id: 'loan', label: 'Loan' },
  { id: 'other', label: 'Other' },
];

function accountIcon(type) {
  if (type === 'credit_card') return CreditCard;
  if (type === 'cash') return Wallet;
  return Landmark;
}

export function AccountsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [accounts, setAccounts] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [mode, setMode] = useState('list');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [openingBalance, setOpeningBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [reconcileAccountId, setReconcileAccountId] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [adjustedOn, setAdjustedOn] = useState(getLocalDateString());
  const [reconcileNote, setReconcileNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setRequestError('');
    try {
      const [nextAccounts, nextAdjustments] = await Promise.all([
        getAccounts(user.id),
        getAccountBalanceAdjustments(user.id),
      ]);
      setAccounts(nextAccounts);
      setAdjustments(nextAdjustments);
      const active = nextAccounts.filter((account) => account.is_active);
      setFromAccountId((current) => active.some((a) => a.id === current) ? current : active[0]?.id || '');
      setToAccountId((current) => active.some((a) => a.id === current) ? current : active[1]?.id || '');
    } catch (error) {
      setRequestError(error.message || 'Unable to load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { loadAccounts(); }, [loadAccounts]));

  const activeAccounts = accounts.filter((account) => account.is_active);
  const totals = useMemo(() => summarizeAccounts(accounts), [accounts]);
  const reconcileAccount = accounts.find(
    (account) => account.id === reconcileAccountId,
  );
  const reconcileHistory = adjustments.filter(
    (adjustment) => adjustment.account_id === reconcileAccountId,
  );

  function openReconcile(account) {
    setReconcileAccountId(account.id);
    setActualBalance((account.balanceCents / 100).toFixed(2));
    setAdjustedOn(getLocalDateString());
    setReconcileNote('');
    setErrors({});
    setRequestError('');
    setMode('reconcile');
  }

  async function handleAddAccount() {
    const nextErrors = {};
    const openingBalanceCents = openingBalance ? parseAmountToCents(openingBalance) : 0;
    if (name.trim().length < 2) nextErrors.name = 'Enter a clear account name.';
    if (openingBalance && openingBalanceCents === null) nextErrors.openingBalance = 'Enter a valid amount.';
    if (lastFour && !/^\d{4}$/.test(lastFour)) nextErrors.lastFour = 'Enter exactly four digits.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    try {
      await createAccount({
        userId: user.id,
        name,
        accountType,
        openingBalanceCents: openingBalanceCents || 0,
        currencyCode,
        institutionName: institution,
        lastFour,
      });
      setName(''); setOpeningBalance(''); setInstitution(''); setLastFour('');
      setMode('list');
      await loadAccounts();
    } catch (error) {
      setRequestError(error.message || 'Unable to add this account.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTransfer() {
    const nextErrors = validateEntry({ amount: transferAmount, date: transferDate });
    if (!fromAccountId) nextErrors.from = 'Choose the account money leaves.';
    if (!toAccountId) nextErrors.to = 'Choose the account money enters.';
    if (fromAccountId && fromAccountId === toAccountId) nextErrors.to = 'Choose a different destination account.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    try {
      await createAccountTransfer({
        userId: user.id,
        fromAccountId,
        toAccountId,
        amountCents: parseAmountToCents(transferAmount),
        transferredOn: transferDate,
        note,
      });
      setTransferAmount(''); setNote(''); setMode('list');
      await loadAccounts();
    } catch (error) {
      setRequestError(error.message || 'Unable to record this transfer.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReconcile() {
    const nextErrors = {};
    const resultingBalanceCents = parseBalanceToCents(actualBalance);

    if (!reconcileAccount) nextErrors.account = 'Choose an account to reconcile.';
    if (resultingBalanceCents === null) {
      nextErrors.balance = 'Enter a balance with up to two decimals.';
    } else if (reconcileAccount?.isLiability && resultingBalanceCents < 0) {
      nextErrors.balance = 'An amount owed cannot be negative.';
    }
    if (!isValidDateString(adjustedOn)) {
      nextErrors.date = 'Use a valid date in YYYY-MM-DD format.';
    }

    const amountDeltaCents =
      resultingBalanceCents === null || !reconcileAccount
        ? 0
        : resultingBalanceCents - reconcileAccount.balanceCents;
    if (!nextErrors.balance && amountDeltaCents === 0) {
      nextErrors.balance = 'This already matches the calculated balance.';
    }

    setErrors(nextErrors);
    setRequestError('');
    if (Object.keys(nextErrors).length) return;

    setIsSaving(true);
    try {
      await createAccountBalanceAdjustment({
        userId: user.id,
        accountId: reconcileAccount.id,
        amountDeltaCents,
        resultingBalanceCents,
        adjustedOn,
        note: reconcileNote,
      });
      setMode('list');
      await loadAccounts();
    } catch (error) {
      setRequestError(error.message || 'Unable to reconcile this account.');
    } finally {
      setIsSaving(false);
    }
  }

  async function undoAdjustment(adjustmentId) {
    setRequestError('');
    try {
      await deleteAccountBalanceAdjustment({
        userId: user.id,
        adjustmentId,
      });
      await loadAccounts();
    } catch (error) {
      setRequestError(error.message || 'Unable to undo this balance correction.');
    }
  }

  if (isLoading) return <LoadingScreen message="Loading accounts..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <ScreenHeader onBack={navigation.goBack} subtitle="Balances, debt, and money movement" title="Accounts" />
            <InlineNotice message={requestError} variant="error" />

            <View style={styles.summary}>
              <View><Text style={styles.summaryLabel}>Assets</Text><Text style={styles.summaryValue}>{formatCurrency(totals.assetCents, currencyCode)}</Text></View>
              <View><Text style={styles.summaryLabel}>Debt</Text><Text style={styles.summaryValue}>{formatCurrency(totals.liabilityCents, currencyCode)}</Text></View>
              <View><Text style={styles.summaryLabel}>Net worth</Text><Text style={styles.summaryValue}>{formatCurrency(totals.netWorthCents, currencyCode)}</Text></View>
            </View>

            {mode === 'list' ? (
              <>
                <View style={styles.actions}>
                  <AppButton icon={Plus} label="Add account" onPress={() => setMode('add')} style={styles.action} />
                  <AppButton disabled={activeAccounts.length < 2} icon={ArrowRightLeft} label="Transfer" onPress={() => setMode('transfer')} style={styles.action} variant="secondary" />
                </View>
                <View style={styles.list}>
                  {accounts.length ? accounts.map((account, index) => {
                    const Icon = accountIcon(account.account_type);
                    return (
                      <View key={account.id}>
                        <View style={styles.row}>
                          <View style={styles.icon}><Icon color={colors.iconInk} size={20} /></View>
                          <View style={styles.rowCopy}>
                            <Text style={styles.rowTitle}>{account.name}</Text>
                            <Text style={styles.rowBody}>{account.account_type.replace('_', ' ')}{account.last_four ? ` • ${account.last_four}` : ''}</Text>
                          </View>
                          <Text style={styles.balance}>{formatCurrency(account.balanceCents, currencyCode)}</Text>
                          <Pressable accessibilityLabel={`Reconcile ${account.name}`} accessibilityRole="button" onPress={() => openReconcile(account)} style={styles.powerButton}>
                            <Scale color={colors.primary} size={18} />
                          </Pressable>
                          {account.account_type !== 'credit_card' ? (
                            <Pressable accessibilityLabel={account.is_active ? `Archive ${account.name}` : `Restore ${account.name}`} accessibilityRole="button" onPress={async () => { await setAccountActive({ userId: user.id, accountId: account.id, isActive: !account.is_active }); await loadAccounts(); }} style={styles.powerButton}>
                              <Power color={account.is_active ? colors.success : colors.inkMuted} size={18} />
                            </Pressable>
                          ) : null}
                        </View>
                        {index < accounts.length - 1 ? <View style={styles.divider} /> : null}
                      </View>
                    );
                  }) : <InlineNotice message="Add checking, savings, cash, or loan accounts to see actual balances. Credit-card accounts are created automatically with saved cards." variant="info" />}
                </View>
              </>
            ) : null}

            {mode === 'add' ? (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>Add account</Text>
                <View style={styles.typeGrid}>{ACCOUNT_TYPES.map((type) => <Pressable accessibilityRole="button" accessibilityState={{ selected: accountType === type.id }} key={type.id} onPress={() => setAccountType(type.id)} style={[styles.type, accountType === type.id && styles.typeSelected]}><Text style={[styles.typeLabel, accountType === type.id && styles.typeLabelSelected]}>{type.label}</Text></Pressable>)}</View>
                <FormField error={errors.name} label="Account name" onChangeText={setName} placeholder="Everyday checking" value={name} />
                <FormField error={errors.openingBalance} keyboardType="decimal-pad" label={['loan'].includes(accountType) ? 'Current amount owed' : 'Current balance'} onChangeText={setOpeningBalance} placeholder="0.00" value={openingBalance} />
                <FormField label="Institution (optional)" onChangeText={setInstitution} placeholder="Bank or provider" value={institution} />
                <FormField error={errors.lastFour} keyboardType="number-pad" label="Last four digits (optional)" maxLength={4} onChangeText={setLastFour} placeholder="1234" value={lastFour} />
                <AppButton icon={Plus} isLoading={isSaving} label="Save account" onPress={handleAddAccount} />
                <AppButton label="Cancel" onPress={() => setMode('list')} variant="secondary" />
              </View>
            ) : null}

            {mode === 'transfer' ? (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>Move money</Text>
                <InlineNotice message="Transfers change account balances but never count as income or spending." variant="info" />
                <AccountPicker accounts={activeAccounts} allowUnassigned={false} currencyCode={currencyCode} error={errors.from} label="From" onSelect={setFromAccountId} selectedId={fromAccountId} />
                <AccountPicker accounts={activeAccounts} allowUnassigned={false} currencyCode={currencyCode} error={errors.to} label="To" onSelect={setToAccountId} selectedId={toAccountId} />
                <FormField error={errors.amount} keyboardType="decimal-pad" label="Amount" onChangeText={setTransferAmount} placeholder="0.00" value={transferAmount} />
                <FormField error={errors.date} label="Transfer date" onChangeText={setTransferDate} placeholder="YYYY-MM-DD" value={transferDate} />
                <FormField label="Note (optional)" multiline numberOfLines={3} onChangeText={setNote} placeholder="Why this money moved" value={note} />
                <AppButton icon={ArrowRightLeft} isLoading={isSaving} label="Save transfer" onPress={handleTransfer} />
                <AppButton label="Cancel" onPress={() => setMode('list')} variant="secondary" />
              </View>
            ) : null}

            {mode === 'reconcile' && reconcileAccount ? (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>Reconcile {reconcileAccount.name}</Text>
                <InlineNotice
                  message={`Pocket-Mate calculates ${formatCurrency(reconcileAccount.balanceCents, currencyCode)}. Enter the balance shown by your account so the difference is recorded without changing transaction history.`}
                  variant="info"
                />
                <FormField
                  error={errors.balance || errors.account}
                  keyboardType="numbers-and-punctuation"
                  label={reconcileAccount.isLiability ? 'Current amount owed' : 'Actual current balance'}
                  onChangeText={setActualBalance}
                  placeholder="0.00"
                  value={actualBalance}
                />
                <FormField error={errors.date} label="Balance date" onChangeText={setAdjustedOn} placeholder="YYYY-MM-DD" value={adjustedOn} />
                <FormField label="Reason (optional)" multiline numberOfLines={3} onChangeText={setReconcileNote} placeholder="Statement balance or correction note" value={reconcileNote} />
                <AppButton icon={Scale} isLoading={isSaving} label="Save balance correction" onPress={handleReconcile} />
                <AppButton label="Cancel" onPress={() => setMode('list')} variant="secondary" />

                {reconcileHistory.length ? (
                  <View style={styles.history}>
                    <Text style={styles.sectionTitle}>Correction history</Text>
                    {reconcileHistory.map((adjustment, index) => (
                      <View key={adjustment.id}>
                        <View style={styles.historyRow}>
                          <View style={styles.rowCopy}>
                            <Text style={styles.rowTitle}>
                              Balance set to {formatCurrency(adjustment.resulting_balance_cents, currencyCode)}
                            </Text>
                            <Text style={styles.rowBody}>
                              {adjustment.adjusted_on}{adjustment.note ? ` - ${adjustment.note}` : ''}
                            </Text>
                          </View>
                          <Text style={[styles.adjustmentAmount, adjustment.amount_delta_cents < 0 && styles.adjustmentNegative]}>
                            {adjustment.amount_delta_cents > 0 ? '+' : ''}{formatCurrency(adjustment.amount_delta_cents, currencyCode)}
                          </Text>
                          <Pressable accessibilityLabel="Undo balance correction" accessibilityRole="button" onPress={() => undoAdjustment(adjustment.id)} style={styles.powerButton}>
                            <RotateCcw color={colors.danger} size={18} />
                          </Pressable>
                        </View>
                        {index < reconcileHistory.length - 1 ? <View style={styles.divider} /> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.xl },
  summary: { borderRadius: radius.md, backgroundColor: colors.darkPanel, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { ...typography.caption, color: colors.panelMuted }, summaryValue: { ...typography.section, color: colors.white, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm }, action: { flex: 1 },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.iconSurface, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { ...typography.label, color: colors.ink }, rowBody: { ...typography.caption, color: colors.inkMuted, textTransform: 'capitalize' },
  balance: { ...typography.label, color: colors.ink }, powerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginLeft: 58, backgroundColor: colors.border }, form: { gap: spacing.lg }, sectionTitle: { ...typography.section, color: colors.ink },
  history: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg, gap: spacing.md },
  historyRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adjustmentAmount: { ...typography.label, color: colors.success },
  adjustmentNegative: { color: colors.danger },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, type: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  typeSelected: { borderColor: colors.primary, backgroundColor: colors.infoSoft }, typeLabel: { ...typography.label, color: colors.inkMuted }, typeLabelSelected: { color: colors.primary },
});
