const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canManageHousehold,
  describeAuditEvent,
  normalizeEmail,
  normalizeHouseholdName,
  normalizeInvitationCode,
  validateHouseholdName,
  validateInvitation,
} = require('./household.cjs');

test('household inputs are normalized before persistence', () => {
  assert.equal(normalizeHouseholdName('  Sodhi   Home  '), 'Sodhi Home');
  assert.equal(normalizeEmail('  Friend@Example.COM '), 'friend@example.com');
  assert.equal(normalizeInvitationCode(' abcd 1234\n'), 'abcd1234');
});

test('household name validation rejects unclear names', () => {
  assert.match(validateHouseholdName('A'), /at least 2/);
  assert.match(validateHouseholdName('A'.repeat(81)), /under 80/);
  assert.equal(validateHouseholdName('Sodhi Home'), '');
});

test('invitations require a valid email and restricted role', () => {
  assert.deepEqual(validateInvitation({ email: 'bad', role: 'editor' }), {
    email: 'Enter a valid email address.',
  });
  assert.deepEqual(validateInvitation({ email: 'friend@example.com', role: 'owner' }), {
    role: 'Choose editor or viewer access.',
  });
  assert.deepEqual(validateInvitation({ email: 'friend@example.com', role: 'viewer' }), {});
});

test('only owners can administer a household', () => {
  assert.equal(canManageHousehold('owner'), true);
  assert.equal(canManageHousehold('editor'), false);
  assert.equal(canManageHousehold('viewer'), false);
});

test('audit descriptions stay useful without exposing transaction details', () => {
  assert.equal(
    describeAuditEvent({ action: 'invitation.created', metadata: { email: 'friend@example.com' } }),
    'Invitation created for friend@example.com',
  );
  assert.equal(
    describeAuditEvent({ action: 'member.role_updated', metadata: { displayName: 'Sam', role: 'viewer' } }),
    'Sam changed to viewer',
  );
  assert.equal(describeAuditEvent({ action: 'unknown' }), 'Household updated');
});
