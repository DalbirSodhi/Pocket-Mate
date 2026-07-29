import { WalletCards } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';

export function BrandMark({ compact = false, inverse = false }) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.icon,
          compact && styles.iconCompact,
          inverse && styles.iconInverse,
        ]}
      >
        <WalletCards
          color={inverse ? colors.white : colors.ink}
          size={compact ? 20 : 26}
          strokeWidth={2.2}
        />
      </View>
      <Text
        style={[
          styles.name,
          compact && styles.nameCompact,
          inverse && styles.nameInverse,
        ]}
      >
        Pocket-Mate
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: {
    width: 36,
    height: 36,
  },
  iconInverse: {
    borderWidth: 1,
    borderColor: colors.panelTrack,
    backgroundColor: 'transparent',
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  nameCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  nameInverse: {
    color: colors.white,
  },
});
