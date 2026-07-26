import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { spacing } from '../../../theme/tokens';
import { requestPasswordReset } from '../services/authService';
import { getAuthErrorMessage } from '../utils/getAuthErrorMessage';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

export function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleResetRequest() {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSuccess('Check your inbox for a secure password reset link.');
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout
      onBack={() => navigation.goBack()}
      subtitle="We will email you a secure recovery link."
      title="Reset password"
    >
      <View style={styles.form}>
        <InlineNotice message={error} variant="error" />
        <InlineNotice message={success} variant="success" />
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
        />
        <AppButton
          disabled={!email || Boolean(success)}
          icon={MailCheck}
          isLoading={isSubmitting}
          label="Send reset link"
          onPress={handleResetRequest}
        />
        {success ? (
          <AppButton
            label="Back to sign in"
            onPress={() => navigation.navigate('SignIn')}
            variant="secondary"
          />
        ) : null}
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
});
