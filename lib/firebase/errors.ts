export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string,string> = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
    'auth/weak-password': 'Choose a stronger password that meets the project password policy.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet the account password policy.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/user-token-expired': 'Your session expired. Please sign in again.',
    'auth/invalid-user-token': 'Your session is no longer valid. Please sign in again.',
    'auth/id-token-expired': 'Your session expired. Please sign in again.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Unable to connect. Check your internet connection and retry.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled. Try again when ready.',
    'auth/cancelled-popup-request': 'Another Google sign-in is already in progress.',
    'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow popups for this site and retry.',
    'auth/unauthorized-domain': 'This domain is not authorized in Firebase Authentication settings.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/account-exists-with-different-credential': 'This email uses another sign-in method. Sign in with the original method.',
    'auth/invalid-api-key': 'Firebase configuration is invalid. Check the Firebase Web API key.',
    'auth/web-storage-unsupported': 'Browser storage is unavailable. Enable site storage and retry.',
  };
  return messages[code] || (error instanceof Error && !code ? error.message : 'Authentication failed. Please try again.');
}
export function safeDashboardReturn(value: string | null) {
  return value && /^\/dashboard(?:\/|\?|$)/.test(value) && !value.includes('\\') ? value : '/dashboard/workspace';
}
