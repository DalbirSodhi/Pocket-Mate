function getErrorMessage(error) {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error.message || error.error_description || error.details || '');
}

function getErrorStatus(error) {
  const status = error?.status || error?.code || error?.statusCode;
  const numericStatus = Number(status);

  return Number.isInteger(numericStatus) ? numericStatus : null;
}

function classifyAppError(error) {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();
  const status = getErrorStatus(error);

  if (
    status === 401 ||
    lowerMessage.includes('jwt expired') ||
    lowerMessage.includes('invalid refresh token') ||
    lowerMessage.includes('refresh token not found') ||
    lowerMessage.includes('session_not_found')
  ) {
    return {
      kind: 'auth',
      isAuthError: true,
      isNetworkError: false,
      message,
      userMessage: 'Your session expired. Sign in again to continue.',
    };
  }

  if (
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('load failed') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('timeout')
  ) {
    return {
      kind: 'network',
      isAuthError: false,
      isNetworkError: true,
      message,
      userMessage: 'Connection dropped. Check your internet and try again.',
    };
  }

  return {
    kind: 'unknown',
    isAuthError: false,
    isNetworkError: false,
    message,
    userMessage: message || 'Something went wrong. Try again.',
  };
}

function getOfflineMutationMessage(action = 'save') {
  return `You are offline. Reconnect before you ${action}.`;
}

module.exports = {
  classifyAppError,
  getErrorMessage,
  getOfflineMutationMessage,
};
