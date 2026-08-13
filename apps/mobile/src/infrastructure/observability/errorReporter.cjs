const redactionPatterns = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[redacted-email]',
  },
  {
    pattern: /\b(?:eyJ[a-zA-Z0-9_-]+)\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    replacement: '[redacted-token]',
  },
  {
    pattern: /\b(access_token|refresh_token|apikey|api_key|password|secret)=([^&\s]+)/gi,
    replacement: '$1=[redacted-secret]',
  },
  {
    pattern: /\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g,
    replacement: '[redacted-amount]',
  },
  {
    pattern: /\b\d{12,19}\b/g,
    replacement: '[redacted-card-number]',
  },
];

function redactText(value) {
  if (!value) return '';

  return redactionPatterns.reduce(
    (text, { pattern, replacement }) => text.replace(pattern, replacement),
    String(value),
  );
}

function normalizeError(error) {
  if (!error) {
    return {
      name: 'UnknownError',
      message: 'Unknown application error',
      stack: '',
    };
  }

  return {
    name: redactText(error.name || 'Error'),
    message: redactText(error.message || String(error)),
    stack: redactText(error.stack || ''),
  };
}

function buildErrorEvent(error, context = {}) {
  const normalized = normalizeError(error);

  return {
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    level: context.level || 'error',
    area: redactText(context.area || 'app'),
    componentStack: redactText(context.componentStack || ''),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildErrorEvent,
  redactText,
};
