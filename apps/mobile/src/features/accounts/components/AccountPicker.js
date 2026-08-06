import { Check, CreditCard, Landmark, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';

function getIcon(accountType) {
  if (accountType === 'credit_card') return CreditCard;
  if (accountType === 'cash') return Wallet;
  return Landmark;
}

export function AccountPicker({
  accounts,
  label = 'Account',
  selectedId,
  onSelect,
  currencyCode = 'CAD',
  allowUnassigned = true,
  error,
}) {
  const options = allowUnassigned
    ? [{ id: '', name: 'Not assigned', account_type: 'other', balanceCents: null }, ...accounts]
    : accounts;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grid}>
        {options.map((account) => {
          const selected = account.id === selectedId;
          const Icon = getIcon(account.account_type);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={account.id || 'unassigned'}
              onPress={() => onSelect(account.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Icon color={selected ? colors.primary : colors.inkMuted} size={18} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={[styles.name, selected && styles.nameSelected]}>
                  {account.name}
                </Text>
                {account.balanceCents !== null ? (
                  <Text numberOfLines={1} style={styles.balance}>
                    {formatCurrency(account.balanceCents, currencyCode)}
                  </Text>
                ) : null}
              </View>
              {selected ? <Check color={colors.primary} size={17} /> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.label, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 58,
    minWidth: 180,
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.infoSoft },
  copy: { flex: 1, minWidth: 0 },
  name: { ...typography.label, color: colors.ink },
  nameSelected: { color: colors.primary },
  balance: { ...typography.caption, color: colors.inkMuted },
  error: { ...typography.caption, color: colors.danger },
});
