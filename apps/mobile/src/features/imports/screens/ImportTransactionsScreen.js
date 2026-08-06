import { useFocusEffect } from '@react-navigation/native';
import { FileUp, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../../finance/services/financeService';
import { chooseAndParseCsv, getImportHistory, importTransactions, rollbackImport } from '../services/importService';

export function ImportTransactionsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [preview, setPreview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextCategories, nextHistory] = await Promise.all([ensureExpenseCategories(user.id), getImportHistory(user.id)]);
      setCategories(nextCategories); setHistory(nextHistory);
      setCategoryId((current) => current || nextCategories.find((row) => row.name === 'Other')?.id || nextCategories[0]?.id || '');
    } catch (requestError) { setError(requestError.message || 'Unable to load import tools.'); }
    finally { setLoading(false); }
  }, [user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function chooseFile() {
    setWorking(true); setError(''); setSuccess('');
    try { const result = await chooseAndParseCsv(user.id); if (result) setPreview(result); }
    catch (requestError) { setError(requestError.message || 'Unable to read this CSV file.'); }
    finally { setWorking(false); }
  }
  async function commit() {
    if (!preview?.acceptedCount || !categoryId) return;
    setWorking(true); setError('');
    try {
      const result = await importTransactions({ userId: user.id, preview, categoryId });
      setSuccess(`${result.postedCount} transactions imported. You can undo this batch below.`);
      setPreview(null); await load();
    } catch (requestError) { setError(requestError.message || 'Unable to import these transactions.'); }
    finally { setWorking(false); }
  }
  function confirmRollback(batch) {
    const perform = async () => { setWorking(true); try { const count = await rollbackImport(batch.id); setSuccess(`${count} imported transactions removed.`); await load(); } catch (requestError) { setError(requestError.message || 'Unable to undo this import.'); } finally { setWorking(false); } };
    if (Platform.OS === 'web') { if (window.confirm(`Undo ${batch.file_name}?`)) perform(); }
    else Alert.alert('Undo this import?', 'Imported ledger entries from this batch will be removed.', [{text:'Cancel',style:'cancel'},{text:'Undo import',style:'destructive',onPress:perform}]);
  }
  if (loading && !history.length) return <LoadingScreen message="Loading import history..." />;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.scroll}><View style={styles.content}>
    <ScreenHeader onBack={navigation.goBack} subtitle="Review duplicates before they reach your ledger" title="Import CSV" />
    <InlineNotice message={error} variant="error" /><InlineNotice message={success} variant="success" />
    <InlineNotice message="Accepted headers include date, amount or debit/credit, description or merchant, and optional type. Negative amounts are expenses." variant="info" />
    <AppButton icon={FileUp} isLoading={working} label="Choose CSV file" onPress={chooseFile} variant="secondary" />
    {preview ? <View style={styles.preview}><Text style={styles.sectionTitle}>{preview.fileName}</Text><View style={styles.counts}><Text style={styles.good}>{preview.acceptedCount} ready</Text><Text style={styles.bad}>{preview.rejectedCount} skipped</Text></View><Text style={styles.label}>Expense category</Text><View style={styles.categories}>{categories.map((category) => <Pressable accessibilityRole="radio" accessibilityState={{checked:categoryId===category.id}} key={category.id} onPress={() => setCategoryId(category.id)} style={[styles.category,categoryId===category.id&&styles.categorySelected]}><Text style={[styles.categoryText,categoryId===category.id&&styles.categoryTextSelected]}>{category.name}</Text></Pressable>)}</View><View style={styles.rows}>{preview.transactions.slice(0,8).map((row) => <View key={row.fingerprint} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.description}</Text><Text style={styles.rowBody}>{row.date} • {row.type}</Text></View><Text style={styles.rowAmount}>{formatCurrency(row.amountCents,currencyCode)}</Text></View>)}</View>{preview.errors.slice(0,5).map((row) => <Text key={row.rowNumber} style={styles.errorRow}>Row {row.rowNumber}: {row.issues.map((issue) => issue.message).join(' ')}</Text>)}<AppButton disabled={!preview.acceptedCount} isLoading={working} label={`Import ${preview.acceptedCount} transactions`} onPress={commit} /></View> : null}
    <View style={styles.section}><Text style={styles.sectionTitle}>Import history</Text><View style={styles.history}>{history.map((batch) => <View key={batch.id} style={styles.historyRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{batch.file_name}</Text><Text style={styles.rowBody}>{batch.posted_count} posted • {batch.status.replace('_',' ')}</Text></View>{batch.status==='posted' ? <Pressable accessibilityLabel={`Undo ${batch.file_name}`} accessibilityRole="button" disabled={working} onPress={() => confirmRollback(batch)} style={styles.undo}><RotateCcw color={colors.danger} size={18} /></Pressable> : null}</View>)}</View></View>
  </View></ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:colors.canvas},scroll:{paddingHorizontal:spacing.lg,paddingTop:spacing.md,paddingBottom:spacing.xxxl},content:{width:'100%',maxWidth:680,alignSelf:'center',gap:spacing.xl},preview:{gap:spacing.lg},section:{gap:spacing.md},sectionTitle:{...typography.section,color:colors.ink},counts:{flexDirection:'row',gap:spacing.lg},good:{...typography.label,color:colors.success},bad:{...typography.label,color:colors.danger},label:{...typography.label,color:colors.ink},categories:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},category:{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,justifyContent:'center'},categorySelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},categoryText:{...typography.caption,color:colors.inkMuted},categoryTextSelected:{color:colors.primary},rows:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},row:{minHeight:60,flexDirection:'row',alignItems:'center',gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border},rowCopy:{flex:1,minWidth:0},rowTitle:{...typography.label,color:colors.ink},rowBody:{...typography.caption,color:colors.inkMuted,textTransform:'capitalize'},rowAmount:{...typography.label,color:colors.ink},errorRow:{...typography.caption,color:colors.danger},history:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},historyRow:{minHeight:64,flexDirection:'row',alignItems:'center',gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border},undo:{width:44,height:44,alignItems:'center',justifyContent:'center'}});
