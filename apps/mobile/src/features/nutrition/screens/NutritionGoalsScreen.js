import { useFocusEffect } from '@react-navigation/native';
import { Target } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { KeyboardAwareScrollView } from '../../../components/KeyboardAwareScrollView';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useNetworkStatus } from '../../../infrastructure/network';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { ProfileChoiceGroup } from '../../profile/components/ProfileChoiceGroup';
import { getNutritionProfile, saveNutritionProfile } from '../services/nutritionService';
import { validateNutritionProfile } from '../utils/nutritionMath.cjs';

const GOAL_OPTIONS = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'build_muscle', label: 'Build muscle' },
];

const DIET_OPTIONS = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'high_protein', label: 'High protein' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'low_carb', label: 'Low carbohydrate' },
];

function formatWeight(grams) {
  if (!grams) return '';
  const kilograms = grams / 1000;
  return Number.isInteger(kilograms) ? String(kilograms) : kilograms.toFixed(2).replace(/0$/, '');
}

export function NutritionGoalsScreen({ navigation }) {
  const { user } = useAuthSession();
  const { isOffline } = useNetworkStatus();
  const [goalType, setGoalType] = useState('maintain');
  const [dietaryStyle, setDietaryStyle] = useState('balanced');
  const [currentWeightKg, setCurrentWeightKg] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState('');
  const [proteinTargetG, setProteinTargetG] = useState('');
  const [carbsTargetG, setCarbsTargetG] = useState('');
  const [fatTargetG, setFatTargetG] = useState('');
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    setRequestError('');
    try {
      const profile = await getNutritionProfile(user.id);
      if (profile) {
        setGoalType(profile.goal_type);
        setDietaryStyle(profile.dietary_style);
        setCurrentWeightKg(formatWeight(profile.current_weight_grams));
        setTargetWeightKg(formatWeight(profile.target_weight_grams));
        setHeightCm(String(profile.height_cm));
        setDailyCalorieTarget(String(profile.daily_calorie_target));
        setProteinTargetG(String(profile.protein_target_g));
        setCarbsTargetG(String(profile.carbs_target_g));
        setFatTargetG(String(profile.fat_target_g));
      }
    } catch (error) {
      setRequestError(error.message || 'Unable to load nutrition goals.');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  async function handleSave() {
    if (isSaving) return;
    const validation = validateNutritionProfile({
      goalType,
      dietaryStyle,
      currentWeightKg,
      targetWeightKg,
      heightCm,
      dailyCalorieTarget,
      proteinTargetG,
      carbsTargetG,
      fatTargetG,
    });
    setErrors(validation.errors);
    setRequestError('');

    if (isOffline) {
      setRequestError('Saving nutrition goals requires an internet connection.');
      return;
    }
    if (Object.keys(validation.errors).length > 0) return;

    setIsSaving(true);
    try {
      await saveNutritionProfile({ userId: user.id, ...validation.values });
      navigation.goBack();
    } catch (error) {
      setRequestError(error.message || 'Unable to save nutrition goals.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingScreen message="Loading nutrition goals..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Set the targets you want to follow"
            title="Nutrition goals"
          />

          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Target color={colors.primary} size={24} />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Build a daily target</Text>
              <Text style={styles.introBody}>
                Choose your own calorie and macro targets. Pocket-Mate tracks progress without prescribing a diet.
              </Text>
            </View>
          </View>

          <InlineNotice message={requestError} variant="error" />
          <InlineNotice
            message={isOffline ? 'You can review targets offline. Saving needs a connection.' : ''}
            variant="warning"
          />

          <View style={styles.form}>
            <ProfileChoiceGroup
              label="Physique goal"
              onSelect={setGoalType}
              options={GOAL_OPTIONS}
              selectedValue={goalType}
            />
            {errors.goalType ? <Text style={styles.error}>{errors.goalType}</Text> : null}

            <ProfileChoiceGroup
              label="Eating style"
              onSelect={setDietaryStyle}
              options={DIET_OPTIONS}
              selectedValue={dietaryStyle}
            />
            {errors.dietaryStyle ? <Text style={styles.error}>{errors.dietaryStyle}</Text> : null}

            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.currentWeightKg}
                  keyboardType="decimal-pad"
                  label="Current weight (kg)"
                  onChangeText={setCurrentWeightKg}
                  placeholder="80"
                  value={currentWeightKg}
                />
              </View>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.targetWeightKg}
                  keyboardType="decimal-pad"
                  label="Target weight (kg)"
                  onChangeText={setTargetWeightKg}
                  placeholder="85"
                  value={targetWeightKg}
                />
              </View>
            </View>

            <FormField
              error={errors.heightCm}
              keyboardType="number-pad"
              label="Height (cm)"
              onChangeText={setHeightCm}
              placeholder="180"
              value={heightCm}
            />

            <View style={styles.divider} />
            <Text style={styles.formTitle}>Daily targets</Text>

            <FormField
              error={errors.dailyCalorieTarget}
              keyboardType="number-pad"
              label="Calories"
              onChangeText={setDailyCalorieTarget}
              placeholder="2400"
              value={dailyCalorieTarget}
            />
            <View style={styles.fieldRow}>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.proteinTargetG}
                  keyboardType="number-pad"
                  label="Protein (g)"
                  onChangeText={setProteinTargetG}
                  placeholder="160"
                  value={proteinTargetG}
                />
              </View>
              <View style={styles.fieldColumn}>
                <FormField
                  error={errors.carbsTargetG}
                  keyboardType="number-pad"
                  label="Carbs (g)"
                  onChangeText={setCarbsTargetG}
                  placeholder="260"
                  value={carbsTargetG}
                />
              </View>
            </View>
            <FormField
              error={errors.fatTargetG}
              keyboardType="number-pad"
              label="Fat (g)"
              onChangeText={setFatTargetG}
              placeholder="70"
              value={fatTargetG}
            />

            <InlineNotice
              message="These are self-selected planning targets, not medical advice. Consult a qualified professional for clinical nutrition guidance."
              variant="info"
            />
            <AppButton
              disabled={isOffline}
              icon={Target}
              isLoading={isSaving}
              label="Save goals"
              onPress={handleSave}
            />
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
  fieldColumn: { minWidth: 220, flex: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  formTitle: { ...typography.section, color: colors.ink },
  error: { ...typography.caption, color: colors.danger, marginTop: -spacing.sm },
});
