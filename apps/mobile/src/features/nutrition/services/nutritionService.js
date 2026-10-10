import { supabase } from '../../../infrastructure/supabase/client';

const PROFILE_FIELDS = [
  'user_id',
  'goal_type',
  'dietary_style',
  'current_weight_grams',
  'target_weight_grams',
  'height_cm',
  'daily_calorie_target',
  'protein_target_g',
  'carbs_target_g',
  'fat_target_g',
  'updated_at',
].join(', ');

const MEAL_FIELDS = [
  'id',
  'eaten_on',
  'meal_type',
  'name',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'note',
  'created_at',
].join(', ');

function unwrap(response, fallback = null) {
  if (response.error) throw response.error;
  return response.data ?? fallback;
}

export async function getNutritionProfile(userId) {
  const response = await supabase
    .from('nutrition_profiles')
    .select(PROFILE_FIELDS)
    .eq('user_id', userId)
    .maybeSingle();

  return unwrap(response);
}

export async function saveNutritionProfile({ userId, ...profile }) {
  const response = await supabase
    .from('nutrition_profiles')
    .upsert(
      {
        user_id: userId,
        goal_type: profile.goalType,
        dietary_style: profile.dietaryStyle,
        current_weight_grams: profile.currentWeightGrams,
        target_weight_grams: profile.targetWeightGrams,
        height_cm: profile.heightCm,
        daily_calorie_target: profile.dailyCalorieTarget,
        protein_target_g: profile.proteinTargetG,
        carbs_target_g: profile.carbsTargetG,
        fat_target_g: profile.fatTargetG,
      },
      { onConflict: 'user_id' },
    )
    .select(PROFILE_FIELDS)
    .single();

  return unwrap(response);
}

export async function getMealEntries({ userId, eatenOn }) {
  const response = await supabase
    .from('meal_entries')
    .select(MEAL_FIELDS)
    .eq('user_id', userId)
    .eq('eaten_on', eatenOn)
    .order('created_at', { ascending: true });

  return unwrap(response, []);
}

export async function getMealEntry({ userId, mealId }) {
  const response = await supabase
    .from('meal_entries')
    .select(MEAL_FIELDS)
    .eq('user_id', userId)
    .eq('id', mealId)
    .single();

  return unwrap(response);
}

export async function saveMealEntry({ userId, mealId, ...meal }) {
  const payload = {
    user_id: userId,
    eaten_on: meal.eatenOn,
    meal_type: meal.mealType,
    name: meal.name.trim(),
    calories: meal.calories,
    protein_g: meal.proteinG,
    carbs_g: meal.carbsG,
    fat_g: meal.fatG,
    note: meal.note.trim() || null,
  };

  let query = mealId
    ? supabase
        .from('meal_entries')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', mealId)
    : supabase.from('meal_entries').insert(payload);

  const response = await query.select(MEAL_FIELDS).single();
  return unwrap(response);
}

export async function deleteMealEntry({ userId, mealId }) {
  const response = await supabase
    .from('meal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', mealId);

  if (response.error) throw response.error;
}
