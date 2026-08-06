import { useFocusEffect } from '@react-navigation/native';
import { Check, Plus, Tags, Trash2, WandSparkles, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { ensureExpenseCategories } from '../services/financeService';
import {
  createCategorizationRule,
  createTag,
  deleteCategorizationRule,
  getCategorizationRules,
  getReviewItems,
  getTags,
  resolveReviewItem,
  setCategorizationRuleActive,
} from '../services/transactionWorkflowService';

const TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'tags', label: 'Tags' },
  { id: 'review', label: 'Review' },
];
const FIELDS = [{ id: 'merchant', label: 'Merchant' }, { id: 'note', label: 'Note' }];
const OPERATORS = [{ id: 'contains', label: 'Contains' }, { id: 'starts_with', label: 'Starts with' }, { id: 'exact', label: 'Exactly' }];

export function AutomationScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [tags, setTags] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ruleName, setRuleName] = useState('');
  const [matchField, setMatchField] = useState('merchant');
  const [operator, setOperator] = useState('contains');
  const [matchValue, setMatchValue] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reviewAction, setReviewAction] = useState('approve');
  const [tagName, setTagName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [nextRules, nextTags, nextReviews, nextCategories] = await Promise.all([
        getCategorizationRules(user.id), getTags(user.id), getReviewItems(user.id), ensureExpenseCategories(user.id),
      ]);
      setRules(nextRules); setTags(nextTags); setReviews(nextReviews); setCategories(nextCategories);
      setCategoryId((current) => nextCategories.some((category) => category.id === current) ? current : nextCategories[0]?.id || '');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load automation settings.');
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleCreateRule() {
    if (ruleName.trim().length < 2 || !matchValue.trim() || !categoryId) {
      setError('Add a rule name, match text, and category.'); return;
    }
    setIsSaving(true); setError('');
    try {
      await createCategorizationRule({ userId: user.id, name: ruleName, matchField, operator, matchValue, categoryId, reviewAction });
      setRuleName(''); setMatchValue(''); await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Unable to create this rule.');
    } finally { setIsSaving(false); }
  }

  async function handleCreateTag() {
    if (tagName.trim().length < 2) { setError('Enter a tag name.'); return; }
    setIsSaving(true); setError('');
    try { await createTag({ userId: user.id, name: tagName }); setTagName(''); await loadData(); }
    catch (requestError) { setError(requestError.message || 'Unable to create this tag.'); }
    finally { setIsSaving(false); }
  }

  async function resolve(item, status) {
    try { await resolveReviewItem({ userId: user.id, reviewItemId: item.id, status }); await loadData(); }
    catch (requestError) { setError(requestError.message || 'Unable to update this review.'); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ScreenHeader onBack={navigation.goBack} subtitle="Consistent categories with explicit review" title="Rules and tags" />
          <InlineNotice message={error} variant="error" />
          <View style={styles.tabs}>{TABS.map((item) => { const selected = tab === item.id; return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, selected && styles.tabSelected]}><Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{item.label}{item.id === 'review' && reviews.length ? ` (${reviews.length})` : ''}</Text></Pressable>; })}</View>

          {tab === 'rules' ? (
            <>
              <View style={styles.form}>
                <Text style={styles.sectionTitle}>New category rule</Text>
                <FormField label="Rule name" onChangeText={setRuleName} placeholder="Coffee shops" value={ruleName} />
                <ChoiceRow label="Match field" options={FIELDS} selected={matchField} onSelect={setMatchField} />
                <ChoiceRow label="Condition" options={OPERATORS} selected={operator} onSelect={setOperator} />
                <FormField label="Text to match" onChangeText={setMatchValue} placeholder="Starbucks" value={matchValue} />
                <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>Set category</Text><View style={styles.wrap}>{categories.map((category) => <Choice key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />)}</View></View>
                <ChoiceRow label="After matching" options={[{ id: 'approve', label: 'Approve' }, { id: 'needs_review', label: 'Review first' }]} selected={reviewAction} onSelect={setReviewAction} />
                <AppButton icon={WandSparkles} isLoading={isSaving} label="Create rule" onPress={handleCreateRule} />
              </View>
              <View style={styles.list}>{rules.map((rule, index) => <View key={rule.id}><View style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{rule.name}</Text><Text style={styles.rowBody}>{rule.match_field} {rule.operator.replace('_', ' ')} “{rule.match_value}” → {rule.expense_categories?.name || 'Category'}</Text></View><Switch value={rule.is_active} onValueChange={async (value) => { await setCategorizationRuleActive({ userId: user.id, ruleId: rule.id, isActive: value }); await loadData(); }} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} /><Pressable accessibilityLabel={`Delete ${rule.name}`} accessibilityRole="button" onPress={async () => { await deleteCategorizationRule({ userId: user.id, ruleId: rule.id }); await loadData(); }} style={styles.iconButton}><Trash2 color={colors.danger} size={18} /></Pressable></View>{index < rules.length - 1 ? <View style={styles.divider} /> : null}</View>)}{!rules.length ? <Empty icon={WandSparkles} text="No rules yet." /> : null}</View>
            </>
          ) : null}

          {tab === 'tags' ? (
            <>
              <View style={styles.form}><Text style={styles.sectionTitle}>Create tag</Text><FormField label="Tag name" onChangeText={setTagName} placeholder="Work, reimbursable, vacation" value={tagName} /><AppButton icon={Plus} isLoading={isSaving} label="Create tag" onPress={handleCreateTag} /></View>
              <View style={styles.wrap}>{tags.map((tag) => <View key={tag.id} style={styles.tag}><View style={[styles.tagDot, { backgroundColor: tag.color || colors.primary }]} /><Text style={styles.tagLabel}>{tag.name}</Text></View>)}{!tags.length ? <Empty icon={Tags} text="No tags yet." /> : null}</View>
            </>
          ) : null}

          {tab === 'review' ? (
            <View style={styles.list}>{reviews.map((item, index) => <View key={item.id}><View style={styles.reviewRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.expenses?.merchant || 'Expense'}</Text><Text style={styles.rowBody}>{formatCurrency(item.expenses?.amount_cents || 0, currencyCode)} • {item.reason}</Text></View><Pressable accessibilityLabel="Approve" accessibilityRole="button" onPress={() => resolve(item, 'approved')} style={[styles.reviewButton, styles.approveButton]}><Check color={colors.success} size={19} /></Pressable><Pressable accessibilityLabel="Ignore" accessibilityRole="button" onPress={() => resolve(item, 'ignored')} style={[styles.reviewButton, styles.ignoreButton]}><X color={colors.inkMuted} size={19} /></Pressable></View>{index < reviews.length - 1 ? <View style={styles.divider} /> : null}</View>)}{!reviews.length ? <Empty icon={Check} text="Nothing needs review." /> : null}</View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceRow({ label, options, selected, onSelect }) { return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.wrap}>{options.map((option) => <Choice key={option.id} label={option.label} selected={selected === option.id} onPress={() => onSelect(option.id)} />)}</View></View>; }
function Choice({ label, selected, onPress }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text></Pressable>; }
function Empty({ icon: Icon, text }) { return <View style={styles.empty}><Icon color={colors.inkMuted} size={22} /><Text style={styles.rowBody}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xl },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }, tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, tabSelected: { borderBottomWidth: 2, borderColor: colors.primary }, tabLabel: { ...typography.label, color: colors.inkMuted }, tabLabelSelected: { color: colors.primary },
  form: { gap: spacing.lg }, sectionTitle: { ...typography.section, color: colors.ink }, fieldGroup: { gap: spacing.sm }, fieldLabel: { ...typography.label, color: colors.ink }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' }, choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceLabel: { ...typography.caption, color: colors.inkMuted }, choiceLabelSelected: { color: colors.primary, fontWeight: '700' },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { ...typography.label, color: colors.ink }, rowBody: { ...typography.caption, color: colors.inkMuted }, iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, divider: { height: 1, backgroundColor: colors.border },
  tag: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, tagDot: { width: 10, height: 10, borderRadius: radius.round }, tagLabel: { ...typography.label, color: colors.ink },
  reviewRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reviewButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, approveButton: { backgroundColor: colors.successSoft }, ignoreButton: { backgroundColor: colors.surfaceMuted }, empty: { minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
