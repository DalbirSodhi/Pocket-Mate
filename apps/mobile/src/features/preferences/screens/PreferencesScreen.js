import { Bell, BellRing, EyeOff, LayoutList, ShieldCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { getReminderEvents } from '../../planning/services/calendarService';
import { getUserPreferences, saveUserPreferences } from '../services/preferencesService';
import {
  requestReminderPermission,
  syncPocketMateReminders,
} from '../services/notificationService';

const LEAD_OPTIONS = [0, 1, 3, 7, 14];

function PreferenceToggle({ icon: Icon, title, detail, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.icon}><Icon color={colors.ink} size={20} /></View>
      <View style={styles.toggleCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowBody}>{detail}</Text></View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
    </View>
  );
}

export function PreferencesScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const profile = route.params?.profile || {};
  const [preferences, setPreferences] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setPreferences(await getUserPreferences(user.id)); }
    catch (requestError) { setError(requestError.message || 'Unable to load preferences.'); }
  }, [user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function update(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function toggleLeadDay(day) {
    const selected = preferences.lead_days.includes(day);
    const next = selected
      ? preferences.lead_days.filter((value) => value !== day)
      : [...preferences.lead_days, day].sort((left, right) => left - right);
    if (next.length) update('lead_days', next);
  }

  async function save() {
    setIsSaving(true); setError(''); setSuccess('');
    try {
      if (preferences.reminders_enabled) {
        const permission = await requestReminderPermission();
        if (
          !permission.granted &&
          permission.reason !== 'local-notifications-unavailable-on-web'
        ) {
          throw new Error(
            permission.error ||
              'Notification permission is required for local reminders.',
          );
        }
      }
      const saved = await saveUserPreferences({ userId: user.id, preferences });
      const events = saved.reminders_enabled
        ? await getReminderEvents({ userId: user.id, profile })
        : [];
      const syncResult = await syncPocketMateReminders({ events, preferences: saved });
      setPreferences(saved);
      setSuccess(syncResult.supported === false
        ? 'Preferences saved. Local reminders are available on iOS and Android.'
        : `Preferences saved. ${syncResult.scheduledCount || 0} local reminders scheduled.`);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save preferences.');
    } finally { setIsSaving(false); }
  }

  if (!preferences) return <LoadingScreen message="Loading preferences..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader onBack={navigation.goBack} subtitle="Private display and on-device reminders" title="Preferences" />
          <InlineNotice message={error} variant="error" />
          <InlineNotice message={success} variant="success" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <PreferenceToggle icon={BellRing} title="Local reminders" detail="Scheduled on this device; no push token is collected" value={preferences.reminders_enabled} onValueChange={(value) => update('reminders_enabled', value)} />
            <PreferenceToggle icon={Bell} title="Card bills" detail="Remind before statement due dates" value={preferences.remind_card_bills} onValueChange={(value) => update('remind_card_bills', value)} />
            <PreferenceToggle icon={Bell} title="Monthly fixed" detail="Remind before recurring charge dates" value={preferences.remind_recurring_bills} onValueChange={(value) => update('remind_recurring_bills', value)} />
            <PreferenceToggle icon={Bell} title="Paydays" detail="Show expected payday reminders" value={preferences.remind_paydays} onValueChange={(value) => update('remind_paydays', value)} />
            <Text style={styles.fieldLabel}>Remind me before</Text>
            <View style={styles.choices}>{LEAD_OPTIONS.map((day) => { const selected = preferences.lead_days.includes(day); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={day} onPress={() => toggleLeadDay(day)} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{day === 0 ? 'Due day' : `${day}d`}</Text></Pressable>; })}</View>
            <Text style={styles.fieldLabel}>Reminder time</Text>
            <View style={styles.choices}>{[8, 9, 12, 18].map((hour) => { const selected = preferences.reminder_hour === hour; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={hour} onPress={() => update('reminder_hour', hour)} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</Text></Pressable>; })}</View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display</Text>
            <PreferenceToggle icon={EyeOff} title="Hide amounts" detail="Mask money values on the Home dashboard" value={preferences.hide_amounts} onValueChange={(value) => update('hide_amounts', value)} />
            <PreferenceToggle icon={ShieldCheck} title="Higher contrast" detail="Use stronger secondary text on Home" value={preferences.high_contrast} onValueChange={(value) => update('high_contrast', value)} />
            <Text style={styles.fieldLabel}>Dashboard density</Text>
            <View style={styles.choices}>{['comfortable', 'compact'].map((density) => { const selected = preferences.dashboard_density === density; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={density} onPress={() => update('dashboard_density', density)} style={[styles.choice, selected && styles.choiceSelected]}><LayoutList color={selected ? colors.primary : colors.inkMuted} size={17} /><Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{density === 'compact' ? 'Compact' : 'Comfortable'}</Text></Pressable>; })}</View>
          </View>

          <AppButton isLoading={isSaving} label="Save preferences" onPress={save} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: spacing.xl },
  section: { gap: spacing.md }, sectionTitle: { ...typography.section, color: colors.ink },
  toggleRow: { minHeight: 72, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.iconSurface, alignItems: 'center', justifyContent: 'center' },
  toggleCopy: { flex: 1, minWidth: 0 }, rowTitle: { ...typography.label, color: colors.ink }, rowBody: { ...typography.caption, color: colors.inkMuted },
  fieldLabel: { ...typography.label, color: colors.ink }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceLabel: { ...typography.caption, color: colors.inkMuted }, choiceLabelSelected: { color: colors.primary, fontWeight: '700' },
});
