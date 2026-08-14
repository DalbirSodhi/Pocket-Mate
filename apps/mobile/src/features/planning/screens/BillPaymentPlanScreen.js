import { useFocusEffect } from '@react-navigation/native';
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Minus,
  Pencil,
  Plus,
  Save,
  Trash2,
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
import { DateField } from '../../../components/DateField';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { getOfflineMutationMessage } from '../../../infrastructure/network/errorClassifier.cjs';
import { useNetworkStatus } from '../../../infrastructure/network';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { AccountPicker, getAccounts } from '../../accounts';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { parseAmountToCents } from '../../finance/utils/financeValidation.cjs';
import {
  getBillPaymentPlan,
  saveBillPaymentPlan,
  setBillPaymentInstallmentPaid,
} from '../services/planningService';
import {
  buildEqualInstallments,
  formatCentsForInput,
  getPaymentPlanWindow,
  hasEqualInstallmentAmounts,
  rebalancePaymentAmounts,
  validatePaymentPlan,
} from '../utils/paymentPlanMath.cjs';

function formatDate(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-').map(Number);

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function PaymentRow({
  installment,
  currencyCode,
  isUpdating,
  onToggle,
}) {
  const isPaid = Boolean(installment.paid_on);
  const Icon = isPaid ? CheckCircle2 : Circle;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isPaid, disabled: isUpdating }}
      disabled={isUpdating}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.paymentRow,
        pressed && styles.paymentRowPressed,
      ]}
    >
      <Icon
        color={isPaid ? colors.success : colors.inkMuted}
        size={22}
      />
      <View style={styles.paymentCopy}>
        <Text style={styles.paymentDate}>{formatDate(installment.planned_on)}</Text>
        <Text style={styles.paymentStatus}>
          {isPaid ? `Paid ${formatDate(installment.paid_on)}` : 'Planned payment'}
        </Text>
      </View>
      <Text style={styles.paymentAmount}>
        {formatCurrency(installment.amount_cents, currencyCode)}
      </Text>
    </Pressable>
  );
}

