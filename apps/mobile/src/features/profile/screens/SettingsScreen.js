import { Save } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, spacing, typography } from '../../../theme/tokens';
import { getLocalDateString } from '../../../utils/date.cjs';
import { ProfileChoiceGroup } from '../components/ProfileChoiceGroup';
import { currencyOptions, payCycleOptions } from '../profileOptions';
import { saveProfile } from '../services/profileService';

export function SettingsScreen({
  navigation,
  profile,
  onProfileChange,
}) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [currencyCode, setCurrencyCode] = useState(
    profile.currency_code || 'CAD',
  );
  const [payCycle, setPayCycle] = useState(profile.pay_cycle || 'monthly');
  const [payCycleAnchorDate, setPayCycleAnchorDate] = useState(
    profile.pay_cycle_anchor_date || getLocalDateString(),
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setError('');
    setIsSaving(true);

    try {
      const nextProfile = await saveProfile({
        userId: profile.id,
        displayName,
        currencyCode,
        payCycle,
        payCycleAnchorDate,
      });
      onProfileChange(nextProfile);
      navigation.goBack();
    } catch (profileError) {
      setError(profileError.message || 'Unable to save your settings.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <ScreenHeader
              onBack={navigation.goBack}
              subtitle="Controls your dashboard calculations"
              title="Settings"
            />

            <InlineNotice message={error} variant="error" />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <FormField
                autoComplete="name"
                label="Name"
                onChangeText={setDisplayName}
                placeholder="Your name"
                textContentType="name"
                value={displayName}
              />
              <ProfileChoiceGroup
                label="Currency"
                onSelect={setCurrencyCode}
                options={currencyOptions}
                selectedValue={currencyCode}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pay schedule</Text>
              <Text style={styles.sectionBody}>
                Pocket-Mate uses a known payday to calculate your active cycle,
                next payday, and daily spending capacity.
              </Text>
              <ProfileChoiceGroup
                label="Pay cycle"
                onSelect={setPayCycle}
                options={payCycleOptions}
                selectedValue={payCycle}
              />
              <FormField
                autoCapitalize="none"
                label="Most recent payday"
                maxLength={10}
                onChangeText={setPayCycleAnchorDate}
                placeholder="YYYY-MM-DD"
                value={payCycleAnchorDate}
              />
            </View>

            <AppButton
              disabled={!displayName || !payCycleAnchorDate}
              icon={Save}
              isLoading={isSaving}
              label="Save settings"
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  section: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  sectionBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
