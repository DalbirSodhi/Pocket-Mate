import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

export function DateField({
  disabled = false,
  error,
  label,
  maximumDate,
  minimumDate,
  onChange,
  value,
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        'aria-invalid': Boolean(error),
        disabled,
        max: maximumDate,
        min: minimumDate,
        onChange: (event) => onChange(event.target.value),
        style: {
          minHeight: 52,
          width: '100%',
          borderRadius: radius.md,
          border: `1px solid ${error ? colors.danger : colors.border}`,
          backgroundColor: colors.surfaceMuted,
          color: colors.ink,
          fontSize: typography.body.fontSize,
          lineHeight: `${typography.body.lineHeight}px`,
          fontWeight: typography.body.fontWeight,
          padding: `0 ${spacing.lg}px`,
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          opacity: disabled ? 0.64 : 1,
        },
        type: 'date',
        value,
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
