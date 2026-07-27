import {
  CalendarClock,
  ChevronRight,
  CreditCard,
  ReceiptText,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

const EXPENSE_TYPES = [
  {
    id: 'OneTimeExpense',
    title: 'One-time expense',
    description: 'Record an individual purchase or payment.',
    icon: ReceiptText,
    tone: { background: colors.iconSurface, foreground: colors.iconInk },
  },
  {
    id: 'RecurringExpense',
    title: 'Monthly fixed expense',
    description: 'Set rent, subscriptions, and other repeating commitments once.',
    icon: CalendarClock,
    tone: { background: colors.iconSurface, foreground: colors.iconInk },
  },
  {
    id: 'CardBill',
    title: 'Credit card bill',
    description: 'Add a monthly statement using a saved card.',
    icon: CreditCard,
    tone: { background: colors.iconSurface, foreground: colors.iconInk },
  },
];

export function AddExpenseScreen({ navigation, route }) {
  const currencyCode = route.params?.currencyCode || 'CAD';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Choose how this money leaves your account"
            title="Add expense"
          />

          <View style={styles.heading}>
            <Text style={styles.title}>What are you adding?</Text>
            <Text style={styles.body}>
              Categories describe the purpose. These options describe how the
              expense behaves in your monthly plan.
            </Text>
          </View>

          <View style={styles.options}>
            {EXPENSE_TYPES.map((type) => {
              const Icon = type.icon;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={type.id}
                  onPress={() =>
                    navigation.navigate(type.id, { currencyCode })
                  }
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: type.tone.background },
                    ]}
                  >
                    <Icon color={type.tone.foreground} size={23} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{type.title}</Text>
                    <Text style={styles.optionDescription}>{type.description}</Text>
                  </View>
                  <ChevronRight color={colors.inkMuted} size={20} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  heading: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.inkMuted,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  optionTitle: {
    ...typography.section,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
