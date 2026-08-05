import { ShieldAlert, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
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
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { deleteOwnAccount } from '../../auth';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
} from '../../auth/utils/accountDeletion.cjs';

const deletionItems = [
  'Your profile and sign-in access',
  'Income, expenses, categories, and budgets',
  'Savings goals, cards, bills, and payment plans',
];

export function DeleteAccountScreen({ navigation }) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const isConfirmed = isAccountDeletionConfirmed(confirmation);

  async function performDeletion() {
    setIsDeleting(true);
    setError('');

    try {
      await deleteOwnAccount();
    } catch (deletionError) {
      setError(
        deletionError.message ||
          'Unable to delete your account. Your data has not been changed.',
      );
      setIsDeleting(false);
    }
  }

  function handleDelete() {
    if (!isConfirmed) {
      return;
    }

    const message =
      'Your account and all Pocket-Mate finance data will be permanently deleted.';

    if (Platform.OS === 'web') {
      const shouldDelete =
        typeof window !== 'undefined'
          ? window.confirm(`Delete account?\n\n${message}`)
          : false;

      if (shouldDelete) {
        performDeletion();
      }

      return;
    }

    Alert.alert('Delete account?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete permanently',
        style: 'destructive',
        onPress: performDeletion,
      },
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
              onBack={navigation.goBack}
              subtitle="Permanent account and data removal"
              title="Delete account"
            />

            <InlineNotice message={error} variant="error" />

            <View style={styles.warningPanel}>
              <View style={styles.warningIcon}>
                <ShieldAlert color={colors.danger} size={24} />
              </View>
              <View style={styles.warningCopy}>
                <Text style={styles.warningTitle}>This cannot be undone</Text>
                <Text style={styles.warningBody}>
                  Deletion is immediate. Export any reports you want to keep
                  before continuing.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What will be deleted</Text>
              <View style={styles.deletionList}>
                {deletionItems.map((item, index) => (
                  <View key={item}>
                    <View style={styles.deletionRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.deletionText}>{item}</Text>
                    </View>
                    {index < deletionItems.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Confirm deletion</Text>
              <FormField
                autoCapitalize="characters"
                autoCorrect={false}
                error={
                  confirmation.length === ACCOUNT_DELETION_CONFIRMATION.length &&
                  !isConfirmed
                    ? `Type ${ACCOUNT_DELETION_CONFIRMATION} exactly to continue.`
                    : ''
                }
                label={`Type ${ACCOUNT_DELETION_CONFIRMATION}`}
                maxLength={ACCOUNT_DELETION_CONFIRMATION.length}
                onChangeText={(value) => {
                  setConfirmation(value);
                }}
                placeholder={ACCOUNT_DELETION_CONFIRMATION}
                returnKeyType="done"
                value={confirmation}
              />
            </View>

            <AppButton
              disabled={!isConfirmed}
              icon={Trash2}
              isLoading={isDeleting}
              label="Delete account permanently"
              onPress={handleDelete}
              variant="danger"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
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
  warningPanel: {
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  warningTitle: { ...typography.section, color: colors.danger },
  warningBody: { ...typography.body, color: colors.ink },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.section, color: colors.ink },
  deletionList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  deletionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.danger,
  },
  deletionText: { ...typography.body, color: colors.ink, flex: 1 },
  divider: { height: 1, marginLeft: spacing.xl, backgroundColor: colors.border },
});
