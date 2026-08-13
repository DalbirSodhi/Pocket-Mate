import { Platform } from 'react-native';

import { optionalEnv } from '../../config/env';
import { buildErrorEvent } from './errorReporter.cjs';

const reportingEndpoint = optionalEnv.errorReportingEndpoint;

export async function reportError(error, context = {}) {
  const event = {
    ...buildErrorEvent(error, context),
    platform: Platform.OS,
  };

  if (!reportingEndpoint) {
    if (__DEV__) {
      console.error('[observability]', event);
    }
    return;
  }

  try {
    await fetch(reportingEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  } catch {
    if (__DEV__) {
      console.error('[observability] failed to report error');
    }
  }
}
