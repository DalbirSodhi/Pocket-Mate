import { getTransactions } from '../../finance/services/financeService';
import { getMonthlyInsights } from '../../insights/services/insightsService';
import { summarizeTransactions } from '../../insights/utils/monthlyInsights.cjs';
import {
  buildTransactionCsv,
  getReportFileName,
} from '../utils/reportCsv.cjs';

export async function getMonthlyReport({ userId, monthKey, currencyCode }) {
  const insights = await getMonthlyInsights({ userId, monthKey });
  const transactions = await getTransactions(userId, {
    startDate: insights.startDate,
    endDate: insights.endDate,
    limit: 1000,
  });
  const totals = summarizeTransactions(transactions);

  return {
    ...insights,
    transactions,
    transactionCount: transactions.length,
    totals,
    csv: buildTransactionCsv({ transactions, currencyCode }),
    fileName: getReportFileName(monthKey),
  };
}
