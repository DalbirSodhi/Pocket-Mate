import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../../theme/tokens';

export function ProfileChoiceGroup({
  label,
  options,
  selectedValue,
  onSelect,
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          const isSelected = selectedValue === value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.choice,
                isSelected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  isSelected && styles.choiceLabelSelected,
                ]}
              >
                {optionLabel}
              </Text>
              {isSelected ? <Check color={colors.primary} size={18} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  choices: {
    gap: spacing.sm,
  },
  choice: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choicePressed: {
    opacity: 0.8,
  },
  choiceLabel: {
    ...typography.body,
    color: colors.ink,
  },
  choiceLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
