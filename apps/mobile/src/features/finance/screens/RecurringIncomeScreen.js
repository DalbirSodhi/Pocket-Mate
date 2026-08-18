import { useFocusEffect } from '@react-navigation/native';
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountPicker, getAccounts } from '../../accounts';
import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  createRecurringIncomeSchedule,
  deleteRecurringIncomeSchedule,
  getRecurringIncomeSchedules,
  recordRecurringIncomeOccurrence,
  setRecurringIncomeScheduleActive,
  updateRecurringIncomeSchedule,
} from '../services/recurringIncomeService';
import {
  getLocalDateString,
  isValidDateString,
  parseAmountToCents,
  validateEntry,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

const CADENCE_OPTIONS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Biweekly' },
  { id: 'semi_monthly', label: 'Twice monthly' },
  { id: 'monthly', label: 'Monthly' },
];

function cadenceLabel(value) {
  return CADENCE_OPTIONS.find((option) => option.id === value)?.label || 'Monthly';
}

function ChoiceRow({ label, options, selected, onSelect }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[styles.choice, isSelected && styles.choiceSelected]}
            >
              <Text style={[styles.choiceLabel, isSelected && styles.choiceLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function RecurringIncomeScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const occurrenceScheduleId = route.params?.scheduleId;
  const occurrenceOn = route.params?.occurrenceOn;
  const [schedules, setSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cadence, setCadence] = useState('monthly');
  const [nextExpectedOn, setNextExpectedOn] = useState(getLocalDateString());
  const [endsOn, setEndsOn] = useState('');
  const [note, setNote] = useState('');
  const [receivedOn, setReceivedOn] = useState(getLocalDateString());
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      const [nextSchedules, nextAccounts] = await Promise.all([
        getRecurringIncomeSchedules(user.id),
        getAccounts(user.id),
      ]);
      setSchedules(nextSchedules);
      setAccounts(nextAccounts.filter((account) => account.is_active && account.isAsset));
    } catch (requestError) {
      setError(getFinanceErrorMessage(requestError, 'Unable to load recurring income.'));
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const occurrenceSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === occurrenceScheduleId),
    [occurrenceScheduleId, schedules],
  );

  function resetForm() {
    setEditingId('');
    setSource('');
    setAmount('');
    setAccountId('');
    setCadence('monthly');
    setNextExpectedOn(getLocalDateString());
    setEndsOn('');
    setNote('');
    setErrors({});
    setIsFormVisible(false);
  }

  function startEdit(schedule) {
    setEditingId(schedule.id);
    setSource(schedule.source);
    setAmount((schedule.amount_cents / 100).toFixed(2));
    setAccountId(schedule.account_id || '');
    setCadence(schedule.cadence);
    setNextExpectedOn(schedule.next_expected_on);
    setEndsOn(schedule.ends_on || '');
    setNote(schedule.note || '');
    setErrors({});
    setError('');
    setIsFormVisible(true);
  }

  function validateForm() {
    const nextErrors = validateEntry({ amount, date: nextExpectedOn });
    if (!source.trim()) nextErrors.source = 'Enter a source such as salary or freelance work.';
    if (endsOn && !isValidDateString(endsOn)) nextErrors.endsOn = 'Use a valid date in YYYY-MM-DD format.';
    if (endsOn && isValidDateString(nextExpectedOn) && endsOn < nextExpectedOn) nextErrors.endsOn = 'End date cannot be before the next expected date.';
    setErrors(nextErrors);
    return nextErrors;
  }

  async function handleSave() {
    if (isSaving || Object.keys(validateForm()).length > 0) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        source,
        amountCents: parseAmountToCents(amount),
        accountId,
        cadence,
        nextExpectedOn,
        endsOn,
        note,
      };
      if (editingId) await updateRecurringIncomeSchedule({ scheduleId: editingId, ...payload });
      else await createRecurringIncomeSchedule(payload);
      resetForm();
      await load();
    } catch (requestError) {
      setError(getFinanceErrorMessage(requestError, 'Unable to save this income schedule.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleSchedule(schedule) {
    setError('');
    try {
      await setRecurringIncomeScheduleActive({ scheduleId: schedule.id, isActive: !schedule.is_active });
      setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, is_active: !item.is_active } : item));
    } catch (requestError) {
      setError(getFinanceErrorMessage(requestError, 'Unable to update this income schedule.'));
    }
  }

  function confirmDelete(schedule) {
    const message = `Future ${schedule.source} projections will be removed. Received income stays in activity.`;
    const remove = async () => {
      try {
        await deleteRecurringIncomeSchedule(schedule.id);
        setSchedules((current) => current.filter((item) => item.id !== schedule.id));
        if (editingId === schedule.id) resetForm();
      } catch (requestError) {
        setError(getFinanceErrorMessage(requestError, 'Unable to delete this income schedule.'));
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(message)) remove();
      return;
    }

    Alert.alert(
      'Delete income schedule?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: remove,
        },
      ],
    );
  }

  async function handleRecordOccurrence() {
    if (!occurrenceSchedule || !occurrenceOn || isRecording) return;
    if (!isValidDateString(receivedOn)) {
      setError('Enter the received date as YYYY-MM-DD.');
      return;
    }
    setIsRecording(true);
    setError('');
    try {
      await recordRecurringIncomeOccurrence({
        scheduleId: occurrenceSchedule.id,
        expectedOn: occurrenceOn,
        receivedOn,
      });
      navigation.goBack();
    } catch (requestError) {
      setError(getFinanceErrorMessage(requestError, 'Unable to record this income occurrence.'));
    } finally {
      setIsRecording(false);
    }
  }

  if (isInitialLoading && !schedules.length) return <LoadingScreen message="Loading income plans..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl onRefresh={load} refreshing={isRefreshing} tintColor={colors.primary} />}
        >
          <View style={styles.content}>
            <ScreenHeader
              action={(
                <Pressable accessibilityLabel="Add recurring income" accessibilityRole="button" onPress={() => { setIsFormVisible(true); setError(''); }} style={styles.headerButton}>
                  <Plus color={colors.primary} size={21} />
                </Pressable>
              )}
              onBack={navigation.goBack}
              subtitle="Plan paychecks without entering them every time"
              title="Income plans"
            />
            <InlineNotice message={error} variant="error" />

            {occurrenceSchedule && occurrenceOn ? (
              <View style={styles.receiptPanel}>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelEyebrow}>PROJECTED INCOME</Text>
                  <Text style={styles.panelTitle}>{occurrenceSchedule.source}</Text>
                  <Text style={styles.panelBody}>Expected {occurrenceOn} - {formatCurrency(occurrenceSchedule.amount_cents, currencyCode)}</Text>
                </View>
                <FormField label="Received on" onChangeText={setReceivedOn} value={receivedOn} />
                <AppButton icon={Check} isLoading={isRecording} label="Mark received" onPress={handleRecordOccurrence} />
              </View>
            ) : null}

            {isFormVisible ? (
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>{editingId ? 'Edit income plan' : 'New income plan'}</Text>
                <FormField error={errors.source} label="Source" maxLength={80} onChangeText={setSource} placeholder="Salary, freelance, benefits" value={source} />
                <FormField error={errors.amount} keyboardType="decimal-pad" label="Expected amount" onChangeText={setAmount} placeholder="0.00" value={amount} />
                {accounts.length ? <AccountPicker accounts={accounts} currencyCode={currencyCode} label="Deposit account (optional)" onSelect={setAccountId} selectedId={accountId} /> : null}
                <ChoiceRow label="Cadence" options={CADENCE_OPTIONS} selected={cadence} onSelect={setCadence} />
                <FormField autoCapitalize="none" error={errors.date} keyboardType="numbers-and-punctuation" label="Next expected date" maxLength={10} onChangeText={setNextExpectedOn} placeholder="YYYY-MM-DD" value={nextExpectedOn} />
                <FormField autoCapitalize="none" error={errors.endsOn} keyboardType="numbers-and-punctuation" label="End date (optional)" maxLength={10} onChangeText={setEndsOn} placeholder="YYYY-MM-DD" value={endsOn} />
                <FormField label="Note (optional)" maxLength={240} multiline numberOfLines={3} onChangeText={setNote} placeholder="Payday details" value={note} />
                <View style={styles.formActions}>
                  <AppButton icon={Check} isLoading={isSaving} label={editingId ? 'Save changes' : 'Create plan'} onPress={handleSave} />
                  <AppButton label="Cancel" onPress={resetForm} variant="secondary" />
                </View>
              </View>
            ) : null}

            <View style={styles.listHeader}>
              <View><Text style={styles.sectionTitle}>Your income plans</Text><Text style={styles.sectionBody}>Archived plans stay available for reference.</Text></View>
              {!isFormVisible ? <AppButton icon={Plus} label="Add plan" onPress={() => setIsFormVisible(true)} style={styles.smallButton} /> : null}
            </View>

            <View style={styles.list}>
              {schedules.map((schedule, index) => (
                <View key={schedule.id}>
                  <View style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{schedule.source}</Text>
                      <Text style={styles.rowBody}>{formatCurrency(schedule.amount_cents, currencyCode)} - {cadenceLabel(schedule.cadence)} - next {schedule.next_expected_on}</Text>
                      <Text style={styles.rowStatus}>{schedule.is_active ? 'Active' : 'Archived'}</Text>
                    </View>
                    <Pressable accessibilityLabel={`Edit ${schedule.source}`} accessibilityRole="button" onPress={() => startEdit(schedule)} style={styles.iconButton}><Pencil color={colors.primary} size={17} /></Pressable>
                    <Pressable accessibilityLabel={`${schedule.is_active ? 'Archive' : 'Restore'} ${schedule.source}`} accessibilityRole="button" onPress={() => toggleSchedule(schedule)} style={styles.iconButton}>{schedule.is_active ? <Archive color={colors.inkMuted} size={17} /> : <ArchiveRestore color={colors.primary} size={17} />}</Pressable>
                    <Pressable accessibilityLabel={`Delete ${schedule.source}`} accessibilityRole="button" onPress={() => confirmDelete(schedule)} style={styles.iconButton}><Trash2 color={colors.danger} size={17} /></Pressable>
                  </View>
                  {index < schedules.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
              {!schedules.length ? <View style={styles.empty}><Text style={styles.sectionBody}>No income plans yet. Add a paycheck to project future cash flow.</Text></View> : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xl },
  headerButton: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  receiptPanel: { borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing.lg, gap: spacing.lg },
  panelCopy: { gap: spacing.xs }, panelEyebrow: { ...typography.caption, color: colors.info, fontWeight: '700' }, panelTitle: { ...typography.section, color: colors.ink }, panelBody: { ...typography.body, color: colors.inkMuted },
  form: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.xl, gap: spacing.lg },
  sectionTitle: { ...typography.section, color: colors.ink }, sectionBody: { ...typography.caption, color: colors.inkMuted },
  fieldGroup: { gap: spacing.sm }, fieldLabel: { ...typography.label, color: colors.ink }, choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, choice: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' }, choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceLabel: { ...typography.caption, color: colors.inkMuted }, choiceLabelSelected: { color: colors.primary, fontWeight: '700' },
  formActions: { gap: spacing.sm }, smallButton: { minHeight: 42, paddingHorizontal: spacing.md }, listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, row: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, rowCopy: { flex: 1, minWidth: 0, gap: 2 }, rowTitle: { ...typography.label, color: colors.ink }, rowBody: { ...typography.caption, color: colors.inkMuted }, rowStatus: { ...typography.caption, color: colors.primary }, iconButton: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' }, divider: { height: 1, backgroundColor: colors.border }, empty: { minHeight: 100, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
