import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';
import { parseLocalDateString } from '../utils/date.cjs';

export function DateField({
  disabled = false,
  error,
  label,
  maximumDate,
  minimumDate,
  onChange,
  value,
}) {
  const selectedDate = parseLocalDateString(value) || new Date();
  const minimum = parseLocalDateString(minimumDate);
  const maximum = parseLocalDateString(maximumDate);

  function handleChange(event, nextDate) {
    if (event.type === 'dismissed' || !nextDate) {
      return;
    }

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
  }

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      maximumDate: maximum || undefined,
      minimumDate: minimum || undefined,
      mode: 'date',
      onChange: handleChange,
      value: selectedDate,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View
          style={[
            styles.inputShell,
            error && styles.inputShellError,
            disabled && styles.inputShellDisabled,
          ]}
        >
          <CalendarDays color={colors.inkMuted} size={18} />
          <DateTimePicker
            accessibilityHint={error || undefined}
            accessibilityLabel={label}
            disabled={disabled}
            display="compact"
            maximumDate={disabled ? undefined : maximum || undefined}
            minimumDate={disabled ? undefined : minimum || undefined}
            mode="date"
            onChange={handleChange}
            value={selectedDate}
          />
        </View>
      ) : (
        <Pressable
          accessibilityHint={error || undefined}
          accessibilityLabel={`${label}, ${value}`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={openAndroidPicker}
          style={[
            styles.inputShell,
            error && styles.inputShellError,
            disabled && styles.inputShellDisabled,
          ]}
        >
          <Text style={styles.value}>{value}</Text>
          <CalendarDays color={colors.inkMuted} size={18} />
        </Pressable>
      )}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
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
  inputShell: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  inputShellDisabled: {
    opacity: 0.64,
  },
  value: {
    ...typography.body,
    color: colors.ink,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
