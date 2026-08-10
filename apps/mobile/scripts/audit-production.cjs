const { spawnSync } = require('node:child_process');

const allowedAdvisories = new Map([
  [
    'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
    { expiresOn: '2026-09-30', reason: 'Expo SDK 54 Metro build-time image parser' },
  ],
  [
    'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    { expiresOn: '2026-09-30', reason: 'Expo SDK 54 Metro build-time image parser' },
  ],
]);

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || result.stdout || 'npm audit did not return JSON.\n');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const today = new Date().toISOString().slice(0, 10);

function blockingAdvisoryUrlsFor(packageName, seen = new Set()) {
  if (seen.has(packageName)) return [];
  seen.add(packageName);

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return [];

  return (vulnerability.via || []).flatMap((cause) => {
    if (typeof cause === 'string') return blockingAdvisoryUrlsFor(cause, seen);
    return cause.url && ['high', 'critical'].includes(cause.severity)
      ? [cause.url]
      : [];
  });
}

const blocking = [];
const allowed = new Set();

for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;

  const urls = [...new Set(blockingAdvisoryUrlsFor(packageName))];
  const isAllowed = urls.length > 0 && urls.every((url) => {
    const exception = allowedAdvisories.get(url);
    return exception && exception.expiresOn >= today;
  });

  if (!isAllowed) {
    blocking.push({ packageName, severity: vulnerability.severity, urls });
  } else {
    urls.forEach((url) => allowed.add(url));
  }
}

if (blocking.length) {
  console.error('Production dependency audit found unapproved high or critical advisories:');
  blocking.forEach(({ packageName, severity, urls }) => {
    console.error(`- ${packageName} (${severity}): ${urls.join(', ') || 'unknown advisory'}`);
  });
  process.exit(1);
}

if (allowed.size) {
  console.warn('Production dependency audit passed with temporary, exact advisory exceptions:');
  [...allowed].forEach((url) => {
    const exception = allowedAdvisories.get(url);
    console.warn(`- ${url} until ${exception.expiresOn}: ${exception.reason}`);
  });
}

console.log('No unapproved high or critical production advisories found.');
