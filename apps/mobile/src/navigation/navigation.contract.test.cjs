const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const navigationRoot = path.dirname(require.resolve('./AppNavigator.js'));
const sourceRoot = path.resolve(navigationRoot, '..');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

test('literal navigation targets are registered routes', () => {
  const navigator = fs.readFileSync(path.join(navigationRoot, 'AppNavigator.js'), 'utf8');
  const routes = new Set(
    [...navigator.matchAll(/(?:Stack|Tab)\.Screen[^>]*name="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );
  const missing = new Set();

  for (const filePath of walk(path.join(sourceRoot, 'features')).filter((entry) => entry.endsWith('.js'))) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/navigation\.(?:navigate|push|replace)\(\s*['"]([^'"]+)['"]/g)) {
      if (!routes.has(match[1])) missing.add(match[1]);
    }
  }

  assert.deepEqual([...missing], []);
});

test('dynamic expense choices point to registered routes', () => {
  const navigator = fs.readFileSync(path.join(navigationRoot, 'AppNavigator.js'), 'utf8');
  const addExpense = fs.readFileSync(
    path.join(sourceRoot, 'features/finance/screens/AddExpenseScreen.js'),
    'utf8',
  );
  const routes = new Set(
    [...navigator.matchAll(/Stack\.Screen[^>]*name="([^"]+)"/g)].map((match) => match[1]),
  );
  const choiceBlock = addExpense.match(/const EXPENSE_TYPES = \[([\s\S]*?)\];/)?.[1] || '';
  const choices = [...choiceBlock.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);

  assert.ok(choices.length > 0);
  assert.deepEqual(choices.filter((choice) => !routes.has(choice)), []);
});
