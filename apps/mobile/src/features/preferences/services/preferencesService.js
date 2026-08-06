import { supabase } from '../../../infrastructure/supabase/client';

export const DEFAULT_PREFERENCES = Object.freeze({
  reminders_enabled: false,
  remind_card_bills: true,
  remind_recurring_bills: true,
  remind_paydays: false,
  reminder_hour: 9,
  lead_days: [1, 3],
  dashboard_density: 'comfortable',
  hide_amounts: false,
  high_contrast: false,
});

export async function getUserPreferences(userId) {
  const response = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (response.error) throw response.error;
  return { ...DEFAULT_PREFERENCES, ...(response.data || {}) };
}

export async function saveUserPreferences({ userId, preferences }) {
  const values = Object.fromEntries(
    Object.keys(DEFAULT_PREFERENCES).map((key) => [
      key,
      preferences[key] ?? DEFAULT_PREFERENCES[key],
    ]),
  );
  const response = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...values })
    .select('*')
    .single();
  if (response.error) throw response.error;
  return response.data;
}
