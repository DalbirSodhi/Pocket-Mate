import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createDashboardCacheRecord,
  formatCachedAt,
  getDashboardSummaryCacheKey,
  parseDashboardCacheRecord,
} from './dashboardCache.cjs';

export { formatCachedAt };

export async function loadCachedDashboardSummary(userId) {
  const cacheKey = getDashboardSummaryCacheKey(userId);

  if (!cacheKey) {
    return null;
  }

  try {
    const value = await AsyncStorage.getItem(cacheKey);
    return parseDashboardCacheRecord(value);
  } catch (_error) {
    return null;
  }
}

export async function saveCachedDashboardSummary(userId, summary) {
  const cacheKey = getDashboardSummaryCacheKey(userId);

  if (!cacheKey || !summary) {
    return;
  }

  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify(createDashboardCacheRecord(summary)),
    );
  } catch (_error) {
    // A failed read-only cache write must not block live financial data.
  }
}
