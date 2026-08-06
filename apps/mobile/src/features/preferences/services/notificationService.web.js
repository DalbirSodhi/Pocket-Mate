const UNSUPPORTED_REASON = 'local-notifications-unavailable-on-web';

export async function requestReminderPermission() {
  return {
    supported: false,
    granted: false,
    status: 'unsupported',
    reason: UNSUPPORTED_REASON,
  };
}

export async function syncPocketMateReminders({ events = [] } = {}) {
  return {
    supported: false,
    granted: false,
    scheduledCount: 0,
    cancelledCount: 0,
    skippedCount: Array.isArray(events) ? events.length : 0,
    errors: [],
    reason: UNSUPPORTED_REASON,
  };
}

export async function getScheduledReminderCount() {
  return {
    supported: false,
    count: 0,
    reason: UNSUPPORTED_REASON,
  };
}
