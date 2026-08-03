import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Scale,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { RetryNotice } from '../../../components/RetryNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  getMonthKey,
  shiftMonthKey,
} from '../../insights/utils/monthlyInsights.cjs';
import { exportReportFile } from '../services/exportReport';
import { getMonthlyReport } from '../services/reportService';

const summaryItems = [
  { id: 'incomeCents', label: 'Income', Icon: ArrowDownLeft, color: colors.success },
  { id: 'spentCents', label: 'Spent', Icon: ArrowUpRight, color: colors.danger },
  { id: 'netCents', label: 'Net', Icon: Scale, color: colors.ink },
];

export function MonthlyReportScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [monthKey, setMonthKey] = useState(
    route.params?.monthKey || getMonthKey(),
  );
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadReport = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    setExportMessage('');

    try {
      setReport(
        await getMonthlyReport({ userId: user.id, monthKey, currencyCode }),
      );
    } catch (requestError) {
      setError(requestError.message || 'Unable to load this monthly report.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currencyCode, monthKey, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [loadReport]),
  );

  async function handleExport() {
    if (!report) return;

    setIsExporting(true);
    setError('');
    setExportMessage('');

    try {
      await exportReportFile({
        fileName: report.fileName,
        contents: report.csv,
      });
      setExportMessage(`${report.fileName} is ready.`);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export this report.');
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading && !report) {
    return <LoadingScreen message="Preparing your report..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={loadReport}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Monthly statement and data export"
            title="Monthly report"
          />

          <View style={styles.monthPicker}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              onPress={() => setMonthKey(shiftMonthKey(monthKey, -1))}
              style={styles.monthButton}
            >
              <ChevronLeft color={colors.ink} size={20} />
            </Pressable>
            <Text style={styles.monthLabel}>{report?.label}</Text>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              disabled={monthKey === getMonthKey()}
              onPress={() => setMonthKey(shiftMonthKey(monthKey, 1))}
              style={[
                styles.monthButton,
                monthKey === getMonthKey() && styles.disabled,
              ]}
            >
              <ChevronRight color={colors.ink} size={20} />
            </Pressable>
          </View>

          <RetryNotice
            isRetrying={isRefreshing}
            message={error}
            onRetry={loadReport}
          />
          <InlineNotice message={exportMessage} variant="success" />

          <View style={styles.reportHeader}>
            <View style={styles.reportIcon}>
              <FileSpreadsheet color={colors.white} size={24} />
            </View>
            <View style={styles.reportCopy}>
              <Text style={styles.reportLabel}>Cash movement</Text>
              <Text style={styles.reportValue}>
                {report?.transactionCount || 0} transactions
              </Text>
              <Text style={styles.reportDates}>
                {report?.startDate} to {report?.endDate}
              </Text>
            </View>
          </View>

          <View style={styles.summary}>
            {summaryItems.map(({ id, label, Icon, color }) => (
              <View key={id} style={styles.summaryItem}>
                <View style={styles.summaryHeading}>
                  <Icon color={color} size={17} />
                  <Text style={styles.summaryLabel}>{label}</Text>
                </View>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[styles.summaryValue, { color }]}
                >
                  {formatCurrency(report?.totals?.[id] || 0, currencyCode)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Spending by category</Text>
              <Text style={styles.sectionMeta}>
                {formatCurrency(report?.totalSpentCents || 0, currencyCode)}
              </Text>
            </View>

            {report?.rows?.length ? (
              <View style={styles.categoryList}>
                {report.rows.map((row, index) => (
                  <View key={row.categoryId}>
                    <View style={styles.categoryRow}>
                      <View
                        style={[
                          styles.categorySwatch,
                          { backgroundColor: row.color },
                        ]}
                      />
                      <View style={styles.categoryCopy}>
                        <View style={styles.categoryHeading}>
                          <Text numberOfLines={1} style={styles.categoryName}>
                            {row.name}
                          </Text>
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(row.amountCents, currencyCode)}
                          </Text>
                        </View>
                        <View style={styles.categoryTrack}>
                          <View
                            style={[
                              styles.categoryFill,
                              {
                                backgroundColor: row.color,
                                width: `${Math.max(row.sharePercent, 2)}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.categoryShare}>
                        {row.sharePercent}%
                      </Text>
                    </View>
                    {index < report.rows.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No spending recorded this month.</Text>
            )}
          </View>

          <AppButton
            disabled={!report?.transactionCount}
            icon={FileDown}
            isLoading={isExporting}
            label="Export CSV"
            onPress={handleExport}
          />
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
    gap: spacing.xl,
  },
  monthPicker: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  monthLabel: { ...typography.section, color: colors.ink },
  reportHeader: {
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.darkPanel,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  reportLabel: { ...typography.caption, color: colors.panelMuted },
  reportValue: { ...typography.section, color: colors.white },
  reportDates: { ...typography.caption, color: colors.panelMuted },
  summary: {
    minHeight: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: { flex: 1, minWidth: 0, gap: spacing.sm },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryLabel: { ...typography.caption, color: colors.inkMuted },
  summaryValue: { ...typography.label, fontSize: 16 },
  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...typography.section, color: colors.ink },
  sectionMeta: { ...typography.label, color: colors.ink },
  categoryList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  categoryRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categorySwatch: { width: 10, height: 38, borderRadius: radius.sm },
  categoryCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  categoryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryName: { ...typography.label, color: colors.ink, flex: 1 },
  categoryAmount: { ...typography.caption, color: colors.ink },
  categoryTrack: {
    height: 4,
    borderRadius: radius.round,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  categoryFill: { height: '100%', borderRadius: radius.round },
  categoryShare: {
    ...typography.caption,
    color: colors.inkMuted,
    width: 38,
    textAlign: 'right',
  },
  divider: { height: 1, marginLeft: 22, backgroundColor: colors.border },
  emptyText: {
    ...typography.caption,
    color: colors.inkMuted,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
