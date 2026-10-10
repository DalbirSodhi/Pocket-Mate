import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Apple,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  Sparkles,
  Target,
  Utensils,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import {
  addDays,
  getLocalDateString,
  parseLocalDateString,
} from '../../../utils/date.cjs';
import { useAuthSession } from '../../auth';
import { getMealEntries, getNutritionProfile } from '../services/nutritionService';
import { calculateNutritionProgress } from '../utils/nutritionMath.cjs';

const HIGH_PROTEIN_IDEAS = [
  {
    name: 'Greek yogurt power bowl',
    detail: 'Greek yogurt, berries, oats, and seeds',
    protein: 'About 30 g protein',
  },
  {
    name: 'Chicken quinoa plate',
    detail: 'Chicken breast, quinoa, greens, and yogurt sauce',
    protein: 'About 45 g protein',
  },
  {
    name: 'Tofu edamame stir-fry',
    detail: 'Firm tofu, edamame, vegetables, and brown rice',
    protein: 'About 35 g protein',
  },
];

const GOAL_LABELS = {
  lose_fat: 'Lose fat',
  maintain: 'Maintain weight',
  build_muscle: 'Build muscle',
};

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function formatSelectedDate(value) {
  const date = parseLocalDateString(value) || new Date();
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function ProgressBar({ ratio, color = colors.primary }) {
  const width = `${Math.min(Math.max(ratio || 0, 0), 1) * 100}%`;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { backgroundColor: color, width }]} />
    </View>
  );
}

function MacroMetric({ label, progress, unit = 'g' }) {
  return (
    <View style={styles.macroMetric}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {progress?.consumed || 0}
        <Text style={styles.macroTarget}> / {progress?.target || 0} {unit}</Text>
      </Text>
      <ProgressBar ratio={progress?.ratio || 0} />
    </View>
  );
}

