import { Check, WalletCards } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { saveProfile } from '../services/profileService';

const currencyOptions = ['CAD', 'USD', 'GBP', 'EUR', 'AUD'];
const payCycleOptions = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Every 2 weeks', value: 'bi_weekly' },
  { label: 'Twice a month', value: 'semi_monthly' },
  { label: 'Monthly', value: 'monthly' },
];

function ChoiceGroup({ label, options, selectedValue, onSelect }) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          const isSelected = selectedValue === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.choice,
                isSelected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}
            >
              <Text style={[styles.choiceLabel, isSelected && styles.choiceLabelSelected]}>
                {optionLabel}
              </Text>
              {isSelected ? <Check color={colors.primary} size={18} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
                <ChoiceGroup
                  label="Currency"
                  onSelect={setCurrencyCode}
                  options={currencyOptions}
                  selectedValue={currencyCode}
                />
                <ChoiceGroup
                  label="Pay cycle"
                  onSelect={setPayCycle}
                  options={payCycleOptions}
                  selectedValue={payCycle}
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
  label: {
    ...typography.label,
    color: colors.ink,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  choices: {
    gap: spacing.sm,
  },
  choice: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choicePressed: {
    opacity: 0.8,
  },
  choiceLabel: {
    ...typography.body,
    color: colors.ink,
  },
  choiceLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
