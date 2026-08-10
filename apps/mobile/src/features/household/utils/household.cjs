const ALLOWED_MEMBER_ROLES = ['owner', 'editor', 'viewer'];
const ALLOWED_INVITE_ROLES = ['editor', 'viewer'];

function normalizeHouseholdName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeInvitationCode(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function validateHouseholdName(value) {
  const name = normalizeHouseholdName(value);

  if (name.length < 2) return 'Enter a household name with at least 2 characters.';
  if (name.length > 80) return 'Keep the household name under 80 characters.';
  return '';
}

function validateInvitation({ email, role }) {
  const normalizedEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { email: 'Enter a valid email address.' };
  }

  if (!ALLOWED_INVITE_ROLES.includes(role)) {
    return { role: 'Choose editor or viewer access.' };
  }

  return {};
}

function canManageHousehold(role) {
  return role === 'owner';
}

function describeAuditEvent(event) {
  const email = event?.metadata?.email;
  const name = event?.metadata?.displayName;
  const subject = name || email || 'A household member';

  switch (event?.action) {
    case 'household.created':
      return 'Household created';
    case 'invitation.created':
      return email ? `Invitation created for ${email}` : 'Invitation created';
    case 'invitation.accepted':
      return `${subject} joined the household`;
    case 'member.role_updated':
      return `${subject} changed to ${event?.metadata?.role || 'a new role'}`;
    case 'member.removed':
      return `${subject} left the household`;
    case 'ownership.transferred':
      return `Ownership transferred to ${subject}`;
    default:
      return 'Household updated';
  }
}

module.exports = {
  ALLOWED_INVITE_ROLES,
  ALLOWED_MEMBER_ROLES,
  canManageHousehold,
  describeAuditEvent,
  normalizeEmail,
  normalizeHouseholdName,
  normalizeInvitationCode,
  validateHouseholdName,
  validateInvitation,
};
