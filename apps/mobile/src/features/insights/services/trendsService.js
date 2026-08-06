import { getTransactions } from '../../finance/services/financeService';
import { buildCashFlowTrend } from '../utils/cashFlowTrends.cjs';
import { getMonthRangeForKey, shiftMonthKey } from '../utils/monthlyInsights.cjs';

export async function getCashFlowTrends({ userId, endMonthKey, monthCount = 6 }) {
  const start = getMonthRangeForKey(shiftMonthKey(endMonthKey, -monthCount + 1));
  const end = getMonthRangeForKey(endMonthKey);
  const transactions = await getTransactions(userId, {
    startDate: start.startDate,
    endDate: end.endDate,
    limit: 5000,
  });
  return buildCashFlowTrend(transactions, endMonthKey, monthCount);
}
