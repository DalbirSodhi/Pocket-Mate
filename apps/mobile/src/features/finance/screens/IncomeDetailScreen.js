import { useFocusEffect } from '@react-navigation/native';
import { Banknote, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  deleteIncomeEntry,
  getIncomeDetail,
} from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function IncomeDetailScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { incomeId, currencyCode = 'CAD' } = route.params;
  const [income, setIncome] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadIncome = useCallback(async () => {
    setError('');

    try {
      setIncome(await getIncomeDetail({ userId: user.id, incomeId }));
    } catch (requestError) {
      setError(
        getFinanceErrorMessage(requestError, 'Unable to load this income entry.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [incomeId, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadIncome();
    }, [loadIncome]),
  );

  function confirmDelete() {
    Alert.alert(
      'Delete income?',
      'This will immediately update your monthly balance and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            setError('');

            try {
              await deleteIncomeEntry({ userId: user.id, incomeId });
              navigation.goBack();
            } catch (requestError) {
              setError(
                getFinanceErrorMessage(
                  requestError,
                  'Unable to delete this income entry.',
                ),
              );
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Loading income entry..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Income details"
            title={income?.source || 'Income'}
          />
          <InlineNotice message={error} variant="error" />

          {income ? (
            <>
              <View style={styles.amountPanel}>
                <View style={styles.amountIcon}>
                  <Banknote color={colors.success} size={23} />
                </View>
                <View style={styles.amountCopy}>
                  <Text style={styles.amountLabel}>Amount received</Text>
                  <Text style={styles.amountValue}>
                    {formatCurrency(income.amount_cents, currencyCode)}
                  </Text>
                </View>
              </View>

              <View style={styles.details}>
                <DetailRow label="Date" value={income.received_on} />
                {income.note ? (
                  <>
                    <View style={styles.divider} />
                    <DetailRow label="Note" value={income.note} />
                  </>
                ) : null}
              </View>

              <View style={styles.actions}>
                <AppButton
                  icon={Pencil}
                  label="Edit income"
                  onPress={() =>
                    navigation.navigate('AddIncome', { incomeId, currencyCode })
                  }
                  style={styles.action}
                  variant="secondary"
                />
                <AppButton
                  icon={Trash2}
                  isLoading={isDeleting}
                  label="Delete"
                  onPress={confirmDelete}
                  style={styles.action}
                  variant="danger"
                />
              </View>
            </>
          ) : null}
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
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  amountPanel: {
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  amountIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  amountLabel: { ...typography.caption, color: colors.inkMuted },
  amountValue: { ...typography.title, color: colors.ink },
  details: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  detailRow: { paddingVertical: spacing.lg, gap: spacing.xs },
  detailLabel: { ...typography.caption, color: colors.inkMuted },
  detailValue: { ...typography.body, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
