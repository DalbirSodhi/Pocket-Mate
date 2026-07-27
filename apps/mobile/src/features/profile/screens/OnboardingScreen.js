import { WalletCards } from 'lucide-react-native';
import { useMemo, useState } from 'react';
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
import { BrandMark } from '../../../components/BrandMark';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { colors, spacing, typography } from '../../../theme/tokens';
import { getLocalDateString } from '../../../utils/date.cjs';
import { ProfileChoiceGroup } from '../components/ProfileChoiceGroup';
import { currencyOptions, payCycleOptions } from '../profileOptions';
import { saveProfile } from '../services/profileService';

export function OnboardingScreen({
  user,
  onComplete,
  title = 'Set up your money plan',
  customContent,
}) {
  const initialName = useMemo(
    () => user?.user_metadata?.display_name || '',
    [user?.user_metadata?.display_name],
  );
  const [displayName, setDisplayName] = useState(initialName);
  const [currencyCode, setCurrencyCode] = useState('CAD');
  const [payCycle, setPayCycle] = useState('monthly');
  const [payCycleAnchorDate, setPayCycleAnchorDate] = useState(
    getLocalDateString(),
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    setError('');
    setIsSubmitting(true);

    try {
      const profile = await saveProfile({
        userId: user.id,
        displayName,
        currencyCode,
        payCycle,
        payCycleAnchorDate,
      });
      onComplete(profile);
    } catch (profileError) {
      setError(profileError.message || 'Unable to save your profile.');
    } finally {
      setIsSubmitting(false);
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
            <BrandMark compact />
            <View style={styles.heading}>
              <Text style={styles.kicker}>First-time setup</Text>
              <Text style={styles.title}>{title}</Text>
              {!customContent ? (
                <Text style={styles.subtitle}>
                  Choose the defaults Pocket-Mate will use for your dashboard.
                </Text>
              ) : null}
            </View>

            {customContent ? (
              <View style={styles.form}>{customContent}</View>
            ) : (
              <View style={styles.form}>
                <InlineNotice message={error} variant="error" />
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
                <AppButton
                  disabled={!displayName}
                  icon={WalletCards}
                  isLoading={isSubmitting}
                  label="Open my dashboard"
                  onPress={handleSave}
                />
              </View>
            )}
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
    flexGrow: 1,
    padding: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  heading: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  kicker: {
    ...typography.label,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMuted,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.xl,
  },
});
