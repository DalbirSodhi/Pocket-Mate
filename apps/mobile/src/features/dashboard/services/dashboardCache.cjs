const DASHBOARD_CACHE_VERSION = 2;

function getDashboardSummaryCacheKey(userId) {
  if (!userId) {
    return null;
  }

  return `pocket-mate:dashboard-summary:v${DASHBOARD_CACHE_VERSION}:${userId}`;
}

function createDashboardCacheRecord(summary, cachedAt = new Date()) {
  return {
    version: DASHBOARD_CACHE_VERSION,
    cachedAt: cachedAt.toISOString(),
    summary,
  };
}

function parseDashboardCacheRecord(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed?.version !== DASHBOARD_CACHE_VERSION ||
      !parsed.cachedAt ||
      !parsed.summary
    ) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

function formatCachedAt(cachedAt, now = new Date()) {
  const cachedDate = new Date(cachedAt);

  if (Number.isNaN(cachedDate.getTime())) {
    return 'last saved dashboard';
  }

  const minutes = Math.max(
    Math.round((now.getTime() - cachedDate.getTime()) / 60000),
    0,
  );

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

module.exports = {
  DASHBOARD_CACHE_VERSION,
  createDashboardCacheRecord,
  formatCachedAt,
  getDashboardSummaryCacheKey,
  parseDashboardCacheRecord,
};
