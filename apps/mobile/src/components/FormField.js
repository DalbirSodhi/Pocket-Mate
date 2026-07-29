import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  autoCorrect = true,
  spellCheck = true,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  error,
  maxLength,
  multiline = false,
  numberOfLines,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const shouldHideValue = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          isFocused && styles.inputShellFocused,
          error && styles.inputShellError,
        ]}
      >
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onChangeText={onChangeText}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          returnKeyType={returnKeyType}
          secureTextEntry={shouldHideValue}
          spellCheck={spellCheck}
          style={[styles.input, multiline && styles.multilineInput]}
          textContentType={textContentType}
          value={value}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={styles.visibilityButton}
          >
            {isPasswordVisible ? (
              <EyeOff color={colors.inkMuted} size={20} />
            ) : (
              <Eye color={colors.inkMuted} size={20} />
            )}
          </Pressable>
        ) : null}
      </View>
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
  inputShell: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  input: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
  },
  visibilityButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
