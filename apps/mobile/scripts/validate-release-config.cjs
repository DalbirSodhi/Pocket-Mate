const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appConfig = require(path.join(root, 'app.json')).expo;
const easConfig = require(path.join(root, 'eas.json'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertAsset(relativePath, label) {
  assert(typeof relativePath === 'string', `${label} must be configured`);
  assert(
    fs.existsSync(path.resolve(root, relativePath)),
    `${label} does not exist: ${relativePath}`,
  );
}

function validateIdentifier(value, label) {
  assert(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(value),
    `${label} must use reverse-domain notation`,
  );
}

assert(/^\d+\.\d+\.\d+$/.test(appConfig.version), 'App version must be semantic');
assert(appConfig.scheme === 'pocketmate', 'Deep-link scheme must remain pocketmate');
assert(
  appConfig.runtimeVersion?.policy === 'appVersion',
  'Runtime version must track the public app version',
);

validateIdentifier(appConfig.ios?.bundleIdentifier, 'iOS bundle identifier');
validateIdentifier(appConfig.android?.package, 'Android package');
assert(/^\d+$/.test(appConfig.ios?.buildNumber), 'iOS build number must be numeric');
assert(
  Number.isInteger(appConfig.android?.versionCode) && appConfig.android.versionCode > 0,
  'Android version code must be a positive integer',
);

assertAsset(appConfig.icon, 'App icon');
assertAsset(appConfig.web?.favicon, 'Web favicon');
assertAsset(appConfig.android?.adaptiveIcon?.foregroundImage, 'Android foreground icon');
assertAsset(appConfig.android?.adaptiveIcon?.backgroundImage, 'Android background icon');
assertAsset(appConfig.android?.adaptiveIcon?.monochromeImage, 'Android monochrome icon');

const expectedProfiles = {
  development: 'development',
  preview: 'preview',
  production: 'production',
};

for (const [profileName, environmentName] of Object.entries(expectedProfiles)) {
  const profile = easConfig.build?.[profileName];
  assert(profile, `Missing EAS ${profileName} build profile`);
  assert(
    profile.environment === environmentName,
    `${profileName} must use the ${environmentName} EAS environment`,
  );
}

assert(
  easConfig.build.development.developmentClient === true &&
    easConfig.build.development.distribution === 'internal',
  'Development must produce an internal development-client build',
);
assert(
  easConfig.build.preview.distribution === 'internal',
  'Preview must produce an installable internal build',
);
assert(
  easConfig.build.production.autoIncrement === true,
  'Production builds must auto-increment store build versions',
);
assert(easConfig.submit?.production, 'Missing production submit profile');

const serializedConfig = JSON.stringify({ appConfig, easConfig }).toUpperCase();
assert(
  !serializedConfig.includes('SERVICE_ROLE'),
  'Release configuration must never contain a Supabase service-role key',
);

console.log('Release configuration is valid.');
