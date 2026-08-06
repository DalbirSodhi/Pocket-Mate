import { supabase } from '../../../infrastructure/supabase/client';
import { getReminderEvents } from '../../planning/services/calendarService';
import { syncPocketMateReminders } from './notificationService';
import { getUserPreferences } from './preferencesService';

export async function syncUserReminderSchedule(userId) {
  try {
    const preferences = await getUserPreferences(userId);
    if (!preferences.reminders_enabled) {
      return syncPocketMateReminders({ events: [], preferences });
    }

    const profileResponse = await supabase
      .from('profiles')
      .select('currency_code, pay_cycle, pay_cycle_anchor_date')
      .eq('id', userId)
      .single();
    if (profileResponse.error) throw profileResponse.error;
    const events = await getReminderEvents({
      userId,
      profile: profileResponse.data,
    });
    return syncPocketMateReminders({ events, preferences });
  } catch (error) {
    return {
      supported: true,
      scheduledCount: 0,
      error: error.message || 'Unable to refresh local reminders.',
    };
  }
}
