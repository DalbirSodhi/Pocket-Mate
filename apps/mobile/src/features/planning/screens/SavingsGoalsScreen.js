import { useFocusEffect } from '@react-navigation/native';
import { History, PiggyBank, Plus, Undo2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
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
import { AccountPicker, getAccounts } from '../../accounts';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  isValidDateString,
  getLocalDateString,
  parseAmountToCents,
} from '../../finance/utils/financeValidation.cjs';
import {
  addSavingsGoalProgress,
  createSavingsGoal,
  getSavingsContributionHistory,
  getSavingsGoals,
  recordSavingsGoalContribution,
  setSavingsGoalActive,
  undoSavingsGoalContribution,
} from '../services/planningService';

export function SavingsGoalsScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [contributionGoalId, setContributionGoalId] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(getLocalDateString());
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const loadGoals = useCallback(async () => {
    setIsRefreshing(true);
    setRequestError('');

    try {
      const [nextGoals, nextAccounts, nextContributions] = await Promise.all([
        getSavingsGoals(user.id),
        getAccounts(user.id),
        getSavingsContributionHistory(user.id),
      ]);
      setGoals(nextGoals);
      setAccounts(nextAccounts);
      setContributions(nextContributions);

      const sourceAccounts = nextAccounts.filter(
        (account) =>
          account.is_active && ['checking', 'cash'].includes(account.account_type),
      );
      const savingsAccounts = nextAccounts.filter(
        (account) => account.is_active && account.account_type === 'savings',
      );
      setFromAccountId((current) =>
        sourceAccounts.some((account) => account.id === current)
          ? current
          : sourceAccounts[0]?.id || '',
      );
      setToAccountId((current) =>
        savingsAccounts.some((account) => account.id === current)
          ? current
          : savingsAccounts[0]?.id || '',
      );
    } catch (error) {
      setRequestError(error.message || 'Unable to load savings goals.');
    } finally {
      setIsRefreshing(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals]),
  );

  const monthlyTotal = useMemo(
    () =>
      goals
        .filter((goal) => goal.is_active)
        .reduce(
          (total, goal) => total + goal.monthly_contribution_cents,
          0,
        ),
    [goals],
  );

  async function handleCreate() {
    const nextErrors = {};
    const targetAmountCents = parseAmountToCents(targetAmount);
    const monthlyContributionCents = parseAmountToCents(monthlyContribution);

    if (name.trim().length < 2) {
      nextErrors.name = 'Enter a name for this goal.';
    }
    if (targetAmountCents === null) {
      nextErrors.targetAmount = 'Enter a valid target amount.';
    }
    if (monthlyContributionCents === null) {
      nextErrors.monthlyContribution = 'Enter a valid monthly contribution.';
    }
    if (targetDate && !isValidDateString(targetDate)) {
      nextErrors.targetDate = 'Use a valid date in YYYY-MM-DD format.';
    }

    setErrors(nextErrors);
    setRequestError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      const goal = await createSavingsGoal({
        userId: user.id,
        name,
        targetAmountCents,
        monthlyContributionCents,
        targetDate,
      });
      setGoals((current) => [goal, ...current]);
      setName('');
      setTargetAmount('');
      setMonthlyContribution('');
      setTargetDate('');
    } catch (error) {
      setRequestError(error.message || 'Unable to create this savings goal.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(goal) {
    setUpdatingId(goal.id);
    setRequestError('');

    try {
      await setSavingsGoalActive({
        userId: user.id,
        goalId: goal.id,
        isActive: !goal.is_active,
      });
      setGoals((current) =>
        current.map((item) =>
          item.id === goal.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
    } catch (error) {
      setRequestError(error.message || 'Unable to update this savings goal.');
    } finally {
      setUpdatingId('');
    }
  }

  async function handleRecordContribution(goal) {
    if (accounts.length > 0) {
      if (!sourceAccounts.length || !savingsAccounts.length) {
        setRequestError(
          'Add an active checking or cash account and an active savings account before contributing.',
        );
        return;
      }
      setContributionGoalId(goal.id);
      setContributionAmount(
        String(
          Math.min(
            goal.monthly_contribution_cents,
            goal.target_amount_cents - goal.current_amount_cents,
          ) / 100,
        ),
      );
      setContributionDate(getLocalDateString());
      setErrors({});
      return;
    }

    setUpdatingId(goal.id);
    setRequestError('');

    try {
      const currentAmountCents = await addSavingsGoalProgress({
        userId: user.id,
        goalId: goal.id,
        currentAmountCents: goal.current_amount_cents,
        contributionCents: goal.monthly_contribution_cents,
        targetAmountCents: goal.target_amount_cents,
      });
      setGoals((current) =>
        current.map((item) =>
          item.id === goal.id
            ? { ...item, current_amount_cents: currentAmountCents }
            : item,
        ),
      );
    } catch (error) {
      setRequestError(error.message || 'Unable to record this contribution.');
    } finally {
      setUpdatingId('');
    }
  }

  async function handleSaveAccountBackedContribution(goal) {
    const nextErrors = {};
    const amountCents = parseAmountToCents(contributionAmount);

    if (amountCents === null) {
      nextErrors.contributionAmount = 'Enter an amount greater than zero.';
    } else if (amountCents > goal.target_amount_cents - goal.current_amount_cents) {
      nextErrors.contributionAmount = 'This amount is more than the remaining goal balance.';
    }
    if (!fromAccountId) {
      nextErrors.fromAccount = 'Choose where the money comes from.';
    }
    if (!toAccountId) {
      nextErrors.toAccount = 'Choose a savings account.';
    }
    if (fromAccountId && fromAccountId === toAccountId) {
      nextErrors.toAccount = 'Choose a different savings account.';
    }
    if (!isValidDateString(contributionDate)) {
      nextErrors.contributionDate = 'Use a valid date in YYYY-MM-DD format.';
    }

    setErrors(nextErrors);
    setRequestError('');
    if (Object.keys(nextErrors).length > 0) return;

    setUpdatingId(goal.id);
    try {
      await recordSavingsGoalContribution({
        goalId: goal.id,
        fromAccountId,
        toAccountId,
        amountCents,
        contributedOn: contributionDate,
      });
      setContributionGoalId('');
      setContributionAmount('');
      await loadGoals();
    } catch (error) {
      setRequestError(error.message || 'Unable to record this contribution.');
    } finally {
      setUpdatingId('');
    }
  }

  async function handleUndoContribution(contributionId) {
    setUpdatingId(contributionId);
    setRequestError('');

    try {
      await undoSavingsGoalContribution(contributionId);
      await loadGoals();
    } catch (error) {
      setRequestError(error.message || 'Unable to undo this contribution.');
    } finally {
      setUpdatingId('');
    }
  }

  const sourceAccounts = accounts.filter(
    (account) =>
      account.is_active && ['checking', 'cash'].includes(account.account_type),
  );
  const savingsAccounts = accounts.filter(
    (account) => account.is_active && account.account_type === 'savings',
  );
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadGoals}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Protect money before flexible spending"
            title="Savings goals"
          />

          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <PiggyBank color={colors.iconInk} size={23} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Protected each month</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(monthlyTotal, currencyCode)}
              </Text>
            </View>
          </View>

          <InlineNotice message={requestError} variant="error" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New goal</Text>
            <FormField
              error={errors.name}
              label="Goal name"
              maxLength={80}
              onChangeText={setName}
              placeholder="Emergency fund, vacation, home"
              value={name}
            />
            <FormField
              error={errors.targetAmount}
              keyboardType="decimal-pad"
              label="Target amount"
              onChangeText={setTargetAmount}
              placeholder="0.00"
              value={targetAmount}
            />
            <FormField
              error={errors.monthlyContribution}
              keyboardType="decimal-pad"
              label="Protect each month"
              onChangeText={setMonthlyContribution}
              placeholder="0.00"
              value={monthlyContribution}
            />
            <FormField
              autoCapitalize="none"
              error={errors.targetDate}
              keyboardType="numbers-and-punctuation"
              label="Target date (optional)"
              maxLength={10}
              onChangeText={setTargetDate}
              placeholder="YYYY-MM-DD"
              value={targetDate}
            />
            <AppButton
              icon={Plus}
              isLoading={isSaving}
              label="Create savings goal"
              onPress={handleCreate}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your goals</Text>
            <View style={styles.list}>
              {goals.map((goal, index) => {
                const goalContributions = contributions.filter(
                  (contribution) => contribution.savings_goal_id === goal.id,
                );
                const progress =
                  goal.target_amount_cents > 0
                    ? Math.min(
                        goal.current_amount_cents / goal.target_amount_cents,
                        1,
                      )
                    : 0;

                return (
                  <View key={goal.id}>
                    <View style={styles.goalRow}>
                      <View style={styles.goalCopy}>
                        <Text style={styles.goalTitle}>{goal.name}</Text>
                        <Text style={styles.goalBody}>
                          {formatCurrency(
                            goal.monthly_contribution_cents,
                            currencyCode,
                          )}{' '}
                          monthly
                        </Text>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.round(progress * 100)}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.goalProgress}>
                          {formatCurrency(goal.current_amount_cents, currencyCode)}
                          {' of '}
                          {formatCurrency(goal.target_amount_cents, currencyCode)}
                        </Text>
                        {goal.is_active &&
                        goal.current_amount_cents < goal.target_amount_cents ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={updatingId === goal.id}
                            onPress={() => handleRecordContribution(goal)}
                            style={styles.contributionButton}
                          >
                            <Plus color={colors.primary} size={15} />
                            <Text style={styles.contributionLabel}>
                              {accounts.length === 0 ? 'Track ' : 'Contribute '}
                              {formatCurrency(
                                goal.monthly_contribution_cents,
                                currencyCode,
                              )}
                            </Text>
                          </Pressable>
                        ) : null}
                        {accounts.length === 0 ? (
                          <InlineNotice
                            message="Tracking-only: add accounts to move real money into savings."
                            variant="info"
                          />
                        ) : null}
                        {accounts.length > 0 &&
                        (!sourceAccounts.length || !savingsAccounts.length) ? (
                          <InlineNotice
                            message="Add an active checking or cash account and an active savings account before contributing."
                            variant="warning"
                          />
                        ) : null}
                        {contributionGoalId === goal.id &&
                        sourceAccounts.length &&
                        savingsAccounts.length ? (
                          <View style={styles.contributionForm}>
                            <Text style={styles.contributionFormTitle}>
                              Move money to this goal
                            </Text>
                            <AccountPicker
                              accounts={sourceAccounts}
                              allowUnassigned={false}
                              currencyCode={currencyCode}
                              error={errors.fromAccount}
                              label="From"
                              onSelect={setFromAccountId}
                              selectedId={fromAccountId}
                            />
                            <AccountPicker
                              accounts={savingsAccounts}
                              allowUnassigned={false}
                              currencyCode={currencyCode}
                              error={errors.toAccount}
                              label="To savings"
                              onSelect={setToAccountId}
                              selectedId={toAccountId}
                            />
                            <FormField
                              error={errors.contributionAmount}
                              keyboardType="decimal-pad"
                              label="Amount"
                              onChangeText={setContributionAmount}
                              placeholder="0.00"
                              value={contributionAmount}
                            />
                            <FormField
                              error={errors.contributionDate}
                              label="Contribution date"
                              onChangeText={setContributionDate}
                              placeholder="YYYY-MM-DD"
                              value={contributionDate}
                            />
                            <AppButton
                              icon={Plus}
                              isLoading={updatingId === goal.id}
                              label="Move money to savings"
                              onPress={() => handleSaveAccountBackedContribution(goal)}
                            />
                            <AppButton
                              label="Cancel"
                              onPress={() => setContributionGoalId('')}
                              variant="secondary"
                            />
                          </View>
                        ) : null}
                        {goalContributions.length ? (
                          <View style={styles.history}>
                            <View style={styles.historyTitleRow}>
                              <History color={colors.iconInk} size={16} />
                              <Text style={styles.historyTitle}>Contribution history</Text>
                            </View>
                            {goalContributions.map((contribution) => (
                              <View key={contribution.id} style={styles.historyRow}>
                                <View style={styles.historyCopy}>
                                  <Text style={styles.historyAmount}>
                                    {formatCurrency(contribution.amount_cents, currencyCode)}
                                  </Text>
                                  <Text style={styles.historyBody}>
                                    {contribution.contributed_on} {' from '}
                                    {accountById.get(contribution.from_account_id)?.name || 'Source account'}
                                    {' to '}
                                    {accountById.get(contribution.to_account_id)?.name || 'Savings account'}
                                  </Text>
                                </View>
                                <Pressable
                                  accessibilityLabel={`Undo ${formatCurrency(contribution.amount_cents, currencyCode)} contribution`}
                                  accessibilityRole="button"
                                  disabled={updatingId === contribution.id}
                                  onPress={() => handleUndoContribution(contribution.id)}
                                  style={styles.undoButton}
                                >
                                  <Undo2 color={colors.primary} size={17} />
                                  <Text style={styles.undoLabel}>Undo</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Switch
                        accessibilityLabel={`${goal.is_active ? 'Pause' : 'Resume'} ${goal.name}`}
                        disabled={updatingId === goal.id}
                        onValueChange={() => handleToggle(goal)}
                        thumbColor={colors.white}
                        trackColor={{
                          false: colors.border,
                          true: colors.primary,
                        }}
                        value={goal.is_active}
                      />
                    </View>
                    {index < goals.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                );
              })}
              {goals.length === 0 ? (
                <Text style={styles.emptyLabel}>No savings goals yet.</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
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
  summary: {
    minHeight: 92,
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryLabel: { ...typography.caption, color: colors.panelMuted },
  summaryValue: { ...typography.section, color: colors.white },
  section: { gap: spacing.lg },
  sectionTitle: { ...typography.section, color: colors.ink },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  goalRow: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  goalCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  goalTitle: { ...typography.label, color: colors.ink },
  goalBody: { ...typography.caption, color: colors.inkMuted },
  progressTrack: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
  },
  goalProgress: { ...typography.caption, color: colors.inkMuted },
  contributionButton: {
    minHeight: 32,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contributionLabel: {
    ...typography.label,
    color: colors.primary,
  },
  contributionForm: {
    marginTop: spacing.md,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  contributionFormTitle: {
    ...typography.label,
    color: colors.ink,
  },
  history: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  historyTitle: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
  },
  historyAmount: {
    ...typography.label,
    color: colors.ink,
  },
  historyBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  undoButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  undoLabel: {
    ...typography.label,
    color: colors.primary,
  },
  divider: { height: 1, backgroundColor: colors.border },
  emptyLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
