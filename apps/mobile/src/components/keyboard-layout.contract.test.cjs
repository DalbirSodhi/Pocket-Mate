const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentsRoot = path.dirname(require.resolve('./AppButton.js'));
const mobileRoot = path.resolve(componentsRoot, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

test('editable screens keep inputs reachable while the keyboard is open', () => {
  const screensRoot = path.join(mobileRoot, 'src/features');
  const editableScreens = walk(screensRoot).filter((filePath) => {
    if (!filePath.endsWith('Screen.js')) return false;
    return /FormField|TextInput/.test(fs.readFileSync(filePath, 'utf8'));
  });

  const unsafeScreens = editableScreens.filter((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    return !/KeyboardAwareScrollView|KeyboardAvoidingView|AuthScreenLayout/.test(source);
  });

  assert.deepEqual(
    unsafeScreens.map((filePath) => path.relative(mobileRoot, filePath)),
    [],
  );
});

test('shared keyboard container supports scrolling and dismissal', () => {
  const component = read('src/components/KeyboardAwareScrollView.js');

  assert.match(component, /KeyboardAvoidingView/);
  assert.match(component, /keyboardDismissMode=/);
  assert.match(component, /keyboardShouldPersistTaps="handled"/);
});

test('Android release config resizes for the keyboard and avoids cloud backup', () => {
  const config = JSON.parse(read('app.json'));

  assert.equal(config.expo.android.softwareKeyboardLayoutMode, 'resize');
  assert.equal(config.expo.android.allowBackup, false);
  assert.equal(config.expo.androidStatusBar.translucent, false);
});
