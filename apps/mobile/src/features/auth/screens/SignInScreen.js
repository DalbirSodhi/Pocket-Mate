import { LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { colors, spacing, typography } from '../../../theme/tokens';
import { signInWithEmail } from '../services/authService';
import { getAuthErrorMessage } from '../utils/getAuthErrorMessage';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

export function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    setError('');
    setIsSubmitting(true);

    try {
      await signInWithEmail({ email, password });
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
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
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
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
