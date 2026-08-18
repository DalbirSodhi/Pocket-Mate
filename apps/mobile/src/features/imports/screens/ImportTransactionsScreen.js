import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, ChevronUp, FileUp, RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { AccountPicker, getAccounts } from '../../accounts';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../../finance/services/financeService';
import { chooseAndParseCsv, getImportHistory, importTransactions, rollbackImport } from '../services/importService';

export function ImportTransactionsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [preview, setPreview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const [rowAssignments, setRowAssignments] = useState({});
  const [categoryOverrides, setCategoryOverrides] = useState(new Set());
  const [accountOverrides, setAccountOverrides] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextCategories, nextAccounts, nextHistory] = await Promise.all([
        ensureExpenseCategories(user.id),
        getAccounts(user.id),
        getImportHistory(user.id),
      ]);
      setCategories(nextCategories); setHistory(nextHistory);
      setAccounts(nextAccounts.filter((account) => account.is_active && (account.isAsset || account.account_type === 'credit_card')));
      setCategoryId((current) => current || nextCategories.find((row) => row.name === 'Other')?.id || nextCategories[0]?.id || '');
    } catch (requestError) { setError(requestError.message || 'Unable to load import tools.'); }
    finally { setLoading(false); }
  }, [user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function chooseFile() {
    setWorking(true); setError(''); setSuccess('');
    try {
      const result = await chooseAndParseCsv(user.id);
      if (result) {
        const assignments = Object.fromEntries(result.transactions.map((row) => [row.fingerprint, {
          categoryId: row.type === 'expense' ? categoryId : null,
          accountId: defaultAccountId || null,
        }]));
        setRowAssignments(assignments);
        setCategoryOverrides(new Set());
        setAccountOverrides(new Set());
        setExpandedRows(new Set());
        setPreview(result);
      }
    }
    catch (requestError) { setError(requestError.message || 'Unable to read this CSV file.'); }
    finally { setWorking(false); }
  }
  async function commit() {
    if (!preview?.acceptedCount) return;
    setWorking(true); setError('');
    try {
      const reviewedPreview = {
        ...preview,
        transactions: preview.transactions.map((row) => ({ ...row, ...rowAssignments[row.fingerprint] })),
      };
      const result = await importTransactions({ userId: user.id, preview: reviewedPreview, categoryId, accountId: defaultAccountId });
      setSuccess(`${result.postedCount} transactions imported. You can undo this batch below.`);
      setPreview(null); await load();
    } catch (requestError) { setError(requestError.message || 'Unable to import these transactions.'); }
    finally { setWorking(false); }
  }
  function updateDefaultCategory(nextCategoryId) {
    setCategoryId(nextCategoryId);
    setRowAssignments((current) => Object.fromEntries(Object.entries(current).map(([fingerprint, assignment]) => [fingerprint, {
      ...assignment,
      ...(!categoryOverrides.has(fingerprint) ? { categoryId: assignment.categoryId === categoryId ? nextCategoryId : assignment.categoryId } : {}),
    }])));
  }
  function updateDefaultAccount(nextAccountId) {
    setDefaultAccountId(nextAccountId);
    setRowAssignments((current) => Object.fromEntries(Object.entries(current).map(([fingerprint, assignment]) => [fingerprint, {
      ...assignment,
      ...(!accountOverrides.has(fingerprint) ? { accountId: nextAccountId || null } : {}),
    }])));
  }
  function updateRowAssignment(fingerprint, field, value) {
    const overrideSet = field === 'categoryId' ? setCategoryOverrides : setAccountOverrides;
    overrideSet((current) => new Set(current).add(fingerprint));
    setRowAssignments((current) => ({ ...current, [fingerprint]: { ...current[fingerprint], [field]: value || null } }));
  }
  function toggleExpanded(fingerprint) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(fingerprint)) next.delete(fingerprint); else next.add(fingerprint);
      return next;
    });
  }
  const reviewedCount = preview?.transactions.filter((row) => row.type !== 'expense' || rowAssignments[row.fingerprint]?.categoryId).length || 0;
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
    {preview ? <View style={styles.preview}><Text style={styles.sectionTitle}>{preview.fileName}</Text><View style={styles.counts}><Text style={styles.good}>{reviewedCount}/{preview.acceptedCount} reviewed</Text><Text style={styles.bad}>{preview.rejectedCount} skipped</Text></View><Text style={styles.reviewHint}>Set batch defaults, then expand a row to correct its assignment.</Text><Text style={styles.label}>Default expense category</Text><View accessibilityRole="radiogroup" style={styles.categories}>{categories.map((category) => <Pressable accessibilityLabel={`Default category ${category.name}`} accessibilityRole="radio" accessibilityState={{checked:categoryId===category.id}} key={category.id} onPress={() => updateDefaultCategory(category.id)} style={[styles.category,categoryId===category.id&&styles.categorySelected]}><Text style={[styles.categoryText,categoryId===category.id&&styles.categoryTextSelected]}>{category.name}</Text></Pressable>)}</View><AccountPicker accounts={accounts} label="Default account (optional)" selectedId={defaultAccountId} onSelect={updateDefaultAccount} currencyCode={currencyCode} /><View style={styles.rows}>{preview.transactions.map((row) => { const assignment = rowAssignments[row.fingerprint] || {}; const expanded = expandedRows.has(row.fingerprint); const hasCategory = row.type !== 'expense' || Boolean(assignment.categoryId); const account = accounts.find((item) => item.id === assignment.accountId); return <View key={row.fingerprint} style={styles.rowGroup}><Pressable accessibilityLabel={`Review row ${row.sourceRowNumber}, ${row.description}`} accessibilityRole="button" accessibilityState={{expanded}} onPress={() => toggleExpanded(row.fingerprint)} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.description}</Text><Text style={styles.rowBody}>{row.date} • {row.type} • {hasCategory ? 'Ready' : 'Needs category'}{assignment.accountId ? ` • ${account?.name || 'Account assigned'}` : ' • No account'}</Text></View><Text style={styles.rowAmount}>{formatCurrency(row.amountCents,currencyCode)}</Text>{expanded ? <ChevronUp color={colors.inkMuted} size={18} /> : <ChevronDown color={colors.inkMuted} size={18} />}</Pressable>{expanded ? <View style={styles.rowEditor}>{row.type === 'expense' ? <View><Text style={styles.editorLabel}>Expense category</Text><View style={styles.categories}>{categories.map((category) => <Pressable accessibilityLabel={`Row ${row.sourceRowNumber} category ${category.name}`} accessibilityRole="radio" accessibilityState={{checked:assignment.categoryId===category.id}} key={category.id} onPress={() => updateRowAssignment(row.fingerprint, 'categoryId', category.id)} style={[styles.category,assignment.categoryId===category.id&&styles.categorySelected]}><Text style={[styles.categoryText,assignment.categoryId===category.id&&styles.categoryTextSelected]}>{category.name}</Text></Pressable>)}</View></View> : null}<AccountPicker accounts={accounts} label="Row account (optional)" selectedId={assignment.accountId || ''} onSelect={(value) => updateRowAssignment(row.fingerprint, 'accountId', value)} currencyCode={currencyCode} /></View> : null}</View>; })}</View>{preview.errors.slice(0,5).map((row) => <Text key={row.rowNumber} style={styles.errorRow}>Row {row.rowNumber}: {row.issues.map((issue) => issue.message).join(' ')}</Text>)}<AppButton disabled={!preview.acceptedCount || reviewedCount !== preview.acceptedCount} isLoading={working} label={reviewedCount === preview.acceptedCount ? `Import ${preview.acceptedCount} transactions` : `Review ${preview.acceptedCount - reviewedCount} expense rows`} onPress={commit} /></View> : null}
    <View style={styles.section}><Text style={styles.sectionTitle}>Import history</Text><View style={styles.history}>{history.map((batch) => <View key={batch.id} style={styles.historyRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{batch.file_name}</Text><Text style={styles.rowBody}>{batch.posted_count} posted • {batch.status.replace('_',' ')}</Text></View>{batch.status==='posted' ? <Pressable accessibilityLabel={`Undo ${batch.file_name}`} accessibilityRole="button" disabled={working} onPress={() => confirmRollback(batch)} style={styles.undo}><RotateCcw color={colors.danger} size={18} /></Pressable> : null}</View>)}</View></View>
  </View></ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:colors.canvas},scroll:{paddingHorizontal:spacing.lg,paddingTop:spacing.md,paddingBottom:spacing.xxxl},content:{width:'100%',maxWidth:680,alignSelf:'center',gap:spacing.xl},preview:{gap:spacing.lg},section:{gap:spacing.md},sectionTitle:{...typography.section,color:colors.ink},counts:{flexDirection:'row',gap:spacing.lg},good:{...typography.label,color:colors.success},bad:{...typography.label,color:colors.danger},reviewHint:{...typography.caption,color:colors.inkMuted},label:{...typography.label,color:colors.ink},editorLabel:{...typography.label,color:colors.ink,marginBottom:spacing.sm},categories:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},category:{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,justifyContent:'center'},categorySelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},categoryText:{...typography.caption,color:colors.inkMuted},categoryTextSelected:{color:colors.primary},rows:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},rowGroup:{borderBottomWidth:1,borderBottomColor:colors.border},row:{minHeight:60,flexDirection:'row',alignItems:'center',gap:spacing.md},rowEditor:{padding:spacing.md,gap:spacing.lg,backgroundColor:colors.surfaceMuted},rowCopy:{flex:1,minWidth:0},rowTitle:{...typography.label,color:colors.ink},rowBody:{...typography.caption,color:colors.inkMuted,textTransform:'capitalize'},rowAmount:{...typography.label,color:colors.ink},errorRow:{...typography.caption,color:colors.danger},history:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},historyRow:{minHeight:64,flexDirection:'row',alignItems:'center',gap:spacing.md,borderBottomWidth:1,borderBottomColor:colors.border},undo:{width:44,height:44,alignItems:'center',justifyContent:'center'}});
