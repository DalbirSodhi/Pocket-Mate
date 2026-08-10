import { useFocusEffect } from '@react-navigation/native';
import {
  Clock3,
  MailPlus,
  Share2,
  ShieldCheck,
  Trash2,
  UsersRound,
  WalletCards,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../../components/AppButton';
import { FormField } from '../../../components/FormField';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { useAuthSession } from '../../auth';
import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import {
  acceptHouseholdInvitation,
  createHousehold,
  createHouseholdInvitation,
  getHouseholdWorkspace,
  removeHouseholdMember,
  updateHouseholdMemberRole,
} from '../services/householdService';
import {
  canManageHousehold,
  describeAuditEvent,
  normalizeEmail,
  validateHouseholdName,
  validateInvitation,
} from '../utils/household.cjs';

const MEMBER_ROLES = ['owner', 'editor', 'viewer'];
const INVITE_ROLES = ['editor', 'viewer'];

function formatMonth(value) {
  if (!value) return 'This month';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatEventTime(value) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function roleLabel(role) {
  return role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : '';
}

function RoleChoices({ allowedRoles, disabled, onSelect, selectedRole }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.roleChoices}>
      {allowedRoles.map((role) => {
        const selected = role === selectedRole;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={role}
            onPress={() => onSelect(role)}
            style={({ pressed }) => [
              styles.roleChoice,
              selected && styles.roleChoiceSelected,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.roleChoiceText, selected && styles.roleChoiceTextSelected]}>
              {roleLabel(role)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function confirmRemoval(message, action) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || window.confirm(message)) action();
    return;
  }

  Alert.alert('Confirm household change', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: action },
  ]);
}

function SetupPanel({ busyAction, onCreate, onJoin }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState('');
  const [codeError, setCodeError] = useState('');

  function create() {
    const error = validateHouseholdName(name);
    setNameError(error);
    if (!error) onCreate(name);
  }

  function join() {
    const error = code.trim() ? '' : 'Enter the invitation code you received.';
    setCodeError(error);
    if (!error) onJoin(code);
  }

  return (
    <>
      <View style={styles.infoPanel}>
        <UsersRound color={colors.info} size={22} />
        <View style={styles.flexCopy}>
          <Text style={styles.infoTitle}>Plan together without exposing every purchase</Text>
          <Text style={styles.infoBody}>
            Household members see monthly income and spending totals. Transaction details,
            notes, cards, and account balances stay private.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create a household</Text>
        <FormField
          error={nameError}
          label="Household name"
          maxLength={80}
          onChangeText={setName}
          placeholder="Sodhi Home"
          value={name}
        />
        <AppButton
          icon={UsersRound}
          isLoading={busyAction === 'create'}
          label="Create household"
          onPress={create}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Join a household</Text>
        <Text style={styles.sectionBody}>Use the private code shared by a household owner.</Text>
        <FormField
          autoCapitalize="none"
          autoCorrect={false}
          error={codeError}
          label="Invitation code"
          onChangeText={setCode}
          placeholder="Paste invitation code"
          value={code}
        />
        <AppButton
          isLoading={busyAction === 'join'}
          label="Join household"
          onPress={join}
          variant="secondary"
        />
      </View>
    </>
  );
}

function SummaryPanel({ currencyCode, summary }) {
  return (
    <View style={styles.summaryPanel}>
      <View style={styles.summaryHeading}>
        <View>
          <Text style={styles.summaryEyebrow}>{formatMonth(summary.monthStart)}</Text>
          <Text style={styles.summaryTitle}>Shared monthly snapshot</Text>
        </View>
        <WalletCards color={colors.white} size={24} />
      </View>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(summary.householdIncomeCents, currencyCode)}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(summary.householdSpentCents, currencyCode)}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(summary.householdNetCents, currencyCode)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function HouseholdScreen({ navigation, route }) {
  const { user } = useAuthSession();
  const currencyCode = route.params?.currencyCode || 'CAD';
  const [workspace, setWorkspace] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteErrors, setInviteErrors] = useState({});
  const [invitationCode, setInvitationCode] = useState('');

  const load = useCallback(async () => {
    try {
      setWorkspace(await getHouseholdWorkspace(user.id));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load household details.');
    } finally {
      setHasLoaded(true);
    }
  }, [user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function runAction(actionName, action, successMessage) {
    setBusyAction(actionName);
    setError('');
    setSuccess('');
    try {
      await action();
      await load();
      if (successMessage) setSuccess(successMessage);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the household.');
    } finally {
      setBusyAction('');
    }
  }

  function handleCreate(name) {
    runAction('create', () => createHousehold(name), 'Household created.');
  }

  function handleJoin(code) {
    runAction('join', () => acceptHouseholdInvitation(code), 'You joined the household.');
  }

  async function handleInvite() {
    const nextErrors = validateInvitation({ email: inviteEmail, role: inviteRole });
    setInviteErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusyAction('invite');
    setError('');
    setSuccess('');
    try {
      const code = await createHouseholdInvitation({
        householdId: workspace.household.id,
        email: inviteEmail,
        role: inviteRole,
      });
      setInvitationCode(code);
      setSuccess(`Invitation ready for ${normalizeEmail(inviteEmail)}.`);
      setInviteEmail('');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Unable to create the invitation.');
    } finally {
      setBusyAction('');
    }
  }

  async function shareInvitation() {
    await Share.share({
      message: `Join ${workspace.household.name} in Pocket-Mate with this private invitation code: ${invitationCode}`,
      title: 'Pocket-Mate household invitation',
    });
  }

  function changeRole(member, role) {
    if (member.role === role) return;
    runAction(
      `role-${member.userId}`,
      () => updateHouseholdMemberRole({
        householdId: workspace.household.id,
        userId: member.userId,
        role,
      }),
      `${member.displayName} is now ${roleLabel(role).toLowerCase()}.`,
    );
  }

  function removeMember(member) {
    const isSelf = member.userId === user.id;
    const message = isSelf
      ? 'Leave this household? Your private finance data will not be deleted.'
      : `Remove ${member.displayName} from this household?`;
    confirmRemoval(message, () => {
      runAction(
        `remove-${member.userId}`,
        () => removeHouseholdMember({
          householdId: workspace.household.id,
          userId: member.userId,
        }),
        isSelf ? 'You left the household.' : `${member.displayName} was removed.`,
      );
    });
  }

  if (!hasLoaded) return <LoadingScreen message="Loading household..." />;

  const canManage = canManageHousehold(workspace?.membership?.role);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ScreenHeader
            onBack={navigation.goBack}
            subtitle="Share monthly progress, not private transactions"
            title="Household"
          />
          <InlineNotice message={error} variant="error" />
          <InlineNotice message={success} variant="success" />

          {!workspace ? (
            <SetupPanel busyAction={busyAction} onCreate={handleCreate} onJoin={handleJoin} />
          ) : (
            <>
              <View style={styles.householdHeading}>
                <View style={styles.householdIcon}><UsersRound color={colors.ink} size={22} /></View>
                <View style={styles.flexCopy}>
                  <Text style={styles.householdName}>{workspace.household.name}</Text>
                  <Text style={styles.sectionBody}>
                    Your access: {roleLabel(workspace.membership.role)}
                  </Text>
                </View>
                <View style={styles.privacyBadge}>
                  <ShieldCheck color={colors.success} size={16} />
                  <Text style={styles.privacyText}>Totals only</Text>
                </View>
              </View>

              <SummaryPanel currencyCode={currencyCode} summary={workspace.summary} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members</Text>
                <Text style={styles.sectionBody}>
                  Owners manage access. Editors and viewers can see the same monthly totals;
                  nobody can open another member&apos;s transactions.
                </Text>
                {workspace.summary.members.map((member) => {
                  const isSelf = member.userId === user.id;
                  const isBusy = busyAction.endsWith(member.userId);
                  return (
                    <View key={member.userId} style={styles.memberRow}>
                      <View style={styles.memberTopRow}>
                        <View style={styles.flexCopy}>
                          <Text style={styles.memberName}>
                            {member.displayName}{isSelf ? ' (You)' : ''}
                          </Text>
                          <Text style={styles.memberTotals}>
                            {formatCurrency(member.incomeCents, currencyCode)} income ·{' '}
                            {formatCurrency(member.spentCents, currencyCode)} spent
                          </Text>
                        </View>
                        {!canManage && isSelf && member.role !== 'owner' ? (
                          <Pressable
                            accessibilityLabel="Leave household"
                            accessibilityRole="button"
                            disabled={isBusy}
                            onPress={() => removeMember(member)}
                            style={styles.iconButton}
                          >
                            <Trash2 color={colors.danger} size={19} />
                          </Pressable>
                        ) : null}
                      </View>
                      {canManage ? (
                        <View style={styles.memberActions}>
                          <RoleChoices
                            allowedRoles={MEMBER_ROLES}
                            disabled={isBusy || (isSelf && member.role === 'owner')}
                            onSelect={(role) => changeRole(member, role)}
                            selectedRole={member.role}
                          />
                          {!isSelf ? (
                            <Pressable
                              accessibilityLabel={`Remove ${member.displayName}`}
                              accessibilityRole="button"
                              disabled={isBusy}
                              onPress={() => removeMember(member)}
                              style={styles.removeButton}
                            >
                              <Trash2 color={colors.danger} size={17} />
                              <Text style={styles.removeText}>Remove</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={styles.roleReadOnly}>{roleLabel(member.role)}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {canManage ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Invite someone</Text>
                  <Text style={styles.sectionBody}>
                    Codes expire and only work for the email address entered here.
                  </Text>
                  <FormField
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    error={inviteErrors.email}
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setInviteEmail}
                    placeholder="friend@example.com"
                    value={inviteEmail}
                  />
                  <Text style={styles.fieldLabel}>Starting role</Text>
                  <RoleChoices
                    allowedRoles={INVITE_ROLES}
                    onSelect={setInviteRole}
                    selectedRole={inviteRole}
                  />
                  <InlineNotice message={inviteErrors.role} variant="error" />
                  <AppButton
                    icon={MailPlus}
                    isLoading={busyAction === 'invite'}
                    label="Create private invitation"
                    onPress={handleInvite}
                  />
                  {invitationCode ? (
                    <View style={styles.invitationPanel}>
                      <View style={styles.flexCopy}>
                        <Text style={styles.invitationLabel}>Invitation code</Text>
                        <Text selectable style={styles.invitationCode}>{invitationCode}</Text>
                      </View>
                      <Pressable
                        accessibilityLabel="Share household invitation"
                        accessibilityRole="button"
                        onPress={shareInvitation}
                        style={styles.shareButton}
                      >
                        <Share2 color={colors.white} size={20} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Activity history</Text>
                {workspace.auditEvents.length ? workspace.auditEvents.map((event) => (
                  <View key={event.id} style={styles.auditRow}>
                    <View style={styles.auditIcon}><Clock3 color={colors.inkMuted} size={18} /></View>
                    <View style={styles.flexCopy}>
                      <Text style={styles.auditTitle}>{describeAuditEvent(event)}</Text>
                      <Text style={styles.auditTime}>{formatEventTime(event.created_at)}</Text>
                    </View>
                  </View>
                )) : <Text style={styles.sectionBody}>No household changes recorded yet.</Text>}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: spacing.xl },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.section, color: colors.ink },
  sectionBody: { ...typography.caption, color: colors.inkMuted },
  flexCopy: { flex: 1, minWidth: 0 },
  infoPanel: { borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoTitle: { ...typography.label, color: colors.ink, marginBottom: spacing.xs },
  infoBody: { ...typography.caption, color: colors.inkMuted },
  divider: { height: 1, backgroundColor: colors.border },
  householdHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  householdIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.iconSurface, alignItems: 'center', justifyContent: 'center' },
  householdName: { ...typography.section, color: colors.ink },
  privacyBadge: { minHeight: 34, borderRadius: radius.round, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.successSoft },
  privacyText: { ...typography.caption, color: colors.success, fontWeight: '700' },
  summaryPanel: { borderRadius: radius.md, backgroundColor: colors.darkPanel, padding: spacing.lg, gap: spacing.lg },
  summaryHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  summaryEyebrow: { ...typography.caption, color: colors.panelMuted },
  summaryTitle: { ...typography.section, color: colors.white },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryMetric: { flexGrow: 1, flexBasis: 150, gap: spacing.xs },
  summaryLabel: { ...typography.caption, color: colors.panelMuted },
  summaryAmount: { ...typography.section, color: colors.white },
  memberRow: { borderTopWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, gap: spacing.md },
  memberTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberName: { ...typography.label, color: colors.ink },
  memberTotals: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChoice: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  roleChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleChoiceText: { ...typography.caption, color: colors.inkMuted },
  roleChoiceTextSelected: { color: colors.primary, fontWeight: '700' },
  roleReadOnly: { ...typography.caption, color: colors.inkMuted },
  removeButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  removeText: { ...typography.caption, color: colors.danger },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...typography.label, color: colors.ink },
  invitationPanel: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  invitationLabel: { ...typography.caption, color: colors.inkMuted },
  invitationCode: { ...typography.label, color: colors.ink, marginTop: spacing.xs },
  shareButton: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  auditRow: { minHeight: 60, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  auditIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.iconSurface, alignItems: 'center', justifyContent: 'center' },
  auditTitle: { ...typography.label, color: colors.ink },
  auditTime: { ...typography.caption, color: colors.inkMuted },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
