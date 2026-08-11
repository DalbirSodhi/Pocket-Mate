const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createDashboardCacheRecord,
  formatCachedAt,
  getDashboardSummaryCacheKey,
  parseDashboardCacheRecord,
} = require('./dashboardCache.cjs');

test('dashboard cache keys are user scoped and versioned', () => {
  assert.equal(
    getDashboardSummaryCacheKey('user-123'),
    'pocket-mate:dashboard-summary:v1:user-123',
  );
  assert.equal(getDashboardSummaryCacheKey(''), null);
});

test('dashboard cache records round trip valid summaries', () => {
  const record = createDashboardCacheRecord(
    { incomeCents: 120000 },
    new Date('2026-08-10T10:00:00.000Z'),
  );

  assert.deepEqual(
    parseDashboardCacheRecord(JSON.stringify(record)),
    {
      version: 1,
      cachedAt: '2026-08-10T10:00:00.000Z',
      summary: { incomeCents: 120000 },
    },
  );
});

test('dashboard cache parser ignores stale or malformed records', () => {
  assert.equal(parseDashboardCacheRecord('{'), null);
  assert.equal(
    parseDashboardCacheRecord(JSON.stringify({ version: 0, summary: {} })),
    null,
  );
});

test('cached age copy stays human readable', () => {
  assert.equal(
    formatCachedAt(
      '2026-08-10T10:00:00.000Z',
      new Date('2026-08-10T10:45:00.000Z'),
    ),
    '45 minutes ago',
  );
});
