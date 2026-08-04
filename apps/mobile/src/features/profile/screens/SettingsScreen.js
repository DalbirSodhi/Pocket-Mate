import {
  ChevronRight,
  FileSpreadsheet,
  LogOut,
  Save,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
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
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { signOut } from '../../auth';
import { ProfileChoiceGroup } from '../components/ProfileChoiceGroup';
import { currencyOptions } from '../profileOptions';
import { saveProfile } from '../services/profileService';

export function SettingsScreen({
  navigation,
  profile,
  onProfileChange,
  isTabRoot = false,
}) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [currencyCode, setCurrencyCode] = useState(
    profile.currency_code || 'CAD',
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSave() {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const nextProfile = await saveProfile({
        userId: profile.id,
        displayName,
        currencyCode,
      });
      onProfileChange(nextProfile);
      if (!isTabRoot) {
        navigation.goBack();
      } else {
        setSuccess('Settings saved.');
      }
    } catch (profileError) {
      setError(profileError.message || 'Unable to save your settings.');
    } finally {
      setIsSaving(false);
    }
  }

  async function performSignOut() {
    setError('');
    setSuccess('');
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (signOutError) {
      setError(signOutError.message || 'Unable to sign out. Try again.');
      setIsSigningOut(false);
    }
  }

  function handleSignOut() {
    if (Platform.OS === 'web') {
      const shouldSignOut =
        typeof window !== 'undefined'
          ? window.confirm('Sign out of Pocket-Mate?')
          : true;

      if (shouldSignOut) {
        performSignOut();
      }

      return;
    }

    Alert.alert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: performSignOut },
    ]);
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
              onBack={isTabRoot ? undefined : navigation.goBack}
              subtitle="Profile and account preferences"
              title="Settings"
            />

            <InlineNotice message={error} variant="error" />
            <InlineNotice message={success} variant="success" />

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
              <Text style={styles.sectionTitle}>Monthly tracking</Text>
              <Text style={styles.sectionBody}>
                Income, spending, bills, and goals are calculated from the first
                day through the last day of each month.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your data</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate('MonthlyReport', { currencyCode })
                }
                style={({ pressed }) => [
                  styles.dataRow,
                  pressed && styles.dataRowPressed,
                ]}
              >
                <View style={styles.dataIcon}>
                  <FileSpreadsheet color={colors.ink} size={20} />
                </View>
                <View style={styles.dataCopy}>
                  <Text style={styles.dataTitle}>Monthly reports</Text>
                  <Text style={styles.dataBody}>Review and export CSV files</Text>
                </View>
                <ChevronRight color={colors.inkMuted} size={18} />
              </Pressable>
            </View>

            <AppButton
              disabled={!displayName}
              icon={Save}
              isLoading={isSaving}
              label="Save settings"
              onPress={handleSave}
            />

            <AppButton
              icon={LogOut}
              isLoading={isSigningOut}
              label="Sign out"
              onPress={handleSignOut}
              variant="danger"
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
  dataRow: {
    minHeight: 72,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dataRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  dataIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.iconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataCopy: {
    flex: 1,
    minWidth: 0,
  },
  dataTitle: {
    ...typography.label,
    color: colors.ink,
  },
  dataBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
