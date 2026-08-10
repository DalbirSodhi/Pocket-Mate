const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readComponent(name) {
  const componentDirectory = path.dirname(require.resolve('./AppButton.js'));
  return fs.readFileSync(path.join(componentDirectory, name), 'utf8');
}

test('shared controls keep programmatic labels and disabled state', () => {
  const button = readComponent('AppButton.js');
  const field = readComponent('FormField.js');
  const nativeDate = readComponent('DateField.native.js');
  const webDate = readComponent('DateField.web.js');

  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(field, /accessibilityLabel=\{label\}/);
  assert.match(field, /accessibilityState=\{\{ disabled: !editable \}\}/);
  assert.match(nativeDate, /accessibilityLabel=\{`\$\{label\}, \$\{value\}`\}/);
  assert.match(webDate, /'aria-label': label/);
});

test('shared feedback components preserve live announcement semantics', () => {
  const field = readComponent('FormField.js');
  const nativeDate = readComponent('DateField.native.js');
  const webDate = readComponent('DateField.web.js');
  const notice = readComponent('InlineNotice.js');
  const loading = readComponent('LoadingScreen.js');
  const header = readComponent('ScreenHeader.js');

  assert.match(field, /accessibilityLiveRegion="polite"/);
  assert.match(nativeDate, /accessibilityLiveRegion="polite"/);
  assert.match(webDate, /accessibilityLiveRegion="polite"/);
  assert.match(notice, /accessibilityLiveRegion=\{variant === 'error' \? 'assertive' : 'polite'\}/);
  assert.match(notice, /accessibilityRole=\{variant === 'error' \? 'alert' : undefined\}/);
  assert.match(loading, /accessibilityRole="progressbar"/);
  assert.match(header, /accessibilityRole="header"/);
});
