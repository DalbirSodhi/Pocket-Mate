import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

const variants = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    textColor: colors.white,
    pressedColor: colors.primaryPressed,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    textColor: colors.ink,
    pressedColor: colors.surfaceMuted,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    textColor: colors.danger,
    pressedColor: colors.dangerPressed,
  },
};

export function AppButton({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  style,
}) {
  const palette = variants[variant] || variants.primary;
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? palette.pressedColor : palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={palette.textColor} size="small" />
      ) : (
        <>
          {Icon ? <Icon color={palette.textColor} size={18} strokeWidth={2.2} /> : null}
          <Text style={[styles.label, { color: palette.textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.55,
  },
});