export function BillPaymentPlanScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { isOffline } = useNetworkStatus();
  const {
    creditCardBillId,
    recurringExpenseId,
    periodStart,
    title = 'Bill',
    amountCents = 0,
    dueOn,
    currencyCode = 'CAD',
  } = route.params || {};
  const planWindow = useMemo(
    () => getPaymentPlanWindow({ dueOn }),
    [dueOn],
  );
  const [plan, setPlan] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [totalAmount, setTotalAmount] = useState(() =>
    formatCentsForInput(amountCents),
  );
  const [mode, setMode] = useState('equal');
  const [splitCount, setSplitCount] = useState(2);
  const [installments, setInstallments] = useState(() =>
    buildEqualInstallments({
      totalAmountCents: amountCents,
      count: 2,
      startDate: planWindow.startDate,
      endDate: planWindow.suggestedEndDate,
    }),
  );
  const [errors, setErrors] = useState({ installments: {} });
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadPlan = useCallback(async () => {
    setRequestError('');

    try {
      const [nextPlan, nextAccounts] = await Promise.all([
        getBillPaymentPlan({
          userId: user.id,
          creditCardBillId,
          recurringExpenseId,
          periodStart,
        }),
        creditCardBillId ? getAccounts(user.id) : Promise.resolve([]),
      ]);
      setPlan(nextPlan);
      const activePaymentAccounts = nextAccounts.filter(
        (account) =>
          account.is_active &&
          ['checking', 'savings', 'cash'].includes(account.account_type),
      );
      setPaymentAccounts(activePaymentAccounts);
      setPaymentAccountId((current) =>
        activePaymentAccounts.some((account) => account.id === current)
          ? current
          : activePaymentAccounts[0]?.id || '',
      );

      if (nextPlan) {
        setTotalAmount(formatCentsForInput(nextPlan.total_amount_cents));
        setSplitCount(nextPlan.installments.length);
      } else {
        setIsEditing(true);
      }
    } catch (error) {
      setRequestError(error.message || 'Unable to load this payment plan.');
    } finally {
      setIsLoading(false);
    }
  }, [
    creditCardBillId,
    periodStart,
    recurringExpenseId,
    user.id,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [loadPlan]),
  );

  const paidCents =
    plan?.installments
      ?.filter((installment) => installment.paid_on)
      .reduce(
        (total, installment) => total + installment.amount_cents,
        0,
      ) || 0;
  const remainingCents = Math.max(
    (plan?.total_amount_cents || amountCents) - paidCents,
    0,
  );
  const paidCount =
    plan?.installments?.filter((installment) => installment.paid_on).length || 0;
  const editableTotalCents = parseAmountToCents(totalAmount);
  const displayedTotalCents = isEditing
    ? editableTotalCents || 0
    : plan?.total_amount_cents || amountCents;
  const progress =
    displayedTotalCents > 0
      ? Math.min(paidCents / displayedTotalCents, 1)
      : 0;
  const plannedCents = installments.reduce((total, installment) => {
    const numericAmount = Number(
      String(installment.amount || '').replace(/[$,\s]/g, ''),
    );

    return total + (Number.isFinite(numericAmount) ? Math.round(numericAmount * 100) : 0);
  }, 0);

  function applyEqualSplit(nextCount) {
    const minimumCount = Math.max(paidCount + 1, 2);
    const count = Math.min(Math.max(nextCount, minimumCount), 8);
    const paidInstallments =
      plan?.installments
        ?.filter((installment) => installment.paid_on)
        .map((installment) => ({
          amount: formatCentsForInput(installment.amount_cents),
          id: installment.id,
          isPaid: true,
          plannedOn: installment.planned_on,
        })) || [];
    const remainingTotalCents = Math.max(
      Number(editableTotalCents || 0) - paidCents,
      0,
    );
    setSplitCount(count);
    setInstallments(
      paidInstallments.concat(
        buildEqualInstallments({
          totalAmountCents: remainingTotalCents,
          count: count - paidInstallments.length,
          startDate: planWindow.startDate,
          endDate: planWindow.suggestedEndDate,
        }),
      ),
    );
    setErrors({ installments: {} });
  }

  function selectMode(nextMode) {
    setMode(nextMode);

    if (nextMode === 'equal') {
      setSplitCount(installments.length);
      setInstallments((current) =>
        rebalancePaymentAmounts({
          installments: current,
          totalAmountCents: editableTotalCents || 0,
        }),
      );
      setErrors({ installments: {} });
    }
  }

  function updateInstallment(index, field, value) {
    setInstallments((current) =>
      current.map((installment, installmentIndex) =>
        installmentIndex === index
          ? { ...installment, [field]: value }
          : installment,
      ),
    );
    setErrors({ installments: {} });
  }

  function updateTotalAmount(value) {
    const nextTotalCents = parseAmountToCents(value);
    setTotalAmount(value);

    if (mode === 'equal' && nextTotalCents !== null) {
      setInstallments((current) =>
        rebalancePaymentAmounts({
          installments: current,
          totalAmountCents: nextTotalCents,
        }),
      );
    }

    setErrors({ installments: {} });
  }

  function addInstallment() {
    if (installments.length >= 8) {
      return;
    }

    setInstallments((current) => [
      ...current,
      { amount: '', plannedOn: planWindow.suggestedEndDate },
    ]);
  }

  function removeInstallment(index) {
    if (installments.length <= 2 || installments[index]?.isPaid) {
      return;
    }

    setInstallments((current) =>
      current.filter((_, installmentIndex) => installmentIndex !== index),
    );
  }

  function beginEdit() {
    setMode(
      hasEqualInstallmentAmounts(plan.installments) ? 'equal' : 'custom',
    );
    setTotalAmount(formatCentsForInput(plan.total_amount_cents));
    setSplitCount(plan.installments.length);
    setInstallments(
      plan.installments.map((installment) => ({
        amount: formatCentsForInput(installment.amount_cents),
        id: installment.id,
        isPaid: Boolean(installment.paid_on),
        plannedOn: installment.planned_on,
      })),
    );
    setErrors({ installments: {} });
    setIsEditing(true);
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const totalAmountCents = parseAmountToCents(totalAmount);
    const validation = validatePaymentPlan({
      installments,
      totalAmountCents: totalAmountCents || 0,
      startDate: planWindow.startDate,
      endDate: planWindow.endDate,
    });
    const nextErrors = {
      ...validation.errors,
      totalAmount:
        totalAmountCents === null
          ? 'Enter a valid total amount.'
          : totalAmountCents <= paidCents
            ? 'Total must be greater than completed payments.'
            : undefined,
    };
    setErrors(nextErrors);
    setRequestError('');

    if (isOffline) {
      setRequestError(getOfflineMutationMessage('save this payment plan'));
      return;
    }

    if (!validation.isValid || nextErrors.totalAmount) {
      return;
    }

    setIsSaving(true);

    try {
      const nextPlan = await saveBillPaymentPlan({
        userId: user.id,
        creditCardBillId,
        recurringExpenseId,
        periodStart,
        totalAmountCents,
        installments: installments
          .map((installment, index) => ({
            ...installment,
            amountCents: validation.amountCents[index],
          }))
          .filter((installment) => !installment.isPaid)
          .map((installment) => ({
            amountCents: installment.amountCents,
            plannedOn: installment.plannedOn,
          })),
      });
      setPlan(nextPlan);
      setIsEditing(false);
    } catch (error) {
      setRequestError(error.message || 'Unable to save this payment plan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTogglePayment(installment) {
    if (updatingId) {
      return;
    }

    if (isOffline) {
      setRequestError(getOfflineMutationMessage('mark this payment paid'));
      return;
    }

    if (creditCardBillId && !installment.paid_on && !paymentAccountId) {
      setRequestError(
        'Add or choose the account this payment leaves before marking it paid.',
      );
      return;
    }

    setUpdatingId(installment.id);
    setRequestError('');

    try {
      await setBillPaymentInstallmentPaid({
        installmentId: installment.id,
        isPaid: !installment.paid_on,
        paymentAccountId:
          creditCardBillId && !installment.paid_on ? paymentAccountId : null,
      });
      await loadPlan();
    } catch (error) {
      setRequestError(error.message || 'Unable to update this payment.');
    } finally {
      setUpdatingId('');
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
              subtitle="Break one bill into manageable payments"
              title="Payment plan"
            />

            <InlineNotice message={requestError} variant="error" />
            <InlineNotice
              message={
                isOffline
                  ? 'You can review this plan offline. Saving and marking payments need a connection.'
                  : ''
              }
              variant="warning"
            />

            <View style={styles.billSummary}>
              <View style={styles.billSummaryHeading}>
                <View style={styles.billIcon}>
                  <CalendarDays color={colors.white} size={22} />
                </View>
                <View style={styles.billSummaryCopy}>
                  <Text numberOfLines={1} style={styles.billTitle}>
                    {title}
                  </Text>
                  <Text style={styles.billDue}>Due {formatDate(dueOn)}</Text>
                </View>
              </View>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.billTotal}
              >
                {formatCurrency(displayedTotalCents, currencyCode)}
              </Text>
            </View>

            {isLoading ? (
              <Text style={styles.loadingText}>Loading payment plan...</Text>
            ) : isEditing ? (
              <>
                <View style={styles.section}>
                  <FormField
                    error={errors.totalAmount}
                    keyboardType="decimal-pad"
                    label="Total amount due"
                    onChangeText={updateTotalAmount}
                    placeholder="0.00"
                    value={totalAmount}
                  />
                  <Text style={styles.sectionBody}>
                    Updating the total recalculates equal payments. For a card,
                    this also updates the statement balance.
                  </Text>
                </View>

                <View style={styles.section}>
                  <View>
                    <Text style={styles.sectionTitle}>Split method</Text>
                    <Text style={styles.sectionBody}>
                      Equal split balances the amounts. Payment dates are always
                      yours to choose.
                    </Text>
                  </View>
                  <View style={styles.segmentedControl}>
                    {[
                      { label: 'Equal split', value: 'equal' },
                      { label: 'Custom', value: 'custom' },
                    ].map((option) => {
                      const isSelected = mode === option.value;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          key={option.value}
                          onPress={() => selectMode(option.value)}
                          style={[
                            styles.segment,
                            isSelected && styles.segmentSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentLabel,
                              isSelected && styles.segmentLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {mode === 'equal' ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Number of payments</Text>
                    <View style={styles.stepper}>
                      <Pressable
                        accessibilityLabel="Fewer payments"
                        accessibilityRole="button"
                        disabled={splitCount <= 2}
                        onPress={() => applyEqualSplit(splitCount - 1)}
                        style={styles.stepperButton}
                      >
                        <Minus color={colors.ink} size={20} />
                      </Pressable>
                      <View style={styles.stepperValue}>
                        <Text style={styles.stepperNumber}>{splitCount}</Text>
                        <Text style={styles.stepperCaption}>payments</Text>
                      </View>
                      <Pressable
                        accessibilityLabel="More payments"
                        accessibilityRole="button"
                        disabled={splitCount >= 8}
                        onPress={() => applyEqualSplit(splitCount + 1)}
                        style={styles.stepperButton}
                      >
                        <Plus color={colors.ink} size={20} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>Payment schedule</Text>
                      <Text style={styles.sectionBody}>
                        Choose dates through {formatDate(planWindow.endDate)}.
                      </Text>
                    </View>
                    {mode === 'custom' && installments.length < 8 ? (
                      <Pressable
                        accessibilityLabel="Add payment"
                        accessibilityRole="button"
                        onPress={addInstallment}
                        style={styles.iconButton}
                      >
                        <Plus color={colors.primary} size={20} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.schedule}>
                    {installments.map((installment, index) => (
                      <View key={`${index}-${installment.plannedOn}`} style={styles.editorRow}>
                        <View style={styles.editorNumber}>
                          <Text style={styles.editorNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.editorFields}>
                          <FormField
                            editable={mode === 'custom' && !installment.isPaid}
                            error={errors.installments?.[index]?.amount}
                            keyboardType="decimal-pad"
                            label="Amount"
                            onChangeText={(value) =>
                              updateInstallment(index, 'amount', value)
                            }
                            value={installment.amount}
                          />
                          <DateField
                            disabled={installment.isPaid}
                            error={errors.installments?.[index]?.date}
                            label="Payment date"
                            maximumDate={planWindow.endDate}
                            minimumDate={planWindow.startDate}
                            onChange={(value) =>
                              updateInstallment(index, 'plannedOn', value)
                            }
                            value={installment.plannedOn}
                          />
                          {installment.isPaid ? (
                            <Text style={styles.completedEditorLabel}>
                              Completed payment retained
                            </Text>
                          ) : null}
                        </View>
                        {mode === 'custom' && !installment.isPaid ? (
                          <Pressable
                            accessibilityLabel={`Remove payment ${index + 1}`}
                            accessibilityRole="button"
                            disabled={installments.length <= 2}
                            onPress={() => removeInstallment(index)}
                            style={styles.removeButton}
                          >
                            <Trash2 color={colors.danger} size={18} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.totalCheck}>
                  <View>
                    <Text style={styles.totalCheckLabel}>Planned</Text>
                    <Text style={styles.totalCheckValue}>
                      {formatCurrency(plannedCents, currencyCode)}
                    </Text>
                  </View>
                  <View style={styles.totalCheckRight}>
                    <Text style={styles.totalCheckLabel}>Bill total</Text>
                    <Text style={styles.totalCheckValue}>
                      {formatCurrency(displayedTotalCents, currencyCode)}
                    </Text>
                  </View>
                </View>
                <InlineNotice message={errors.plan || errors.total} variant="error" />
                {dueOn &&
                installments.some(
                  (installment) =>
                    !installment.isPaid && installment.plannedOn > dueOn,
                ) ? (
                  <InlineNotice
                    message="A planned payment is after the statement due date. Your card issuer may charge interest or fees."
                    variant="warning"
                  />
                ) : null}

                <AppButton
                  icon={Save}
                  isLoading={isSaving}
                  label="Save payment plan"
                  onPress={handleSave}
                />
                {plan ? (
                  <AppButton
                    label="Cancel editing"
                    onPress={() => setIsEditing(false)}
                    variant="secondary"
                  />
                ) : null}
              </>
            ) : plan ? (
              <>
                <View style={styles.progressSection}>
                  <View style={styles.progressHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>Plan progress</Text>
                      <Text style={styles.sectionBody}>
                        {paidCount} of {plan.installments.length} payments complete
                      </Text>
                    </View>
                    <Text style={styles.progressPercent}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.round(progress * 100)}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.progressTotals}>
                    <Text style={styles.progressPaid}>
                      {formatCurrency(paidCents, currencyCode)} paid
                    </Text>
                    <Text style={styles.progressRemaining}>
                      {formatCurrency(remainingCents, currencyCode)} remaining
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  {creditCardBillId ? (
                    paymentAccounts.length ? (
                      <AccountPicker
                        accounts={paymentAccounts}
                        allowUnassigned={false}
                        currencyCode={currencyCode}
                        label="Payments leave"
                        onSelect={setPaymentAccountId}
                        selectedId={paymentAccountId}
                      />
                    ) : (
                      <InlineNotice
                        message="Add a checking, savings, or cash account before completing a card payment. This keeps your cash balance accurate."
                        variant="warning"
                      />
                    )
                  ) : null}
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>Payment schedule</Text>
                      <Text style={styles.sectionBody}>
                        Tap a payment when it has been completed.
                      </Text>
                    </View>
                    {plan.status !== 'completed' ? (
                      <Pressable
                        accessibilityLabel="Edit payment schedule"
                        accessibilityRole="button"
                        onPress={beginEdit}
                        style={styles.iconButton}
                      >
                        <Pencil color={colors.primary} size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.paymentList}>
                    {plan.installments.map((installment, index) => (
                      <View key={installment.id}>
                        <PaymentRow
                          currencyCode={currencyCode}
                          installment={installment}
                          isUpdating={updatingId === installment.id}
                          onToggle={() => handleTogglePayment(installment)}
                        />
                        {index < plan.installments.length - 1 ? (
                          <View style={styles.divider} />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>

                {paidCount > 0 && paidCount < plan.installments.length ? (
                  <InlineNotice
                    message="Completed payments stay locked. You can revise the remaining balance, amounts, and dates."
                    variant="info"
                  />
                ) : null}
                {plan.status === 'completed' ? (
                  <InlineNotice
                    message="Plan complete. This card statement is now marked paid."
                    variant="success"
                  />
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  billSummary: {
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.lg,
    gap: spacing.xl,
  },
  billSummaryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  billIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.panelTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  billTitle: {
    ...typography.label,
    color: colors.white,
    fontSize: 16,
  },
  billDue: {
    ...typography.caption,
    color: colors.panelMuted,
  },
  billTotal: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  loadingText: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  sectionBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  segmentedControl: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs,
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentLabel: {
    ...typography.label,
    color: colors.inkMuted,
  },
  segmentLabelSelected: {
    color: colors.ink,
  },
  stepper: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  stepperCaption: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedule: {
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  editorRow: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  editorNumber: {
    width: 28,
    height: 28,
    marginTop: 31,
    borderRadius: radius.round,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorNumberText: {
    ...typography.caption,
    color: colors.ink,
  },
  editorFields: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  completedEditorLabel: {
    ...typography.caption,
    color: colors.success,
  },
  removeButton: {
    width: 38,
    height: 38,
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCheck: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalCheckRight: {
    alignItems: 'flex-end',
  },
  totalCheckLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  totalCheckValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  progressSection: {
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressPercent: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.info,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.round,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.info,
  },
  progressTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressPaid: {
    ...typography.caption,
    color: colors.success,
  },
  progressRemaining: {
    ...typography.caption,
    color: colors.ink,
  },
  paymentList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  paymentRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  paymentRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  paymentCopy: {
    flex: 1,
    minWidth: 0,
  },
  paymentDate: {
    ...typography.label,
    color: colors.ink,
  },
  paymentStatus: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  paymentAmount: {
    ...typography.label,
    color: colors.ink,
  },
  divider: {
    height: 1,
    marginLeft: 34,
    backgroundColor: colors.border,
  },
});
