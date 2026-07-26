import { KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { spacing } from '../../../theme/tokens';
import { useAuthSession } from '../hooks/useAuthSession';
import { updatePassword } from '../services/authService';
import { getAuthErrorMessage } from '../utils/getAuthErrorMessage';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

export function ResetPasswordScreen() {
  const { finishPasswordRecovery } = useAuthSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUpdatePassword() {
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      finishPasswordRecovery();
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout
      showBrand
      subtitle="Choose a new password for your Pocket-Mate account."
      title="Create new password"
    >
      <View style={styles.form}>
        <InlineNotice message={error} variant="error" />
        <FormField
          autoCapitalize="none"
          autoComplete="new-password"
          label="New password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <FormField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Confirm new password"
          onChangeText={setConfirmPassword}
          placeholder="Repeat your password"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
        />
        <AppButton
          disabled={!password || !confirmPassword}
          icon={KeyRound}
          isLoading={isSubmitting}
          label="Update password"
          onPress={handleUpdatePassword}
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
});
