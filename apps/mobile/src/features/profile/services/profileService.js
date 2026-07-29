import { supabase } from '../../../infrastructure/supabase/client';
import {
  getLocalDateString,
  isValidDateString,
} from '../../../utils/date.cjs';

const supportedCurrencies = ['CAD', 'USD', 'GBP', 'EUR', 'AUD'];
const supportedPayCycles = [
  'weekly',
  'bi_weekly',
  'semi_monthly',
  'monthly',
  'custom',
];

function unwrapResponse(response) {
  if (response.error) {
    throw response.error;
  }

  return response.data;
}

function normalizeDisplayName(displayName) {
  const value = String(displayName || '').trim();

  if (!value) {
    throw new Error('Enter your name.');
  }

  return value;
}

function assertAllowedValue(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new Error(`Choose a valid ${fieldName}.`);
  }
}

function getCurrentMonthStartDate() {
  return `${getLocalDateString().slice(0, 7)}-01`;
}

export async function getProfile(userId) {
  const response = await supabase
    .from('profiles')
    .select(
      'id, display_name, currency_code, pay_cycle, pay_cycle_start_day, pay_cycle_anchor_date',
    )
    .eq('id', userId)
    .maybeSingle();

  return unwrapResponse(response);
}

export async function saveProfile({
  userId,
  displayName,
  currencyCode,
  payCycle = 'monthly',
  payCycleAnchorDate = getCurrentMonthStartDate(),
}) {
  assertAllowedValue(currencyCode, supportedCurrencies, 'currency');
  assertAllowedValue(payCycle, supportedPayCycles, 'pay cycle');

  if (!isValidDateString(payCycleAnchorDate)) {
    throw new Error('Enter the payday as a valid YYYY-MM-DD date.');
  }

  if (payCycleAnchorDate > getLocalDateString()) {
    throw new Error('The most recent payday cannot be in the future.');
  }

  const response = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: normalizeDisplayName(displayName),
      currency_code: currencyCode,
      pay_cycle: payCycle,
      pay_cycle_anchor_date: payCycleAnchorDate,
    })
    .select(
      'id, display_name, currency_code, pay_cycle, pay_cycle_start_day, pay_cycle_anchor_date',
    )
    .single();

  return unwrapResponse(response);
}
