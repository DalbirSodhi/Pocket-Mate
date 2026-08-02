import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppButton } from './AppButton';
import { InlineNotice } from './InlineNotice';
import { spacing } from '../theme/tokens';

export function RetryNotice({ message, onRetry, isRetrying = false }) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.container}>
      <InlineNotice message={message} variant="error" />
      <AppButton
        icon={RefreshCw}
        isLoading={isRetrying}
        label="Try again"
        onPress={onRetry}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
});
