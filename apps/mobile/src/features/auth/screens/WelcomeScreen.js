import { ArrowRight, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { AuthScreenLayout } from '../components/AuthScreenLayout';

export function WelcomeScreen({ navigation }) {
  return (
    <AuthScreenLayout
      title="Money clarity, every day."
      subtitle="Start with what came in, what went out, and what is safe to spend."
    >
      <View style={styles.signal}>
        <View style={styles.signalIcon}>
          <ShieldCheck color={colors.primary} size={24} />
        </View>
        <View style={styles.signalCopy}>
          <Text style={styles.signalTitle}>Private by default</Text>
          <Text style={styles.signalBody}>Your finance records stay tied to your account.</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          icon={ArrowRight}
          label="Create account"
          onPress={() => navigation.navigate('SignUp')}
        />
        <AppButton
          label="Sign in"
          onPress={() => navigation.navigate('SignIn')}
          variant="secondary"
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  signal: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  signalIcon: {
    width: 44,
    height: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  signalCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  signalTitle: {
    ...typography.label,
    color: colors.ink,
  },
  signalBody: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  actions: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },
});
