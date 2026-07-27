import { useFocusEffect } from '@react-navigation/native';
import { Check, CreditCard, WalletCards } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import {
  createCreditCard,
  createCreditCardBill,
  getCreditCards,
} from '../services/financeService';
import {
  getLocalDateString,
  parseAmountToCents,
  validateCardBill,
} from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function CardBillScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [cards, setCards] = useState([]);
  const [creditCardId, setCreditCardId] = useState('');
  const [nickname, setNickname] = useState('');
  const [issuer, setIssuer] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [amount, setAmount] = useState('');
  const [statementDate, setStatementDate] = useState(getLocalDateString());
  const [dueDate, setDueDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCards = useCallback(async () => {
    setRequestError('');
    setIsLoadingCards(true);

    try {
      const nextCards = await getCreditCards(user.id);
      setCards(nextCards);
      setCreditCardId((current) =>
        nextCards.some((card) => card.id === current)
          ? current
          : nextCards.find((card) => card.is_active)?.id || '',
      );
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to load saved cards.'),
      );
    } finally {
      setIsLoadingCards(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards]),
  );

  async function handleSave() {
    const isCreatingCard = cards.length === 0;
    const nextErrors = validateCardBill({
      amount,
      statementDate,
      dueDate,
      lastFour: isCreatingCard ? lastFour : '',
    });

    if (isCreatingCard && nickname.trim().length < 2) {
      nextErrors.nickname = 'Enter a name for this card.';
    }

    if (!isCreatingCard && !creditCardId) {
      nextErrors.card = 'Choose an active credit card.';
    }

    setErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      let selectedCardId = creditCardId;

      if (isCreatingCard) {
        const card = await createCreditCard({
          userId: user.id,
          nickname,
          issuer,
          lastFour,
        });
        selectedCardId = card.id;
        setCards([card]);
        setCreditCardId(card.id);
      }

      await createCreditCardBill({
        userId: user.id,
        creditCardId: selectedCardId,
        amountCents: parseAmountToCents(amount),
        statementOn: statementDate,
        dueOn: dueDate,
        paidOn: isPaid ? getLocalDateString() : null,
        note,
      });
      navigation.popTo('Dashboard');
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(
          error,
          'Unable to save this card bill.',
          'A bill for this card and statement date already exists.',
        ),
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
              action={
                cards.length > 0 ? (
                  <Pressable
                    accessibilityLabel="Manage credit cards"
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('CreditCards', { currencyCode })
                    }
                    style={styles.headerAction}
                  >
                    <WalletCards color={colors.primary} size={20} />
                  </Pressable>
                ) : null
              }
              onBack={navigation.goBack}
              subtitle="Track an aggregate monthly statement"
              title="Credit card bill"
            />

            <InlineNotice
              message="Use a card bill when you are not recording its individual purchases, so spending is not counted twice."
              variant="info"
            />
            <InlineNotice message={requestError} variant="error" />

            {cards.length > 0 ? (
              <View style={styles.cardBlock}>
                <Text style={styles.fieldLabel}>Card</Text>
                <View style={styles.cardGrid}>
                  {cards
                    .filter((card) => card.is_active)
                    .map((card) => {
                      const isSelected = card.id === creditCardId;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          key={card.id}
                          onPress={() => setCreditCardId(card.id)}
                          style={[
                            styles.cardChip,
                            isSelected && styles.cardChipSelected,
                          ]}
                        >
                          <CreditCard
                            color={isSelected ? colors.primary : colors.inkMuted}
                            size={18}
                          />
                          <View style={styles.cardChipCopy}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.cardName,
                                isSelected && styles.cardNameSelected,
                              ]}
                            >
                              {card.nickname}
                            </Text>
                            {card.last_four ? (
                              <Text style={styles.cardDigits}>
                                Ending {card.last_four}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
                {errors.card ? (
                  <Text style={styles.errorText}>{errors.card}</Text>
                ) : null}
              </View>
            ) : isLoadingCards ? (
              <Text style={styles.helperText}>Loading saved cards...</Text>
            ) : (
              <View style={styles.newCard}>
                <Text style={styles.sectionTitle}>Save your first card</Text>
                <FormField
                  error={errors.nickname}
                  label="Card nickname"
                  maxLength={40}
                  onChangeText={setNickname}
                  placeholder="Everyday Visa"
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
                  error={errors.lastFour}
                  keyboardType="number-pad"
                  label="Last four digits (optional)"
                  maxLength={4}
                  onChangeText={setLastFour}
                  placeholder="1234"
                  value={lastFour}
                />
              </View>
            )}

            <View style={styles.form}>
              <FormField
                error={errors.amount}
                keyboardType="decimal-pad"
                label="Statement amount"
                onChangeText={setAmount}
                placeholder="0.00"
                value={amount}
              />
              <FormField
                autoCapitalize="none"
                error={errors.date}
                keyboardType="numbers-and-punctuation"
                label="Statement date"
                maxLength={10}
                onChangeText={setStatementDate}
                placeholder="YYYY-MM-DD"
                value={statementDate}
              />
              <FormField
                autoCapitalize="none"
                error={errors.dueDate}
                keyboardType="numbers-and-punctuation"
                label="Payment due date"
                maxLength={10}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                value={dueDate}
              />
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.fieldLabel}>Already paid</Text>
                  <Text style={styles.helperText}>
                    Paid bills remain visible in activity.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Already paid"
                  onValueChange={setIsPaid}
                  thumbColor={colors.white}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary,
                  }}
                  value={isPaid}
                />
              </View>
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
              disabled={isLoadingCards}
              icon={Check}
              isLoading={isSaving}
              label="Save card bill"
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
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBlock: {
    gap: spacing.sm,
  },
  cardGrid: {
    gap: spacing.sm,
  },
  cardChip: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    ...typography.label,
    color: colors.ink,
  },
  cardNameSelected: {
    color: colors.primary,
  },
  cardDigits: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  newCard: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  form: {
    gap: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.ink,
  },
  toggleRow: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
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
