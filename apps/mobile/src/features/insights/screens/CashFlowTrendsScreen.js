import { useFocusEffect } from '@react-navigation/native';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '../../../components/LoadingScreen';
import { RetryNotice } from '../../../components/RetryNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { getMonthKey } from '../utils/monthlyInsights.cjs';
import { getCashFlowTrends } from '../services/trendsService';

export function CashFlowTrendsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try { setTrend(await getCashFlowTrends({ userId: user.id, endMonthKey: getMonthKey() })); }
    catch (requestError) { setError(requestError.message || 'Unable to load cash-flow trends.'); }
    finally { setRefreshing(false); }
  }, [user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!trend && refreshing) return <LoadingScreen message="Building your cash-flow trend..." />;
  const scale = Math.max(...(trend?.months || []).flatMap((row) => [row.incomeCents, row.spentCents]), 1);

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}><View style={styles.content}>
    <ScreenHeader onBack={navigation.goBack} subtitle="Six months of money in and out" title="Cash-flow trends" />
    <RetryNotice message={error} onRetry={load} isRetrying={refreshing} />
    <View style={styles.summary}><View><Text style={styles.summaryLabel}>Average monthly net</Text><Text style={styles.summaryValue}>{formatCurrency(trend?.averageNetCents || 0, currencyCode)}</Text></View><View style={styles.change}>{(trend?.netChangeCents || 0) >= 0 ? <ArrowUpRight color={colors.success} size={18} /> : <ArrowDownRight color={colors.danger} size={18} />}<Text style={styles.changeText}>{formatCurrency(Math.abs(trend?.netChangeCents || 0), currencyCode)} vs last month</Text></View></View>
    <View style={styles.chart}>{trend?.months.map((month) => <View key={month.monthKey} style={styles.month}><Text style={styles.monthLabel}>{month.label.slice(0, 3)}</Text><View style={styles.barRow}><View style={[styles.bar, styles.incomeBar, { width: `${Math.round((month.incomeCents / scale) * 100)}%` }]} /><Text style={styles.amount}>{formatCurrency(month.incomeCents, currencyCode)}</Text></View><View style={styles.barRow}><View style={[styles.bar, styles.spentBar, { width: `${Math.round((month.spentCents / scale) * 100)}%` }]} /><Text style={styles.amount}>{formatCurrency(month.spentCents, currencyCode)}</Text></View><Text style={[styles.net, month.netCents < 0 && styles.netNegative]}>Net {formatCurrency(month.netCents, currencyCode)}{month.savingsRate === null ? '' : ` • ${month.savingsRate}% saved`}</Text></View>)}</View>
    <Text style={styles.legend}>Green is income. Orange is spending after refunds. Transfers are excluded.</Text>
  </View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:colors.canvas},scroll:{paddingHorizontal:spacing.lg,paddingTop:spacing.md,paddingBottom:spacing.xxxl},content:{width:'100%',maxWidth:720,alignSelf:'center',gap:spacing.xl},summary:{borderRadius:radius.md,backgroundColor:colors.darkPanel,padding:spacing.lg,gap:spacing.md},summaryLabel:{...typography.caption,color:colors.panelMuted},summaryValue:{...typography.title,color:colors.white},change:{flexDirection:'row',alignItems:'center',gap:spacing.sm},changeText:{...typography.caption,color:colors.panelMuted},chart:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},month:{paddingVertical:spacing.md,gap:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},monthLabel:{...typography.label,color:colors.ink},barRow:{minHeight:24,justifyContent:'center'},bar:{position:'absolute',height:20,borderRadius:radius.sm,minWidth:2},incomeBar:{backgroundColor:colors.successSoft},spentBar:{backgroundColor:colors.primarySoft},amount:{...typography.caption,color:colors.ink,paddingHorizontal:spacing.sm},net:{...typography.caption,color:colors.success},netNegative:{color:colors.danger},legend:{...typography.caption,color:colors.inkMuted} });
