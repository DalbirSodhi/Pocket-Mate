import { useFocusEffect } from '@react-navigation/native';
import { Calculator, CreditCard } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { getLocalDateString } from '../../../utils/date.cjs';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { parseAmountToCents } from '../../finance/utils/financeValidation.cjs';
import { getDebtProfiles, saveDebtProfiles } from '../services/debtService';
import { calculateDebtPayoff } from '../utils/debtPayoff.cjs';

export function DebtPayoffScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [debts, setDebts] = useState([]);
  const [extra, setExtra] = useState('100');
  const [strategy, setStrategy] = useState('avalanche');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getDebtProfiles(user.id);
      setDebts(rows.map((row) => ({ ...row, apr: row.apr_basis_points ? String(row.apr_basis_points / 100) : '', minimum: row.minimum_payment_cents ? String(row.minimum_payment_cents / 100) : '' })));
    } catch (requestError) { setError(requestError.message || 'Unable to load debts.'); }
    finally { setLoading(false); }
  }, [user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalDebt = useMemo(() => debts.reduce((total, debt) => total + debt.balanceCents, 0), [debts]);
  function updateDebt(id, key, value) { setDebts((rows) => rows.map((row) => row.id === id ? { ...row, [key]: value } : row)); }
  async function calculate() {
    setError(''); setResult(null);
    const extraCents = parseAmountToCents(extra);
    const normalized = debts.map((debt) => ({
      id: debt.id, name: debt.name, balanceCents: debt.balanceCents,
      aprBasisPoints: Math.round(Number(debt.apr) * 100),
      minimumPaymentCents: parseAmountToCents(debt.minimum),
    }));
    if (!extraCents || normalized.some((debt) => !debt.aprBasisPoints || !debt.minimumPaymentCents)) {
      setError('Enter an APR and minimum payment for every debt, plus a positive extra payment.'); return;
    }
    setSaving(true);
    try {
      await saveDebtProfiles({ userId: user.id, debts: normalized });
      setResult(calculateDebtPayoff({ debts: normalized, monthlyExtraPaymentCents: extraCents, strategy, startDate: getLocalDateString() }));
    } catch (requestError) { setError(requestError.message || 'Unable to calculate this payoff plan.'); }
    finally { setSaving(false); }
  }
  if (loading) return <LoadingScreen message="Loading debt accounts..." />;

  return <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.content}>
    <ScreenHeader onBack={navigation.goBack} subtitle="Compare avalanche and snowball strategies" title="Debt payoff" />
    <InlineNotice message={error} variant="error" />
    {!debts.length ? <InlineNotice message="Add an active loan or card balance in Accounts before building a payoff plan." variant="info" /> : null}
    <View style={styles.total}><Text style={styles.totalLabel}>Total debt</Text><Text style={styles.totalValue}>{formatCurrency(totalDebt, currencyCode)}</Text></View>
    <View style={styles.list}>{debts.map((debt) => <View key={debt.id} style={styles.debt}><View style={styles.debtHeading}><CreditCard color={colors.ink} size={20} /><View style={styles.debtCopy}><Text style={styles.debtName}>{debt.name}</Text><Text style={styles.debtBalance}>{formatCurrency(debt.balanceCents, currencyCode)}</Text></View></View><View style={styles.fields}><View style={styles.field}><FormField keyboardType="decimal-pad" label="APR %" onChangeText={(value) => updateDebt(debt.id, 'apr', value)} placeholder="19.99" value={debt.apr} /></View><View style={styles.field}><FormField keyboardType="decimal-pad" label="Minimum / month" onChangeText={(value) => updateDebt(debt.id, 'minimum', value)} placeholder="50.00" value={debt.minimum} /></View></View></View>)}</View>
    {debts.length ? <><Text style={styles.label}>Strategy</Text><View style={styles.segments}>{[['avalanche','Highest APR first'],['snowball','Smallest balance first']].map(([id,label]) => <Pressable accessibilityRole="radio" accessibilityState={{checked:strategy===id}} key={id} onPress={() => setStrategy(id)} style={[styles.segment,strategy===id&&styles.segmentSelected]}><Text style={[styles.segmentText,strategy===id&&styles.segmentTextSelected]}>{label}</Text></Pressable>)}</View><FormField keyboardType="decimal-pad" label="Extra payment each month" onChangeText={setExtra} placeholder="100.00" value={extra} /><AppButton icon={Calculator} isLoading={saving} label="Build payoff plan" onPress={calculate} /></> : null}
    {result ? <View style={styles.result}><Text style={styles.resultTitle}>{result.isPaidOff ? `Debt-free by ${result.payoffDate}` : 'Plan needs a higher payment'}</Text><View style={styles.resultStats}><View><Text style={styles.statLabel}>Months</Text><Text style={styles.statValue}>{result.payoffMonth || '—'}</Text></View><View><Text style={styles.statLabel}>Interest</Text><Text style={styles.statValue}>{formatCurrency(result.totalInterestCents, currencyCode)}</Text></View><View><Text style={styles.statLabel}>Monthly budget</Text><Text style={styles.statValue}>{formatCurrency(result.monthlyPaymentBudgetCents, currencyCode)}</Text></View></View>{result.warnings.map((warning) => <Text key={`${warning.code}-${warning.debtId || ''}`} style={styles.warning}>{warning.message}</Text>)}</View> : null}
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles=StyleSheet.create({flex:{flex:1},safeArea:{flex:1,backgroundColor:colors.canvas},scroll:{paddingHorizontal:spacing.lg,paddingTop:spacing.md,paddingBottom:spacing.xxxl},content:{width:'100%',maxWidth:680,alignSelf:'center',gap:spacing.xl},total:{backgroundColor:colors.darkPanel,borderRadius:radius.md,padding:spacing.lg},totalLabel:{...typography.caption,color:colors.panelMuted},totalValue:{...typography.title,color:colors.white},list:{gap:spacing.lg},debt:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,paddingVertical:spacing.md,gap:spacing.md},debtHeading:{flexDirection:'row',alignItems:'center',gap:spacing.md},debtCopy:{flex:1},debtName:{...typography.label,color:colors.ink},debtBalance:{...typography.caption,color:colors.inkMuted},fields:{flexDirection:'row',gap:spacing.md},field:{flex:1},label:{...typography.label,color:colors.ink},segments:{flexDirection:'row',gap:spacing.sm},segment:{flex:1,minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,alignItems:'center',justifyContent:'center',paddingHorizontal:spacing.sm},segmentSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},segmentText:{...typography.caption,color:colors.inkMuted,textAlign:'center'},segmentTextSelected:{color:colors.primary},result:{backgroundColor:colors.successSoft,borderRadius:radius.md,padding:spacing.lg,gap:spacing.md},resultTitle:{...typography.section,color:colors.success},resultStats:{flexDirection:'row',justifyContent:'space-between',gap:spacing.md},statLabel:{...typography.caption,color:colors.inkMuted},statValue:{...typography.label,color:colors.ink},warning:{...typography.caption,color:colors.warning}});
