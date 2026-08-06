import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, ReceiptText } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { getMonthKey, getMonthRangeForKey, shiftMonthKey } from '../../insights/utils/monthlyInsights.cjs';
import { getPlanningCalendar } from '../services/calendarService';

function EventIcon({ type }) {
  const Icon = type === 'credit_card_bill' ? CreditCard : type === 'income' || type === 'payday' ? CircleDollarSign : ReceiptText;
  return <Icon color={colors.ink} size={19} />;
}

function formatDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
}

export function CalendarScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const profile = useMemo(() => route.params?.profile || {}, [route.params?.profile]);
  const currencyCode = profile.currency_code || route.params?.currencyCode || 'CAD';
  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [calendar, setCalendar] = useState(null);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsRefreshing(true); setError('');
    try { setCalendar(await getPlanningCalendar({ userId: user.id, profile, monthKey })); }
    catch (requestError) { setError(requestError.message || 'Unable to load this calendar.'); }
    finally { setIsRefreshing(false); }
  }, [monthKey, profile, user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grouped = useMemo(() => {
    const events = calendar?.events || (Array.isArray(calendar) ? calendar : []);
    const rows = new Map();
    for (const event of events) {
      const next = rows.get(event.date) || [];
      next.push(event); rows.set(event.date, next);
    }
    return [...rows.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [calendar]);

  function openEvent(event) {
    if (event.type === 'income' && event.incomeId) {
      navigation.navigate('IncomeDetail', { incomeId: event.incomeId, currencyCode });
      return;
    }
    if (event.type === 'credit_card_bill' || event.type === 'recurring_expense' || event.type === 'bill_installment') {
      navigation.navigate('BillPaymentPlan', {
        creditCardBillId: event.creditCardBillId,
        recurringExpenseId: event.recurringExpenseId,
        periodStart: event.periodStart || `${event.date.slice(0, 7)}-01`,
        title: event.title,
        amountCents: event.totalAmountCents || event.amountCents,
        dueOn: event.dueOn || event.date,
        currencyCode,
      });
    }
  }

  if (!calendar && isRefreshing) return <LoadingScreen message="Building your calendar..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={load} tintColor={colors.primary} />}>
        <View style={styles.content}>
          <ScreenHeader onBack={navigation.goBack} subtitle="Income, bills, and payment chunks in one timeline" title="Planning calendar" />
          <InlineNotice message={error} variant="error" />
          <View style={styles.monthRow}>
            <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => setMonthKey((value) => shiftMonthKey(value, -1))} style={styles.monthButton}><ChevronLeft color={colors.ink} size={20} /></Pressable>
            <Text style={styles.monthTitle}>{getMonthRangeForKey(monthKey).label}</Text>
            <Pressable accessibilityLabel="Next month" accessibilityRole="button" onPress={() => setMonthKey((value) => shiftMonthKey(value, 1))} style={styles.monthButton}><ChevronRight color={colors.ink} size={20} /></Pressable>
          </View>

          <View style={styles.summary}>
            <View><Text style={styles.summaryLabel}>Expected outflow</Text><Text style={styles.summaryValue}>{formatCurrency(calendar?.totals?.outflowCents || 0, currencyCode)}</Text></View>
            <View><Text style={styles.summaryLabel}>Recorded income</Text><Text style={styles.summaryValue}>{formatCurrency(calendar?.totals?.incomeCents || 0, currencyCode)}</Text></View>
          </View>

          {grouped.map(([date, dateEvents]) => (
            <View key={date} style={styles.day}>
              <Text style={styles.dayLabel}>{formatDay(date)}</Text>
              <View style={styles.eventList}>{dateEvents.map((event, index) => (
                <View key={event.id}>
                  <Pressable
                    accessibilityRole={event.type === 'payday' ? 'text' : 'button'}
                    disabled={event.type === 'payday'}
                    onPress={() => openEvent(event)}
                    style={({ pressed }) => [styles.eventRow, pressed && styles.eventPressed]}
                  >
                    <View style={styles.eventIcon}><EventIcon type={event.type} /></View>
                    <View style={styles.eventCopy}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventBody}>{event.coveredByPaymentPlan ? 'Covered by payment plan' : event.statusLabel || event.subtitle || event.status || event.type.replaceAll('_', ' ')}</Text></View>
                    {event.amountCents ? <Text style={[styles.eventAmount, (event.type === 'income' || event.type === 'payday') && styles.incomeAmount]}>{event.type === 'income' ? '+' : ''}{formatCurrency(event.amountCents, currencyCode)}</Text> : null}
                    {event.type !== 'payday' ? <ChevronRight color={colors.inkMuted} size={17} /> : null}
                  </Pressable>
                  {index < dateEvents.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}</View>
            </View>
          ))}

          {!grouped.length ? <View style={styles.empty}><CalendarDays color={colors.inkMuted} size={24} /><Text style={styles.emptyTitle}>No planned activity</Text><Text style={styles.emptyBody}>Add fixed expenses, card statements, payment chunks, or income to fill this month.</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xl },
  monthRow: { minHeight: 54, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, monthTitle: { ...typography.section, color: colors.ink },
  summary: { borderRadius: radius.md, backgroundColor: colors.darkPanel, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg }, summaryLabel: { ...typography.caption, color: colors.panelMuted }, summaryValue: { ...typography.section, color: colors.white, marginTop: spacing.xs },
  day: { gap: spacing.sm }, dayLabel: { ...typography.label, color: colors.inkMuted }, eventList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, eventRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, eventPressed: { backgroundColor: colors.surfaceMuted }, eventIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.iconSurface, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, minWidth: 0 }, eventTitle: { ...typography.label, color: colors.ink }, eventBody: { ...typography.caption, color: colors.inkMuted, textTransform: 'capitalize' }, eventAmount: { ...typography.label, color: colors.danger }, incomeAmount: { color: colors.success }, divider: { height: 1, backgroundColor: colors.border, marginLeft: 54 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, emptyTitle: { ...typography.section, color: colors.ink }, emptyBody: { ...typography.caption, color: colors.inkMuted, textAlign: 'center', maxWidth: 380 },
});
