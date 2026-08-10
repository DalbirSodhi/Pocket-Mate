import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { colors, spacing, typography } from '../theme/tokens';

export function LoadingScreen({ message = 'Loading your account...' }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <BrandMark />
        <ActivityIndicator
          accessibilityLabel={message}
          accessibilityRole="progressbar"
          color={colors.primary}
          size="large"
        />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  message: {
    ...typography.body,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
