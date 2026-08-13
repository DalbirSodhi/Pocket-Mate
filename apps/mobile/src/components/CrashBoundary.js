import { Component } from 'react';
import { RefreshCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { reportError } from '../infrastructure/observability/errorReporter';
import { colors, spacing, typography } from '../theme/tokens';
import { AppButton } from './AppButton';

export class CrashBoundary extends Component {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      area: 'react-render',
      componentStack: info?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={styles.container}
      >
        <Text style={styles.title}>Pocket-Mate needs a refresh</Text>
        <Text style={styles.body}>
          Something interrupted this screen. Your saved finance data was not changed.
        </Text>
        <AppButton label="Try again" icon={RefreshCcw} onPress={this.handleRetry} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkMuted,
  },
});
