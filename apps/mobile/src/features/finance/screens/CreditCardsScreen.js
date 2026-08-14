import { useFocusEffect } from '@react-navigation/native';
import { Check, CheckCircle2, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
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
import { AccountPicker, getAccounts } from '../../accounts';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  createCreditCard,
  deleteCreditCardBill,
  getCreditCardBills,
  getCreditCards,
  setCreditCardActive,
  setCreditCardBillPaid,
  setCreditCardTrackingMode,
  updateCreditCardBill,
} from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateCardBill,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function CreditCardsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [cards, setCards] = useState([]);
  const [bills, setBills] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [nickname, setNickname] = useState('');
  const [issuer, setIssuer] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [formError, setFormError] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [editingBillId, setEditingBillId] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billStatementOn, setBillStatementOn] = useState('');
  const [billDueOn, setBillDueOn] = useState('');
  const [billNote, setBillNote] = useState('');
  const [billErrors, setBillErrors] = useState({});
  const [isSavingBillEdit, setIsSavingBillEdit] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setRequestError('');

    try {
      const [nextCards, nextBills, nextAccounts] = await Promise.all([
        getCreditCards(user.id),
        getCreditCardBills(user.id),
        getAccounts(user.id),
      ]);
      setCards(nextCards);
      setBills(nextBills);
      const nextPaymentAccounts = nextAccounts.filter(
        (account) =>
          account.is_active &&
          ['checking', 'savings', 'cash'].includes(account.account_type),
      );
      setPaymentAccounts(nextPaymentAccounts);
      setPaymentAccountId((current) =>
        nextPaymentAccounts.some((account) => account.id === current)
          ? current
          : nextPaymentAccounts[0]?.id || '',
      );
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to load credit card details.'),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleCreateCard() {
    const nextErrors = {};

    if (nickname.trim().length < 2) {
      nextErrors.nickname = 'Enter a name for this card.';
    }

    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      nextErrors.lastFour = 'Enter exactly four digits.';
    }

    setFormError(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      const card = await createCreditCard({
        userId: user.id,
        nickname,
        issuer,
        lastFour,
      });
      setCards((current) => [...current, card]);
      setNickname('');
      setIssuer('');
      setLastFour('');
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(
          error,
          'Unable to save this card.',
          'A card with this nickname already exists.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCardToggle(card) {
    setUpdatingId(card.id);

    try {
      await setCreditCardActive({
        userId: user.id,
        creditCardId: card.id,
        isActive: !card.is_active,
      });
      setCards((current) =>
        current.map((item) =>
          item.id === card.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to update this card.'),
      );
    } finally {
      setUpdatingId('');
    }
  }

  async function handleTrackingMode(card, trackingMode) {
    if (card.tracking_mode === trackingMode) return;
    setUpdatingId(card.id);
    setRequestError('');

    try {
      await setCreditCardTrackingMode({
        userId: user.id,
        creditCardId: card.id,
        trackingMode,
      });
      setCards((current) => current.map((item) =>
        item.id === card.id ? { ...item, tracking_mode: trackingMode } : item,
      ));
    } catch (error) {
      setRequestError(getFinanceErrorMessage(error, 'Unable to change card tracking.'));
    } finally {
      setUpdatingId('');
    }
  }

  async function handleBillToggle(bill) {
    const paidOn = bill.paid_on ? null : getLocalDateString();

    if (paidOn && !paymentAccountId) {
      setRequestError(
        'Add or choose the account this payment leaves before marking it paid.',
      );
      return;
    }

    setUpdatingId(bill.id);
    setRequestError('');

    try {
      await setCreditCardBillPaid({
        userId: user.id,
        billId: bill.id,
        paidOn,
        paymentAccountId: paidOn ? paymentAccountId : null,
      });
      setBills((current) =>
        current.map((item) =>
          item.id === bill.id ? { ...item, paid_on: paidOn } : item,
        ),
      );
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to update this card bill.'),
      );
    } finally {
      setUpdatingId('');
    }
  }

  function handleStartBillEdit(bill) {
    setRequestError('');

    if (bill.mutationLockedReason) {
      setRequestError(bill.mutationLockedReason);
      return;
    }

    setEditingBillId(bill.id);
    setBillAmount((bill.amount_cents / 100).toFixed(2));
    setBillStatementOn(bill.statement_on);
    setBillDueOn(bill.due_on);
    setBillNote(bill.note || '');
    setBillErrors({});
  }

  function handleCancelBillEdit() {
    setEditingBillId('');
    setBillErrors({});
  }

  async function handleSaveBillEdit(bill) {
    const nextErrors = validateCardBill({
      amount: billAmount,
      statementDate: billStatementOn,
      dueDate: billDueOn,
    });
    setBillErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSavingBillEdit(true);

    try {
      const updatedBill = await updateCreditCardBill({
        userId: user.id,
        billId: bill.id,
        amountCents: parseAmountToCents(billAmount),
        statementOn: billStatementOn,
        dueOn: billDueOn,
        note: billNote,
      });
      setBills((current) =>
        current.map((item) =>
          item.id === bill.id
            ? { ...item, ...updatedBill }
            : item,
        ),
      );
      handleCancelBillEdit();
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(
          error,
          'Unable to save changes to this card bill.',
          'A bill for this card and statement date already exists.',
        ),
      );
    } finally {
      setIsSavingBillEdit(false);
    }
  }

  function confirmDeleteBill(bill) {
    setRequestError('');

    if (bill.mutationLockedReason) {
      setRequestError(bill.mutationLockedReason);
      return;
    }

    const planNote = bill.paymentPlanId
      ? ' Its unfinished payment plan will also be removed.'
      : '';
    Alert.alert(
      'Delete card bill?',
      `Remove this ${formatCurrency(bill.amount_cents, currencyCode)} card bill?${planNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUpdatingId(bill.id);

            try {
              await deleteCreditCardBill({ userId: user.id, billId: bill.id });
              setBills((current) => current.filter((item) => item.id !== bill.id));
              if (editingBillId === bill.id) {
                handleCancelBillEdit();
              }
            } catch (error) {
              setRequestError(
                getFinanceErrorMessage(error, 'Unable to delete this card bill.'),
              );
            } finally {
              setUpdatingId('');
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
            subtitle="Saved cards and monthly statements"
            title="Credit cards"
          />

          <InlineNotice message={requestError} variant="error" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add a card</Text>
            <FormField
              error={formError.nickname}
              label="Card nickname"
              maxLength={40}
              onChangeText={setNickname}
              placeholder="Travel Mastercard"
              value={nickname}
            />
            <FormField
              label="Issuer (optional)"
              maxLength={50}
              onChangeText={setIssuer}
              placeholder="Bank or card provider"
              value={issuer}
            />
            <FormField
              error={formError.lastFour}
              keyboardType="number-pad"
              label="Last four digits (optional)"
              maxLength={4}
              onChangeText={setLastFour}
              placeholder="1234"
              value={lastFour}
            />
            <AppButton
              icon={Plus}
              isLoading={isSaving}
              label="Save card"
              onPress={handleCreateCard}
              variant="secondary"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved cards</Text>
            <View style={styles.list}>
              {cards.map((card, index) => (
                <View key={card.id}>
                  <View style={styles.row}>
                    <View style={styles.icon}>
                      <CreditCard color={colors.primary} size={19} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{card.nickname}</Text>
                      <Text style={styles.rowBody}>
                        {[card.issuer, card.last_four && `Ending ${card.last_four}`]
                          .filter(Boolean)
                          .join(' - ') || 'Saved card'}
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel={`${card.is_active ? 'Pause' : 'Resume'} ${card.nickname}`}
                      disabled={updatingId === card.id}
                      onValueChange={() => handleCardToggle(card)}
                      thumbColor={colors.white}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary,
                      }}
                      value={card.is_active}
                    />
                  </View>
                  <View style={styles.trackingRow}>
                    <Text style={styles.trackingLabel}>Count spending from</Text>
                    <View style={styles.segmented}>
                      {[
                        { id: 'statement', label: 'Statements' },
                        { id: 'transactions', label: 'Purchases' },
                      ].map((option) => {
                        const selected = card.tracking_mode === option.id;
                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            disabled={updatingId === card.id}
                            key={option.id}
                            onPress={() => handleTrackingMode(card, option.id)}
                            style={[styles.segment, selected && styles.segmentSelected]}
                          >
                            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  {index < cards.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
              {cards.length === 0 ? (
                <Text style={styles.emptyLabel}>No saved cards yet.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card bills</Text>
            {paymentAccounts.length ? (
              <AccountPicker
                accounts={paymentAccounts}
                allowUnassigned={false}
                currencyCode={currencyCode}
                label="Pay card bills from"
                onSelect={setPaymentAccountId}
                selectedId={paymentAccountId}
              />
            ) : (
              <InlineNotice
                message="Add a checking, savings, or cash account to reconcile card payments with your available balance."
                variant="info"
              />
            )}
            <View style={styles.list}>
              {bills.map((bill, index) => (
                <View key={bill.id}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.icon,
                        {
                          backgroundColor: bill.paid_on
                            ? colors.successSoft
                            : colors.warningSoft,
                        },
                      ]}
                    >
                      <CheckCircle2
                        color={bill.paid_on ? colors.success : colors.warning}
                        size={19}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>
                        {bill.card?.nickname || 'Credit card'}
                      </Text>
                      <Text style={styles.rowBody}>
                        Due {bill.due_on} - {bill.paid_on ? 'Paid' : 'Unpaid'}
                      </Text>
                    </View>
                    <View style={styles.billValue}>
                      <Text style={styles.amount}>
                        {formatCurrency(bill.amount_cents, currencyCode)}
                      </Text>
                      <View style={styles.billActions}>
                        {!bill.mutationLockedReason ? (
                          <>
                            <Pressable
                              accessibilityLabel={`Edit ${bill.card?.nickname || 'credit card'} bill`}
                              accessibilityRole="button"
                              disabled={Boolean(updatingId) || isSavingBillEdit}
                              onPress={() => handleStartBillEdit(bill)}
                              style={styles.iconButton}
                            >
                              <Pencil color={colors.primary} size={17} />
                            </Pressable>
                            <Pressable
                              accessibilityLabel={`Delete ${bill.card?.nickname || 'credit card'} bill`}
                              accessibilityRole="button"
                              disabled={Boolean(updatingId) || isSavingBillEdit}
                              onPress={() => confirmDeleteBill(bill)}
                              style={styles.iconButton}
                            >
                              <Trash2 color={colors.danger} size={17} />
                            </Pressable>
                          </>
                        ) : null}
                        <Switch
                          accessibilityLabel={`Mark bill ${bill.paid_on ? 'unpaid' : 'paid'}`}
                          disabled={updatingId === bill.id || isSavingBillEdit}
                          onValueChange={() => handleBillToggle(bill)}
                          thumbColor={colors.white}
                          trackColor={{
                            false: colors.border,
                            true: colors.success,
                          }}
                          value={Boolean(bill.paid_on)}
                        />
                      </View>
                    </View>
                  </View>
                  {bill.mutationLockedReason ? (
                    <Text style={styles.lockedBillMessage}>
                      {bill.mutationLockedReason}
                    </Text>
                  ) : null}
                  {editingBillId === bill.id ? (
                    <View style={styles.billEditForm}>
                      <Text style={styles.editTitle}>Edit card bill</Text>
                      {bill.paymentPlanId ? (
                        <InlineNotice
                          message="This bill has an unfinished payment plan. Change its total or due date from the payment plan so scheduled payments stay accurate."
                          variant="info"
                        />
                      ) : null}
                      <FormField
                        editable={!bill.paymentPlanId}
                        error={billErrors.amount}
                        keyboardType="decimal-pad"
                        label="Statement amount"
                        onChangeText={setBillAmount}
                        value={billAmount}
                      />
                      <FormField
                        autoCapitalize="none"
                        error={billErrors.date}
                        keyboardType="numbers-and-punctuation"
                        label="Statement date"
                        maxLength={10}
                        onChangeText={setBillStatementOn}
                        value={billStatementOn}
                      />
                      <FormField
                        autoCapitalize="none"
                        editable={!bill.paymentPlanId}
                        error={billErrors.dueDate}
                        keyboardType="numbers-and-punctuation"
                        label="Payment due date"
                        maxLength={10}
                        onChangeText={setBillDueOn}
                        value={billDueOn}
                      />
                      <FormField
                        label="Note (optional)"
                        maxLength={240}
                        multiline
                        numberOfLines={3}
                        onChangeText={setBillNote}
                        value={billNote}
                      />
                      <View style={styles.editActions}>
                        <AppButton
                          label="Cancel"
                          onPress={handleCancelBillEdit}
                          style={styles.editAction}
                          variant="secondary"
                        />
                        <AppButton
                          icon={Check}
                          isLoading={isSavingBillEdit}
                          label="Save changes"
                          onPress={() => handleSaveBillEdit(bill)}
                          style={styles.editAction}
                        />
                      </View>
                    </View>
                  ) : null}
                  {index < bills.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
              {bills.length === 0 ? (
                <Text style={styles.emptyLabel}>No card bills yet.</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...typography.label,
    color: colors.ink,
  },
  rowBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  trackingRow: {
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  trackingLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  segmentLabelSelected: {
    color: colors.white,
  },
  billValue: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  billActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    ...typography.label,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  lockedBillMessage: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingBottom: spacing.md,
    paddingLeft: 54,
  },
  billEditForm: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: -spacing.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  editTitle: {
    ...typography.label,
    color: colors.ink,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editAction: {
    flex: 1,
  },
  emptyLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
