import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

const variants = {
  error: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    icon: AlertCircle,
  },
  success: {
    backgroundColor: colors.successSoft,
    color: colors.success,
    icon: CheckCircle2,
  },
  info: {
    backgroundColor: colors.infoSoft,
    color: colors.info,
    icon: Info,
  },
};

export function InlineNotice({ message, variant = 'info' }) {
  if (!message) {
    return null;
  }

  const palette = variants[variant] || variants.info;
  const Icon = palette.icon;

  return (
    <View
      accessibilityLabel={message}
      accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessible
      style={[styles.container, { backgroundColor: palette.backgroundColor }]}
    >
      <Icon color={palette.color} size={19} />
      <Text style={[styles.message, { color: palette.color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  message: {
    ...typography.caption,
    flex: 1,
  },
});
