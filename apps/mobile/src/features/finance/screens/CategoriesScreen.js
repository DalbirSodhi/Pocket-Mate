import { Plus, Tag } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import {
  createExpenseCategory,
  ensureExpenseCategories,
} from '../services/financeService';
import { getFinanceErrorMessage } from '../utils/getFinanceErrorMessage';

export function CategoriesScreen({ navigation }) {
  const { user } = useAuthSession();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setRequestError('');

    try {
      setCategories(await ensureExpenseCategories(user.id));
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(error, 'Unable to load expense categories.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories]),
  );

  async function handleCreate() {
    const normalizedName = name.trim();

    if (normalizedName.length < 2) {
      setNameError('Use at least two characters.');
      return;
    }

    setNameError('');
    setRequestError('');
    setIsSaving(true);

    try {
      const category = await createExpenseCategory({
        userId: user.id,
        name: normalizedName,
      });
      setCategories((current) =>
        [...current, category].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setName('');
    } catch (error) {
      setRequestError(
        getFinanceErrorMessage(
          error,
          'Unable to create this category.',
          'A category with this name already exists.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <ScreenHeader
              onBack={navigation.goBack}
              subtitle="Organize spending your way"
              title="Categories"
            />

            <InlineNotice message={requestError} variant="error" />

            <View style={styles.createSection}>
              <FormField
                error={nameError}
                label="New category"
                maxLength={40}
                onChangeText={setName}
                onSubmitEditing={handleCreate}
                placeholder="Travel, subscriptions, gifts"
                returnKeyType="done"
                value={name}
              />
              <AppButton
                icon={Plus}
                isLoading={isSaving}
                label="Add category"
                onPress={handleCreate}
                variant="secondary"
              />
            </View>

            <View style={styles.listSection}>
              <View style={styles.listHeading}>
                <Text style={styles.sectionTitle}>Your categories</Text>
                <Text style={styles.count}>{categories.length}</Text>
              </View>

              {isLoading ? (
                <Text style={styles.helperText}>Loading categories...</Text>
              ) : (
                <View style={styles.list}>
                  {categories.map((category, index) => (
                    <View key={category.id}>
                      <View style={styles.row}>
                        <View
                          style={[
                            styles.icon,
                            {
                              backgroundColor: category.color
                                ? `${category.color}20`
                                : colors.surfaceMuted,
                            },
                          ]}
                        >
                          <Tag
                            color={category.color || colors.inkMuted}
                            size={18}
                          />
                        </View>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryType}>
                          {category.is_default ? 'Starter' : 'Custom'}
                        </Text>
                      </View>
                      {index < categories.length - 1 ? (
                        <View style={styles.divider} />
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  createSection: {
    gap: spacing.md,
  },
  listSection: {
    gap: spacing.md,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.section,
    color: colors.ink,
  },
  count: {
    ...typography.label,
    color: colors.accent,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    ...typography.label,
    color: colors.ink,
    flex: 1,
  },
  categoryType: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  helperText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
