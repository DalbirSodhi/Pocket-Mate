const { isValidDateString } = require('../../../utils/date.cjs');

const GOAL_TYPES = ['lose_fat', 'maintain', 'build_muscle'];
const DIETARY_STYLES = [
  'balanced',
  'high_protein',
  'vegetarian',
  'vegan',
  'pescatarian',
  'mediterranean',
  'low_carb',
];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

function parseWholeNumber(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseWeightToGrams(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^(?:\d+|\d+\.\d{1,2})$/.test(normalized)) {
    return null;
  }

  const grams = Math.round(Number(normalized) * 1000);
  return Number.isSafeInteger(grams) ? grams : null;
}

function validateRange(value, minimum, maximum, message) {
  return value === null || value < minimum || value > maximum ? message : '';
}

function validateNutritionProfile(input) {
  const errors = {};
  const currentWeightGrams = parseWeightToGrams(input.currentWeightKg);
  const targetWeightGrams = parseWeightToGrams(input.targetWeightKg);
  const heightCm = parseWholeNumber(input.heightCm);
  const dailyCalorieTarget = parseWholeNumber(input.dailyCalorieTarget);
  const proteinTargetG = parseWholeNumber(input.proteinTargetG);
  const carbsTargetG = parseWholeNumber(input.carbsTargetG);
  const fatTargetG = parseWholeNumber(input.fatTargetG);

  if (!GOAL_TYPES.includes(input.goalType)) {
    errors.goalType = 'Choose a physique goal.';
  }
  if (!DIETARY_STYLES.includes(input.dietaryStyle)) {
    errors.dietaryStyle = 'Choose a supported eating style.';
  }

  const fields = [
    ['currentWeightKg', currentWeightGrams, 25000, 400000, 'Enter a weight from 25 to 400 kg.'],
    ['targetWeightKg', targetWeightGrams, 25000, 400000, 'Enter a target from 25 to 400 kg.'],
    ['heightCm', heightCm, 100, 250, 'Enter a height from 100 to 250 cm.'],
    ['dailyCalorieTarget', dailyCalorieTarget, 500, 10000, 'Enter a daily target from 500 to 10,000 calories.'],
    ['proteinTargetG', proteinTargetG, 1, 500, 'Enter a protein target from 1 to 500 g.'],
    ['carbsTargetG', carbsTargetG, 0, 1000, 'Enter a carbohydrate target from 0 to 1,000 g.'],
    ['fatTargetG', fatTargetG, 0, 500, 'Enter a fat target from 0 to 500 g.'],
  ];

  for (const [field, value, minimum, maximum, message] of fields) {
    const error = validateRange(value, minimum, maximum, message);
    if (error) errors[field] = error;
  }

  return {
    errors,
    values: {
      goalType: input.goalType,
      dietaryStyle: input.dietaryStyle,
      currentWeightGrams,
      targetWeightGrams,
      heightCm,
      dailyCalorieTarget,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
    },
  };
}

function validateMealEntry(input) {
  const errors = {};
  const calories = parseWholeNumber(input.calories);
  const proteinG = parseWholeNumber(input.proteinG);
  const carbsG = parseWholeNumber(input.carbsG);
  const fatG = parseWholeNumber(input.fatG);

  if (String(input.name || '').trim().length < 2) {
    errors.name = 'Enter a meal name.';
  }
  if (!MEAL_TYPES.includes(input.mealType)) {
    errors.mealType = 'Choose a meal type.';
  }
  if (!isValidDateString(input.eatenOn)) {
    errors.eatenOn = 'Use a valid date in YYYY-MM-DD format.';
  }

  const fields = [
    ['calories', calories, 0, 10000, 'Enter calories from 0 to 10,000.'],
    ['proteinG', proteinG, 0, 1000, 'Enter protein from 0 to 1,000 g.'],
    ['carbsG', carbsG, 0, 2000, 'Enter carbohydrates from 0 to 2,000 g.'],
    ['fatG', fatG, 0, 1000, 'Enter fat from 0 to 1,000 g.'],
  ];

  for (const [field, value, minimum, maximum, message] of fields) {
    const error = validateRange(value, minimum, maximum, message);
    if (error) errors[field] = error;
  }

  return {
    errors,
    values: { calories, proteinG, carbsG, fatG },
  };
}

function safeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function calculateNutritionTotals(entries = []) {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + safeInteger(entry.calories),
      proteinG: totals.proteinG + safeInteger(entry.protein_g ?? entry.proteinG),
      carbsG: totals.carbsG + safeInteger(entry.carbs_g ?? entry.carbsG),
      fatG: totals.fatG + safeInteger(entry.fat_g ?? entry.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function buildNutrientProgress(consumed, target) {
  const safeTarget = safeInteger(target);
  return {
    consumed: safeInteger(consumed),
    target: safeTarget,
    remaining: Math.max(safeTarget - safeInteger(consumed), 0),
    ratio: safeTarget > 0 ? safeInteger(consumed) / safeTarget : 0,
  };
}

function calculateNutritionProgress(profile, entries = []) {
  const totals = calculateNutritionTotals(entries);
  if (!profile) return { totals, calories: null, protein: null, carbs: null, fat: null };

  return {
    totals,
    calories: buildNutrientProgress(totals.calories, profile.daily_calorie_target),
    protein: buildNutrientProgress(totals.proteinG, profile.protein_target_g),
    carbs: buildNutrientProgress(totals.carbsG, profile.carbs_target_g),
    fat: buildNutrientProgress(totals.fatG, profile.fat_target_g),
  };
}

module.exports = {
  DIETARY_STYLES,
  GOAL_TYPES,
  MEAL_TYPES,
  calculateNutritionProgress,
  calculateNutritionTotals,
  parseWeightToGrams,
  validateMealEntry,
  validateNutritionProfile,
};
