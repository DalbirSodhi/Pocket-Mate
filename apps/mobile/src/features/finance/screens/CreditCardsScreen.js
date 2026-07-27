import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, CreditCard, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
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
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  createCreditCard,
  getCreditCardBills,
  getCreditCards,
  setCreditCardActive,
  setCreditCardBillPaid,
} from '../services/financeService';
import { getLocalDateString } from '../utils/financeValidation.cjs';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function CreditCardsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [cards, setCards] = useState([]);
  const [bills, setBills] = useState([]);
  const [nickname, setNickname] = useState('');
  const [issuer, setIssuer] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [formError, setFormError] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    setRequestError('');

    try {
      const [nextCards, nextBills] = await Promise.all([
        getCreditCards(user.id),
        getCreditCardBills(user.id),
      ]);
      setCards(nextCards);
      setBills(nextBills);
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

  async function handleBillToggle(bill) {
    setUpdatingId(bill.id);
    const paidOn = bill.paid_on ? null : getLocalDateString();

    try {
      await setCreditCardBillPaid({
        userId: user.id,
        billId: bill.id,
        paidOn,
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
                      <Switch
                        accessibilityLabel={`Mark bill ${bill.paid_on ? 'unpaid' : 'paid'}`}
                        disabled={updatingId === bill.id}
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
  billValue: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amount: {
    ...typography.label,
    color: colors.ink,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
