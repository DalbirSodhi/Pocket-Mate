import { ArrowLeft } from 'lucide-react-native';
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

import { BrandMark } from '../../../components/BrandMark';
import { colors, spacing, typography } from '../../../theme/tokens';

export function AuthScreenLayout({
  title,
  subtitle,
  children,
  onBack,
  footer,
  showBrand = true,
}) {
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
            <View style={styles.topRow}>
              {onBack ? (
                <Pressable
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onBack}
                  style={styles.backButton}
                >
                  <ArrowLeft color={colors.ink} size={22} />
                </Pressable>
              ) : null}
              {showBrand ? <BrandMark compact={Boolean(onBack)} /> : null}
            </View>

            <View style={styles.heading}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.body}>{children}</View>
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flex: 1,
  },
  topRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMuted,
  },
  body: {
    marginTop: spacing.xxl,
  },
  footer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
});
