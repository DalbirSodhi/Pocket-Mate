const messageOverrides = [
  {
    match: 'Invalid login credentials',
    message: 'The email or password is incorrect.',
  },
  {
    match: 'Email not confirmed',
    message: 'Confirm your email before signing in.',
  },
  {
    match: 'User already registered',
    message: 'An account already exists for this email.',
  },
  {
    match: 'rate limit',
    message: 'Too many attempts. Wait a moment and try again.',
  },
];

export function getAuthErrorMessage(error) {
  const rawMessage = error?.message || 'Something went wrong. Try again.';
  const override = messageOverrides.find(({ match }) =>
    rawMessage.toLowerCase().includes(match.toLowerCase()),
  );

  return override?.message || rawMessage;
}
