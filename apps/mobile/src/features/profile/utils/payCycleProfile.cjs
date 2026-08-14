const {
  addMonthsClamped,
  getLocalDateString,
  isValidDateString,
} = require('../../../utils/date.cjs');

const DEFAULT_PAY_CYCLE = 'monthly';
const SUPPORTED_PAY_CYCLES = Object.freeze([
  'weekly',
  'bi_weekly',
  'semi_monthly',
  'monthly',
]);
const LEGACY_PAY_CYCLES = Object.freeze([...SUPPORTED_PAY_CYCLES, 'custom']);

function getTodayDateString(today = new Date()) {
  return getLocalDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12),
  );
}

function getDefaultPayCycleAnchorDate(today = new Date()) {
  return getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1, 12));
}

function getLegacyAnchorDate(profile, today) {
  const startDay = Number(profile?.pay_cycle_start_day);

  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    return null;
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const candidate = addMonthsClamped(monthStart, 0, startDay);

  return getLocalDateString(
    candidate > today
      ? addMonthsClamped(monthStart, -1, startDay)
      : candidate,
  );
}

function getInitialPayCycleFormValues(profile = {}, today = new Date()) {
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );
  const payCycle = profile.pay_cycle || DEFAULT_PAY_CYCLE;
  const storedAnchor = profile.pay_cycle_anchor_date;

  return {
    payCycle,
    payCycleAnchorDate:
      isValidDateString(storedAnchor)
        ? storedAnchor
        : getLegacyAnchorDate(profile, normalizedToday) ||
          getDefaultPayCycleAnchorDate(normalizedToday),
  };
}

function getPayCycleAnchorLabel(payCycle) {
  if (payCycle === 'weekly') {
    return 'Most recent payday';
  }

  if (payCycle === 'bi_weekly') {
    return 'Most recent payday';
  }

  if (payCycle === 'semi_monthly') {
    return 'One of your two monthly paydays';
  }

  return 'Monthly payday';
}

function getPayCycleAnchorHint(payCycle) {
  if (payCycle === 'weekly') {
    return 'Future paydays repeat every 7 days from this date.';
  }

  if (payCycle === 'bi_weekly') {
    return 'Future paydays repeat every 14 days from this date.';
  }

  if (payCycle === 'semi_monthly') {
    return 'Choose either payday. Pocket-Mate derives the other payday 15 days away.';
  }

  if (payCycle === 'custom') {
    return 'Your existing custom cycle is preserved. The dashboard uses the saved anchor date.';
  }

  return 'Future paydays use this day each month and clamp to the last day in shorter months.';
}

function validatePayCycleSettings({
  payCycle,
  payCycleAnchorDate,
  today = new Date(),
}) {
  const errors = {};

  if (!LEGACY_PAY_CYCLES.includes(payCycle)) {
    errors.payCycle = 'Choose a valid pay cycle.';
  }

  if (!isValidDateString(payCycleAnchorDate)) {
    errors.payCycleAnchorDate = 'Enter a valid payday date in YYYY-MM-DD format.';
  } else if (payCycleAnchorDate > getTodayDateString(today)) {
    errors.payCycleAnchorDate = 'The most recent payday cannot be in the future.';
  }

  return errors;
}

function assertValidPayCycleSettings(settings) {
  const errors = validatePayCycleSettings(settings);
  const firstError = errors.payCycle || errors.payCycleAnchorDate;

  if (firstError) {
    throw new Error(firstError);
  }
}

module.exports = {
  DEFAULT_PAY_CYCLE,
  LEGACY_PAY_CYCLES,
  SUPPORTED_PAY_CYCLES,
  assertValidPayCycleSettings,
  getDefaultPayCycleAnchorDate,
  getInitialPayCycleFormValues,
  getPayCycleAnchorHint,
  getPayCycleAnchorLabel,
  getTodayDateString,
  validatePayCycleSettings,
};