export function NutritionDashboardScreen({ navigation }) {
  const { user } = useAuthSession();
  const today = useMemo(() => getLocalDateString(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNutrition = useCallback(async () => {
    const [nextProfile, nextMeals] = await Promise.all([
      getNutritionProfile(user.id),
      getMealEntries({ userId: user.id, eatenOn: selectedDate }),
    ]);
    setProfile(nextProfile);
    setMeals(nextMeals);
    setError('');
  }, [selectedDate, user.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsLoading(true);
      loadNutrition()
        .catch((loadError) => {
          if (isActive) {
            setMeals([]);
            setError(loadError.message || 'Unable to load wellness data.');
          }
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });

      return () => {
        isActive = false;
      };
    }, [loadNutrition]),
  );

  async function refresh() {
    setIsRefreshing(true);
    try {
      await loadNutrition();
    } catch (loadError) {
      setError(loadError.message || 'Unable to refresh wellness data.');
    } finally {
      setIsRefreshing(false);
    }
  }

  const progress = calculateNutritionProgress(profile, meals);
  const caloriesConsumed = progress.totals.calories;
  const caloriesRemaining = progress.calories?.remaining || 0;
  const isToday = selectedDate === today;

  function moveDay(offset) {
    const currentDate = parseLocalDateString(selectedDate) || new Date();
    const nextDate = getLocalDateString(addDays(currentDate, offset));
    if (nextDate <= today) setSelectedDate(nextDate);
  }

  if (isLoading && !error) {
    return <LoadingScreen message="Loading today's nutrition..." />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
      >
        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.eyebrow}>{formatSelectedDate(selectedDate)}</Text>
              <Text accessibilityRole="header" style={styles.pageTitle}>
                Wellness
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Edit nutrition goals"
              accessibilityRole="button"
              onPress={() => navigation.navigate('NutritionGoals')}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Target color={colors.ink} size={21} />
            </Pressable>
          </View>

          <InlineNotice message={error} variant="error" />

          <View style={styles.dateNavigator}>
            <Pressable
              accessibilityLabel="Previous day"
              accessibilityRole="button"
              onPress={() => moveDay(-1)}
              style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
            >
              <ChevronLeft color={colors.ink} size={20} />
            </Pressable>
            <View style={styles.dateCopy}>
              <Text style={styles.dateLabel}>{isToday ? 'Today' : formatSelectedDate(selectedDate)}</Text>
              {!isToday ? (
                <Pressable accessibilityRole="button" onPress={() => setSelectedDate(today)}>
                  <Text style={styles.todayAction}>Return to today</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Next day"
              accessibilityRole="button"
              accessibilityState={{ disabled: isToday }}
              disabled={isToday}
              onPress={() => moveDay(1)}
              style={({ pressed }) => [
                styles.dateButton,
                isToday && styles.dateButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <ChevronRight color={colors.ink} size={20} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroHeading}>
              <View>
                <Text style={styles.heroLabel}>
                  {isToday ? 'Calories today' : 'Calories on this day'}
                </Text>
                <Text style={styles.heroValue}>{caloriesConsumed}</Text>
              </View>
              <View style={styles.heroIcon}>
                <Flame color={colors.white} size={24} />
              </View>
            </View>
            {profile ? (
              <>
                <ProgressBar ratio={progress.calories.ratio} color={colors.primary} />
                <View style={styles.heroFooter}>
                  <Text style={styles.heroDetail}>{caloriesRemaining} remaining</Text>
                  <Text style={styles.heroDetail}>
                    {profile.daily_calorie_target} target
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.heroDetail}>
                Set daily targets to see personalized progress.
              </Text>
            )}
          </View>

          {!profile ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('NutritionGoals')}
              style={({ pressed }) => [styles.setupBand, pressed && styles.pressed]}
            >
              <View style={styles.setupIcon}>
                <Target color={colors.info} size={22} />
              </View>
              <View style={styles.setupCopy}>
                <Text style={styles.setupTitle}>Set your nutrition goals</Text>
                <Text style={styles.setupBody}>
                  Add your physique goal and daily macro targets.
                </Text>
              </View>
              <ChevronRight color={colors.info} size={20} />
            </Pressable>
          ) : (
            <View style={styles.goalStrip}>
              <View>
                <Text style={styles.goalLabel}>Current goal</Text>
                <Text style={styles.goalValue}>{GOAL_LABELS[profile.goal_type]}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('NutritionGoals')}
              >
                <Text style={styles.textAction}>Edit targets</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily macros</Text>
            <View style={styles.macroGrid}>
              <MacroMetric label="Protein" progress={progress.protein} />
              <MacroMetric label="Carbs" progress={progress.carbs} />
              <MacroMetric label="Fat" progress={progress.fat} />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>
                {isToday ? "Today's meals" : 'Meals'}
              </Text>
              <Pressable
                accessibilityLabel="Add meal"
                accessibilityRole="button"
                onPress={() => navigation.navigate('AddMeal', { eatenOn: selectedDate })}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Plus color={colors.white} size={19} />
                <Text style={styles.addButtonLabel}>Add meal</Text>
              </Pressable>
            </View>

            {meals.length === 0 ? (
              <View style={styles.emptyState}>
                <Utensils color={colors.inkMuted} size={22} />
                <View style={styles.emptyCopy}>
                  <Text style={styles.emptyTitle}>No meals logged today</Text>
                  <Text style={styles.emptyBody}>
                    Record meals to compare your intake with your targets.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.list}>
                {meals.map((meal) => (
                  <Pressable
                    accessibilityRole="button"
                    key={meal.id}
                    onPress={() => navigation.navigate('AddMeal', { mealId: meal.id })}
                    style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
                  >
                    <View style={styles.mealIcon}>
                      <Apple color={colors.primary} size={20} />
                    </View>
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>{meal.name}</Text>
                      <Text style={styles.listBody}>
                        {MEAL_LABELS[meal.meal_type]} - {meal.protein_g} g protein
                      </Text>
                    </View>
                    <View style={styles.listValue}>
                      <Text style={styles.calorieValue}>{meal.calories}</Text>
                      <Text style={styles.calorieUnit}>cal</Text>
                    </View>
                    <ChevronRight color={colors.inkMuted} size={18} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.guideHeading}>
              <Sparkles color={colors.primary} size={20} />
              <Text style={styles.sectionTitle}>High-protein ideas</Text>
            </View>
            <View style={styles.list}>
              {HIGH_PROTEIN_IDEAS.map((idea) => (
                <View key={idea.name} style={styles.guideRow}>
                  <View style={styles.guideCopy}>
                    <Text style={styles.listTitle}>{idea.name}</Text>
                    <Text style={styles.listBody}>{idea.detail}</Text>
                  </View>
                  <Text style={styles.proteinValue}>{idea.protein}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.disclaimer}>
              Nutrition values are estimates. Adjust ingredients and portions to your needs.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.xl },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.caption, color: colors.inkMuted },
  pageTitle: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dateNavigator: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  dateButton: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dateButtonDisabled: { opacity: 0.35 },
  dateCopy: { flex: 1, alignItems: 'center' },
  dateLabel: { ...typography.label, color: colors.ink },
  todayAction: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  pressed: { opacity: 0.72 },
  hero: { backgroundColor: colors.darkPanel, borderRadius: radius.md, padding: spacing.xl, gap: spacing.lg },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabel: { ...typography.label, color: colors.panelMuted },
  heroValue: { ...typography.hero, color: colors.white, fontSize: 44, lineHeight: 50, marginTop: spacing.xs },
  heroIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  heroDetail: { ...typography.caption, color: colors.panelMuted },
  progressTrack: { height: 7, borderRadius: radius.round, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.round },
  setupBand: { minHeight: 84, borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  setupIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  setupCopy: { flex: 1, minWidth: 0 },
  setupTitle: { ...typography.label, fontSize: 16, color: colors.info },
  setupBody: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  goalStrip: { minHeight: 72, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  goalLabel: { ...typography.caption, color: colors.inkMuted },
  goalValue: { ...typography.section, fontSize: 18, color: colors.ink, marginTop: spacing.xs },
  textAction: { ...typography.label, color: colors.primary },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { ...typography.section, color: colors.ink },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macroMetric: { minWidth: 150, flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  macroLabel: { ...typography.caption, color: colors.inkMuted },
  macroValue: { ...typography.section, fontSize: 18, color: colors.ink },
  macroTarget: { ...typography.caption, color: colors.inkMuted },
  addButton: { minHeight: 42, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  addButtonLabel: { ...typography.label, color: colors.white },
  emptyState: { minHeight: 92, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyCopy: { flex: 1 },
  emptyTitle: { ...typography.label, color: colors.ink },
  emptyBody: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  list: { borderTopWidth: 1, borderColor: colors.border },
  listRow: { minHeight: 76, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  mealIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { ...typography.label, color: colors.ink },
  listBody: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  listValue: { alignItems: 'flex-end' },
  calorieValue: { ...typography.label, color: colors.ink },
  calorieUnit: { ...typography.caption, color: colors.inkMuted },
  guideHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guideRow: { minHeight: 82, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guideCopy: { flex: 1, minWidth: 0 },
  proteinValue: { ...typography.caption, color: colors.success, fontWeight: '700', maxWidth: 100, textAlign: 'right' },
  disclaimer: { ...typography.caption, color: colors.inkMuted },
});
