import { LogIn, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { colors, spacing, typography } from '../../../theme/tokens';
import {
  resendSignUpConfirmation,
  signInWithEmail,
} from '../services/authService';
import { isEmailNotConfirmedError } from '../utils/authErrorMatchers.cjs';
import { getAuthErrorMessage } from '../utils/getAuthErrorMessage';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

const RESEND_COOLDOWN_SECONDS = 60;

export function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleSignIn() {
    setError('');
    setSuccess('');
    setCanResendConfirmation(false);
    setIsSubmitting(true);

    try {
      await signInWithEmail({ email, password });
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError));
      setCanResendConfirmation(isEmailNotConfirmedError(signInError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEmailChange(value) {
    setEmail(value);
    setError('');
    setSuccess('');
    setCanResendConfirmation(false);
    setResendCooldown(0);
  }

  async function handleResendConfirmation() {
    if (!email || resendCooldown > 0) {
      return;
    }

    setError('');
    setSuccess('');
    setIsResending(true);

    try {
      await resendSignUpConfirmation(email);
      setSuccess('Confirmation email sent. Check your inbox and spam folder.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (resendError) {
      setError(getAuthErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthScreenLayout
      onBack={() => navigation.goBack()}
      subtitle="Welcome back. Your latest numbers are waiting."
      title="Sign in"
    >
      <View style={styles.form}>
        <InlineNotice message={error} variant="error" />
        <InlineNotice message={success} variant="success" />
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={handleEmailChange}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
        />
        <View>
          <FormField
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
            placeholder="Enter your password"
            returnKeyType="go"
            secureTextEntry
            spellCheck={false}
            textContentType="password"
            value={password}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotLabel}>Forgot password?</Text>
          </Pressable>
        </View>
        <AppButton
          disabled={!email || !password}
          icon={LogIn}
          isLoading={isSubmitting}
          label="Sign in"
          onPress={handleSignIn}
        />
        {canResendConfirmation ? (
          <AppButton
            disabled={resendCooldown > 0}
            icon={Mail}
            isLoading={isResending}
            label={
              resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : 'Resend confirmation email'
            }
            onPress={handleResendConfirmation}
            variant="secondary"
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignUp')}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            New to Pocket-Mate? <Text style={styles.switchAction}>Create account</Text>
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
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
  },
  forgotLabel: {
    ...typography.label,
    color: colors.primary,
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
