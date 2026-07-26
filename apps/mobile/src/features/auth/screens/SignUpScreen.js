import { UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { colors, spacing, typography } from '../../../theme/tokens';
import { signUpWithEmail } from '../services/authService';
import { getAuthErrorMessage } from '../utils/getAuthErrorMessage';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

export function SignUpScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUpWithEmail({ email, password, displayName });

      if (!result.session) {
        setSuccess('Check your inbox to confirm your email, then sign in.');
      }
    } catch (signUpError) {
      setError(getAuthErrorMessage(signUpError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout
      onBack={() => navigation.goBack()}
      subtitle="Create your private finance workspace."
      title="Create account"
    >
      <View style={styles.form}>
        <InlineNotice message={error} variant="error" />
        <InlineNotice message={success} variant="success" />
        <FormField
          autoComplete="name"
          label="Name"
          onChangeText={setDisplayName}
          placeholder="Your name"
          textContentType="name"
          value={displayName}
        />
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
        <FormField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <FormField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Confirm password"
          onChangeText={setConfirmPassword}
          placeholder="Repeat your password"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
        />
        <AppButton
          disabled={!displayName || !email || !password || !confirmPassword || Boolean(success)}
          icon={UserPlus}
          isLoading={isSubmitting}
          label="Create account"
          onPress={handleSignUp}
        />
        {success ? (
          <AppButton
            label="Go to sign in"
            onPress={() => navigation.navigate('SignIn')}
            variant="secondary"
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn')}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchAction}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  switchButton: {
    paddingVertical: spacing.md,
  },
  switchText: {
    ...typography.body,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  switchAction: {
    color: colors.primary,
    fontWeight: '700',
  },
});
