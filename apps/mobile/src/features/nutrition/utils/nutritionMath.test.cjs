const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNutritionProgress,
  calculateNutritionTotals,
  parseWeightToGrams,
  validateMealEntry,
  validateNutritionProfile,
} = require('./nutritionMath.cjs');

test('weight parser preserves two decimal kilograms as grams', () => {
  assert.equal(parseWeightToGrams('82.45'), 82450);
  assert.equal(parseWeightToGrams('82.456'), null);
  assert.equal(parseWeightToGrams('-10'), null);
});

test('nutrition profile validation returns normalized database values', () => {
  const result = validateNutritionProfile({
    goalType: 'build_muscle',
    dietaryStyle: 'high_protein',
    currentWeightKg: '80.5',
    targetWeightKg: '85',
    heightCm: '180',
    dailyCalorieTarget: '2800',
    proteinTargetG: '180',
    carbsTargetG: '320',
    fatTargetG: '80',
  });

  assert.deepEqual(result.errors, {});
  assert.equal(result.values.currentWeightGrams, 80500);
  assert.equal(result.values.dailyCalorieTarget, 2800);
});

test('nutrition profile validation rejects unsupported and unsafe targets', () => {
  const result = validateNutritionProfile({
    goalType: 'bulk_fast',
    dietaryStyle: 'unknown',
    currentWeightKg: '5',
    targetWeightKg: '',
    heightCm: '40',
    dailyCalorieTarget: '100',
    proteinTargetG: '0',
    carbsTargetG: '-2',
    fatTargetG: '900',
  });

  assert.deepEqual(Object.keys(result.errors).sort(), [
    'carbsTargetG',
    'currentWeightKg',
    'dailyCalorieTarget',
    'dietaryStyle',
    'fatTargetG',
    'goalType',
    'heightCm',
    'proteinTargetG',
    'targetWeightKg',
  ]);
});

test('meal validation accepts zero macros and a valid date', () => {
  const result = validateMealEntry({
    name: 'Black coffee',
    mealType: 'breakfast',
    eatenOn: '2026-09-04',
    calories: '5',
    proteinG: '0',
    carbsG: '0',
    fatG: '0',
  });

  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.values, { calories: 5, proteinG: 0, carbsG: 0, fatG: 0 });
});

test('daily totals and progress preserve over-target consumption', () => {
  const entries = [
    { calories: 700, protein_g: 50, carbs_g: 80, fat_g: 20 },
    { calories: 900, protein_g: 80, carbs_g: 90, fat_g: 35 },
  ];
  const totals = calculateNutritionTotals(entries);
  const progress = calculateNutritionProgress(
    {
      daily_calorie_target: 1500,
      protein_target_g: 120,
      carbs_target_g: 200,
      fat_target_g: 60,
    },
    entries,
  );

  assert.deepEqual(totals, { calories: 1600, proteinG: 130, carbsG: 170, fatG: 55 });
  assert.equal(progress.calories.remaining, 0);
  assert.equal(progress.calories.ratio, 1600 / 1500);
  assert.equal(progress.protein.consumed, 130);
});
