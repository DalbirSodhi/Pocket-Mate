import { useFocusEffect } from '@react-navigation/native';
import { Check, Trash2, Utensils } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { DateField } from '../../../components/DateField';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { KeyboardAwareScrollView } from '../../../components/KeyboardAwareScrollView';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useNetworkStatus } from '../../../infrastructure/network';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { getLocalDateString } from '../../../utils/date.cjs';
import { useAuthSession } from '../../auth';
import { ProfileChoiceGroup } from '../../profile/components/ProfileChoiceGroup';
import {
  deleteMealEntry,
  getMealEntry,
  saveMealEntry,
} from '../services/nutritionService';
import { validateMealEntry } from '../utils/nutritionMath.cjs';

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function AddMealScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const { isOffline } = useNetworkStatus();
  const mealId = route.params?.mealId;
  const isEditing = Boolean(mealId);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [eatenOn, setEatenOn] = useState(route.params?.eatenOn || getLocalDateString());
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('0');
  const [carbsG, setCarbsG] = useState('0');
  const [fatG, setFatG] = useState('0');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMeal = useCallback(async () => {
    if (!mealId) {
      setIsLoading(false);
      return;
    }
    setRequestError('');
    try {
      const meal = await getMealEntry({ userId: user.id, mealId });
      setName(meal.name);
      setMealType(meal.meal_type);
      setEatenOn(meal.eaten_on);
      setCalories(String(meal.calories));
      setProteinG(String(meal.protein_g));
      setCarbsG(String(meal.carbs_g));
      setFatG(String(meal.fat_g));
      setNote(meal.note || '');
    } catch (error) {
      setRequestError(error.message || 'Unable to load this meal.');
    } finally {
      setIsLoading(false);
    }
  }, [mealId, user.id]);

  useFocusEffect(
    useCallback(() => {
      loadMeal();
    }, [loadMeal]),
  );

  async function handleSave() {
    if (isSaving) return;
    const validation = validateMealEntry({
      name,
      mealType,
      eatenOn,
      calories,
      proteinG,
      carbsG,
      fatG,
    });
    setErrors(validation.errors);
    setRequestError('');

    if (isOffline) {
      setRequestError('Saving a meal requires an internet connection.');
      return;
    }
    if (Object.keys(validation.errors).length > 0) return;

    setIsSaving(true);
    try {
      await saveMealEntry({
        userId: user.id,
        mealId,
        name,
        mealType,
        eatenOn,
        note,
        ...validation.values,
      });
      navigation.goBack();
    } catch (error) {
      setRequestError(error.message || 'Unable to save this meal.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeMeal() {
    setIsDeleting(true);
    setRequestError('');
    try {
      await deleteMealEntry({ userId: user.id, mealId });
      navigation.goBack();
    } catch (error) {
      setRequestError(error.message || 'Unable to delete this meal.');
      setIsDeleting(false);
    }
  }

  function confirmDelete() {
    const message = 'Delete this meal from your nutrition history?';
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(message)) removeMeal();
      return;
    }
    Alert.alert('Delete meal?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: removeMeal },
    ]);
  }

  if (isLoading) return <LoadingScreen message="Loading meal..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle={isEditing ? 'Correct nutrition details' : 'Record what you ate'}
            title={isEditing ? 'Edit meal' : 'Add meal'}
          />

          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Utensils color={colors.primary} size={24} />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Track the full meal</Text>
              <Text style={styles.introBody}>
                Add label values or your best estimate. You can correct them later.
              </Text>
            </View>
          </View>

          <InlineNotice message={requestError} variant="error" />
          <InlineNotice
            message={isOffline ? 'You can review this meal offline. Saving needs a connection.' : ''}
            variant="warning"
          />

          <View style={styles.form}>
            <ProfileChoiceGroup
              label="Meal type"
              onSelect={setMealType}
              options={MEAL_OPTIONS}
              selectedValue={mealType}
            />
            {errors.mealType ? <Text style={styles.error}>{errors.mealType}</Text> : null}
            <FormField
              error={errors.name}
              label="Meal name"
              maxLength={100}
              onChangeText={setName}
              placeholder="Chicken quinoa bowl"
              value={name}
            />
            <DateField
              error={errors.eatenOn}
              label="Date eaten"
              onChange={setEatenOn}
              value={eatenOn}
            />
            <FormField
              error={errors.calories}
              keyboardType="number-pad"
              label="Calories"
              onChangeText={setCalories}
              placeholder="550"
              value={calories}
            />
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.proteinG}
                  keyboardType="number-pad"
                  label="Protein (g)"
                  onChangeText={setProteinG}
                  placeholder="40"
                  value={proteinG}
                />
              </View>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.carbsG}
                  keyboardType="number-pad"
                  label="Carbs (g)"
                  onChangeText={setCarbsG}
                  placeholder="60"
                  value={carbsG}
                />
              </View>
            </View>
            <FormField
              error={errors.fatG}
              keyboardType="number-pad"
              label="Fat (g)"
              onChangeText={setFatG}
              placeholder="18"
              value={fatG}
            />
            <FormField
              label="Note (optional)"
              maxLength={300}
              multiline
              numberOfLines={3}
              onChangeText={setNote}
              placeholder="Ingredients, serving size, or preparation"
              value={note}
            />

            <AppButton
              disabled={isOffline || isDeleting}
              icon={Check}
              isLoading={isSaving}
              label={isEditing ? 'Save changes' : 'Save meal'}
              onPress={handleSave}
            />
            {isEditing ? (
              <AppButton
                disabled={isOffline || isSaving}
                icon={Trash2}
                isLoading={isDeleting}
                label="Delete meal"
                onPress={confirmDelete}
                variant="danger"
              />
            ) : null}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.xl },
  intro: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  introIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, minWidth: 0 },
  introTitle: { ...typography.section, fontSize: 18, color: colors.ink },
  introBody: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  form: { gap: spacing.lg },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fieldColumn: { minWidth: 200, flex: 1 },
  error: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm },
});
