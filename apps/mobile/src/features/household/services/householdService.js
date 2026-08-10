import { supabase } from '../../../infrastructure/supabase/client';
import { getLocalDateString } from '../../../utils/date.cjs';
import {
  normalizeEmail,
  normalizeHouseholdName,
  normalizeInvitationCode,
} from '../utils/household.cjs';

function unwrap(response) {
  if (response.error) throw response.error;
  return response.data;
}

function currentMonthStart() {
  return `${getLocalDateString().slice(0, 7)}-01`;
}

function normalizeSummary(summary) {
  const value = summary || {};
  return {
    monthStart: value.monthStart || value.month_start || currentMonthStart(),
    householdIncomeCents:
      value.householdIncomeCents ?? value.household_income_cents ?? 0,
    householdSpentCents:
      value.householdSpentCents ?? value.household_spent_cents ?? 0,
    householdNetCents:
      value.householdNetCents ?? value.household_net_cents ?? 0,
    members: (value.members || []).map((member) => ({
      userId: member.userId || member.user_id,
      displayName: member.displayName || member.display_name || 'Household member',
      role: member.role,
      incomeCents: member.incomeCents ?? member.income_cents ?? 0,
      spentCents: member.spentCents ?? member.spent_cents ?? 0,
      netCents: member.netCents ?? member.net_cents ?? 0,
    })),
  };
}

export async function getHouseholdWorkspace(userId, monthStart = currentMonthStart()) {
  const membership = unwrap(
    await supabase
      .from('household_members')
      .select('household_id, user_id, role, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  );

  if (!membership) return null;

  const [householdResponse, summaryResponse, auditResponse] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, owner_user_id, created_at')
      .eq('id', membership.household_id)
      .single(),
    supabase.rpc('get_household_monthly_summary', {
      p_household_id: membership.household_id,
      p_month_start: monthStart,
    }),
    supabase
      .from('household_audit_events')
      .select('id, actor_user_id, target_user_id, action, metadata, created_at')
      .eq('household_id', membership.household_id)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  return {
    household: unwrap(householdResponse),
    membership,
    summary: normalizeSummary(unwrap(summaryResponse)),
    auditEvents: unwrap(auditResponse) || [],
  };
}

export async function createHousehold(name) {
  return unwrap(
    await supabase.rpc('create_household', {
      p_name: normalizeHouseholdName(name),
    }),
  );
}

export async function createHouseholdInvitation({ householdId, email, role }) {
  return unwrap(
    await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
      p_email: normalizeEmail(email),
      p_role: role,
    }),
  );
}

export async function acceptHouseholdInvitation(code) {
  return unwrap(
    await supabase.rpc('accept_household_invitation', {
      p_token: normalizeInvitationCode(code),
    }),
  );
}

export async function updateHouseholdMemberRole({ householdId, userId, role }) {
  unwrap(
    await supabase.rpc('update_household_member_role', {
      p_household_id: householdId,
      p_user_id: userId,
      p_role: role,
    }),
  );
}

export async function removeHouseholdMember({ householdId, userId }) {
  unwrap(
    await supabase.rpc('remove_household_member', {
      p_household_id: householdId,
      p_user_id: userId,
    }),
  );
}
