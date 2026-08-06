const SUPPORTED_FIELDS = new Set(['merchant', 'note']);

const OPERATOR_SPECIFICITY = Object.freeze({
  exact: 0,
  starts_with: 1,
  contains: 2,
});

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function getRuleValue(rule, camelCaseKey, snakeCaseKey) {
  return rule?.[camelCaseKey] ?? rule?.[snakeCaseKey];
}

function isActiveRule(rule) {
  return rule?.isActive !== false && rule?.is_active !== false;
}

function matchesRule(transaction, rule) {
  if (!transaction || !rule || !isActiveRule(rule)) {
    return false;
  }

  const field = getRuleValue(rule, 'matchField', 'match_field');
  const operator = rule.operator;

  if (!SUPPORTED_FIELDS.has(field) || !(operator in OPERATOR_SPECIFICITY)) {
    return false;
  }

  const candidate = normalizeText(transaction[field]);
  const expected = normalizeText(
    getRuleValue(rule, 'matchValue', 'match_value'),
  );

  if (!candidate || !expected) {
    return false;
  }

  if (operator === 'exact') {
    return candidate === expected;
  }

  if (operator === 'starts_with') {
    return candidate.startsWith(expected);
  }

  return candidate.includes(expected);
}

function compareRules(left, right) {
  const leftPriority = Number.isFinite(Number(left.priority))
    ? Number(left.priority)
    : Number.POSITIVE_INFINITY;
  const rightPriority = Number.isFinite(Number(right.priority))
    ? Number(right.priority)
    : Number.POSITIVE_INFINITY;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const operatorDifference =
    OPERATOR_SPECIFICITY[left.operator] - OPERATOR_SPECIFICITY[right.operator];

  if (operatorDifference !== 0) {
    return operatorDifference;
  }

  const leftCreatedAt = String(
    getRuleValue(left, 'createdAt', 'created_at') ?? '\uffff',
  );
  const rightCreatedAt = String(
    getRuleValue(right, 'createdAt', 'created_at') ?? '\uffff',
  );
  const createdAtDifference = leftCreatedAt.localeCompare(rightCreatedAt);

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return String(left.id ?? '\uffff').localeCompare(String(right.id ?? '\uffff'));
}

function findBestRule(transaction, rules = []) {
  const matchingRules = rules.filter((rule) => matchesRule(transaction, rule));

  if (matchingRules.length === 0) {
    return null;
  }

  return [...matchingRules].sort(compareRules)[0];
}

function applyRules(transaction, rules = []) {
  const result = { ...transaction };
  const rule = findBestRule(transaction, rules);

  if (!rule) {
    return result;
  }

  const categoryId = getRuleValue(rule, 'categoryId', 'category_id');
  const reviewAction = getRuleValue(rule, 'reviewAction', 'review_action');

  if (categoryId !== undefined) {
    result.categoryId = categoryId;
  }

  if (reviewAction !== undefined) {
    result.reviewAction = reviewAction;
  }

  return result;
}

module.exports = {
  applyRules,
  findBestRule,
  matchesRule,
  normalizeText,
};
