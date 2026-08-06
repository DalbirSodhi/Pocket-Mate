import { useFocusEffect } from '@react-navigation/native';
import { Plus, RotateCcw, Save, Split, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { AccountPicker, getAccounts } from '../../accounts';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  getLocalDateString,
  isValidDateString,
  parseAmountToCents,
} from '../utils/financeValidation.cjs';
import { assertSplitsMatchParent, getRemainingRefundableCents } from '../utils/transactionMath.cjs';
import { ensureExpenseCategories, getExpenseDetail } from '../services/financeService';
import {
  createExpenseRefund,
  getExpenseAdjustments,
  getTags,
  saveExpenseSplits,
  setExpenseTags,
} from '../services/transactionWorkflowService';

function amountInput(cents) {
  return cents ? (cents / 100).toFixed(2) : '';
}

export function ExpenseAdjustmentsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { expenseId, currencyCode = 'CAD' } = route.params;
  const [expense, setExpense] = useState(null);
  const [adjustments, setAdjustments] = useState({ splits: [], refunds: [], tags: [] });
  const [categories, setCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [mode, setMode] = useState('overview');
  const [splits, setSplits] = useState([]);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(getLocalDateString());
  const [refundAccountId, setRefundAccountId] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [nextExpense, nextAdjustments, nextCategories, nextAccounts, nextTags] = await Promise.all([
        getExpenseDetail({ userId: user.id, expenseId }),
        getExpenseAdjustments({ userId: user.id, expenseId }),
        ensureExpenseCategories(user.id),
        getAccounts(user.id),
        getTags(user.id),
      ]);
      setExpense(nextExpense);
      setAdjustments(nextAdjustments);
      setCategories(nextCategories);
      setAvailableTags(nextTags);
      setSelectedTagIds(nextAdjustments.tags.map((tag) => tag.id));
      const liquid = nextAccounts.filter((account) => account.is_active && ['checking', 'savings', 'cash'].includes(account.account_type));
      setAccounts(liquid);
      setRefundAccountId((current) => liquid.some((account) => account.id === current) ? current : nextExpense.account_id || liquid[0]?.id || '');
      setSplits(nextAdjustments.splits.length
        ? nextAdjustments.splits.map((split) => ({ categoryId: split.category_id, amount: amountInput(split.amount_cents), memo: split.memo || '' }))
        : [
          { categoryId: nextExpense.category_id || nextCategories[0]?.id || '', amount: amountInput(Math.floor(nextExpense.amount_cents / 2)), memo: '' },
          { categoryId: nextCategories.find((category) => category.id !== nextExpense.category_id)?.id || nextExpense.category_id || '', amount: amountInput(nextExpense.amount_cents - Math.floor(nextExpense.amount_cents / 2)), memo: '' },
        ]);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load expense options.');
    } finally {
      setIsLoading(false);
    }
  }, [expenseId, user.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const refundableCents = useMemo(() => {
    if (!expense) return 0;
    try {
      return getRemainingRefundableCents(
        expense.amount_cents,
        adjustments.refunds.map((refund) => refund.amount_cents),
      );
    } catch {
      return 0;
    }
  }, [adjustments.refunds, expense]);

  function updateSplit(index, field, value) {
    setSplits((current) => current.map((split, splitIndex) => splitIndex === index ? { ...split, [field]: value } : split));
  }

  async function handleSaveSplits() {
    setError('');
    try {
      const payload = splits.map((split) => ({
        categoryId: split.categoryId,
        amountCents: parseAmountToCents(split.amount),
        memo: split.memo,
      }));
      assertSplitsMatchParent(expense.amount_cents, payload);
      if (payload.some((split) => !split.categoryId)) throw new Error('Choose a category for every split.');
      if (new Set(payload.map((split) => split.categoryId)).size !== payload.length) {
        throw new Error('Use each category only once.');
      }
      setIsSaving(true);
      await saveExpenseSplits({ expenseId, splits: payload });
      await loadData();
      setMode('overview');
    } catch (requestError) {
      setError(requestError.message || 'Unable to save the split.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefund() {
    setError('');
    const amountCents = parseAmountToCents(refundAmount);
    if (!amountCents || amountCents > refundableCents) {
      setError(`Refund must be between $0.01 and ${formatCurrency(refundableCents, currencyCode)}.`);
      return;
    }
    if (!isValidDateString(refundDate)) {
      setError('Enter the refund date as YYYY-MM-DD.');
      return;
    }
    setIsSaving(true);
    try {
      await createExpenseRefund({ expenseId, amountCents, refundedOn: refundDate, accountId: refundAccountId, note: refundNote });
      setRefundAmount(''); setRefundNote('');
      await loadData();
      setMode('overview');
    } catch (requestError) {
      setError(requestError.message || 'Unable to save this refund.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTags() {
    setIsSaving(true); setError('');
    try {
      await setExpenseTags({ userId: user.id, expenseId, tagIds: selectedTagIds });
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Unable to save tags.');
    } finally { setIsSaving(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading expense options..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ScreenHeader onBack={navigation.goBack} subtitle="Correct category totals without changing income" title="Split and refund" />
          <InlineNotice message={error} variant="error" />
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{expense?.merchant || expense?.category?.name || 'Expense'}</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(expense?.amount_cents || 0, currencyCode)}</Text>
            <Text style={styles.summaryBody}>{formatCurrency(refundableCents, currencyCode)} still refundable</Text>
          </View>

          {mode === 'overview' ? (
            <>
              <View style={styles.actions}>
                <AppButton icon={Split} label={adjustments.splits.length ? 'Edit split' : 'Split expense'} onPress={() => setMode('split')} style={styles.action} variant="secondary" />
                <AppButton disabled={refundableCents === 0} icon={RotateCcw} label="Add refund" onPress={() => setMode('refund')} style={styles.action} variant="secondary" />
              </View>
              {adjustments.splits.length ? <InlineNotice message={`${adjustments.splits.length} category splits reconcile to the original total.`} variant="info" /> : null}
              {availableTags.length ? (
                <View style={styles.form}>
                  <Text style={styles.sectionTitle}>Tags</Text>
                  <View style={styles.categoryRow}>{availableTags.map((tag) => { const selected = selectedTagIds.includes(tag.id); return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={tag.id} onPress={() => setSelectedTagIds((current) => selected ? current.filter((id) => id !== tag.id) : [...current, tag.id])} style={[styles.category, selected && styles.categorySelected]}><Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{tag.name}</Text></Pressable>; })}</View>
                  <AppButton isLoading={isSaving} label="Save tags" onPress={handleSaveTags} variant="secondary" />
                </View>
              ) : null}
              {adjustments.refunds.map((refund) => (
                <View key={refund.id} style={styles.refundRow}>
                  <View><Text style={styles.rowTitle}>Refund received</Text><Text style={styles.rowBody}>{refund.refunded_on}{refund.financial_accounts?.name ? ` • ${refund.financial_accounts.name}` : ''}</Text></View>
                  <Text style={styles.refundAmount}>+{formatCurrency(refund.amount_cents, currencyCode)}</Text>
                </View>
              ))}
            </>
          ) : null}

          {mode === 'split' ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Category split</Text>
              {splits.map((split, index) => (
                <View key={index} style={styles.splitBlock}>
                  <View style={styles.splitHeading}><Text style={styles.rowTitle}>Split {index + 1}</Text>{splits.length > 2 ? <Pressable accessibilityLabel={`Remove split ${index + 1}`} accessibilityRole="button" onPress={() => setSplits((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.iconButton}><Trash2 color={colors.danger} size={18} /></Pressable> : null}</View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{categories.map((category) => { const selected = category.id === split.categoryId; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={category.id} onPress={() => updateSplit(index, 'categoryId', category.id)} style={[styles.category, selected && styles.categorySelected]}><Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{category.name}</Text></Pressable>; })}</ScrollView>
                  <FormField keyboardType="decimal-pad" label="Amount" onChangeText={(value) => updateSplit(index, 'amount', value)} placeholder="0.00" value={split.amount} />
                  <FormField label="Memo (optional)" onChangeText={(value) => updateSplit(index, 'memo', value)} placeholder="What this part covered" value={split.memo} />
                </View>
              ))}
              {splits.length < 8 ? <AppButton icon={Plus} label="Add split" onPress={() => setSplits((current) => [...current, { categoryId: categories[0]?.id || '', amount: '', memo: '' }])} variant="secondary" /> : null}
              <AppButton icon={Save} isLoading={isSaving} label="Save split" onPress={handleSaveSplits} />
              <AppButton label="Cancel" onPress={() => setMode('overview')} variant="secondary" />
            </View>
          ) : null}

          {mode === 'refund' ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Record refund</Text>
              <InlineNotice message="Refunds reduce spending in the original category; they are not income." variant="info" />
              <FormField keyboardType="decimal-pad" label="Refund amount" onChangeText={setRefundAmount} placeholder="0.00" value={refundAmount} />
              <FormField label="Date received" onChangeText={setRefundDate} placeholder="YYYY-MM-DD" value={refundDate} />
              {accounts.length ? <AccountPicker accounts={accounts} currencyCode={currencyCode} label="Returned to" onSelect={setRefundAccountId} selectedId={refundAccountId} /> : null}
              <FormField label="Note (optional)" multiline numberOfLines={3} onChangeText={setRefundNote} placeholder="Return or credit details" value={refundNote} />
              <AppButton icon={RotateCcw} isLoading={isSaving} label="Save refund" onPress={handleRefund} />
              <AppButton label="Cancel" onPress={() => setMode('overview')} variant="secondary" />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.xl },
  summary: { borderRadius: radius.md, backgroundColor: colors.darkPanel, padding: spacing.lg, gap: spacing.xs },
  summaryTitle: { ...typography.label, color: colors.panelMuted }, summaryAmount: { ...typography.title, color: colors.white }, summaryBody: { ...typography.caption, color: colors.panelMuted },
  actions: { flexDirection: 'row', gap: spacing.sm }, action: { flex: 1 }, form: { gap: spacing.lg }, sectionTitle: { ...typography.section, color: colors.ink },
  splitBlock: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg, gap: spacing.md }, splitHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, category: { minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' }, categorySelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, categoryLabel: { ...typography.caption, color: colors.inkMuted }, categoryLabelSelected: { color: colors.primary, fontWeight: '700' },
  refundRow: { minHeight: 68, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, rowTitle: { ...typography.label, color: colors.ink }, rowBody: { ...typography.caption, color: colors.inkMuted }, refundAmount: { ...typography.label, color: colors.success },
});
