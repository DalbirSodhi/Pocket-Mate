const NATIVE_CONFIRMATION_REDIRECT_URL = 'pocketmate://auth/callback';
const NATIVE_PASSWORD_RESET_REDIRECT_URL = 'pocketmate://reset-password';

function getAuthRedirectUrl({ flow, platform, webOrigin }) {
  if (platform === 'web' && webOrigin) {
    return webOrigin;
  }

  return flow === 'recovery'
    ? NATIVE_PASSWORD_RESET_REDIRECT_URL
    : NATIVE_CONFIRMATION_REDIRECT_URL;
}

module.exports = {
  NATIVE_CONFIRMATION_REDIRECT_URL,
  NATIVE_PASSWORD_RESET_REDIRECT_URL,
  getAuthRedirectUrl,
};
