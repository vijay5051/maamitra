// Map Firebase Auth errors to plain-English messages we're willing to show
// to a non-technical user. Per ~/CLAUDE.md §4, no raw FirebaseError /
// stack / code strings should ever reach the UI. Unknown errors fall back
// to a generic friendly message; the original error is preserved on
// console.warn for debugging.

export type AuthFlow = 'sign-in' | 'sign-up' | 'google' | 'reset-password' | 'verify-email';

/**
 * Translate any thrown auth error into a UI-safe sentence. The flow hint
 * lets us tailor a few messages — for example, "wrong-password" reads
 * differently during sign-in vs. reset.
 */
export function friendlyAuthError(e: unknown, flow: AuthFlow = 'sign-in'): string {
  const code = (e as { code?: unknown } | null)?.code;
  const codeStr = typeof code === 'string' ? code : '';

  // Log the raw error for diagnostics — never reaches the UI.
  // eslint-disable-next-line no-console
  console.warn('[auth]', flow, codeStr || e);

  switch (codeStr) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return flow === 'sign-up'
        ? 'We could not create your account. Please check the details and try again.'
        : 'That email and password do not match. Please try again.';

    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.';

    case 'auth/invalid-email':
      return 'That email address does not look right. Please check it and try again.';

    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';

    case 'auth/missing-password':
      return 'Please enter your password.';

    case 'auth/too-many-requests':
      return 'Too many attempts in a row. Please wait a minute and try again.';

    case 'auth/network-request-failed':
      return 'No internet connection. Please check your network and try again.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact info@maamitra.co.in for help.';

    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled right now. Please try another option.';

    case 'auth/requires-recent-login':
      return 'For your security, please sign in again to complete this action.';

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The sign-in window closed before completing. Please try again.';

    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Please allow popups and try again.';

    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for sign-in. Please use the official MaaMitra link.';

    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists using a different sign-in method. Try signing in with email and password.';

    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another MaaMitra account.';

    case 'auth/invalid-verification-code':
      return 'That code did not match. Please check and try again.';

    case 'auth/invalid-verification-id':
    case 'auth/code-expired':
      return 'That verification code has expired. Please request a new one.';

    case 'auth/missing-verification-code':
      return 'Please enter the verification code we sent you.';

    case 'auth/quota-exceeded':
      return 'We are receiving too many requests right now. Please try again in a few minutes.';

    case 'auth/internal-error':
      return 'Something went wrong on our side. Please try again in a moment.';

    default:
      // Last resort — never surface raw Firebase strings. The flow context
      // keeps the message grounded in what the user was trying to do.
      switch (flow) {
        case 'sign-up':
          return 'We could not create your account. Please try again in a moment.';
        case 'google':
          return 'Google sign-in did not complete. Please try again.';
        case 'reset-password':
          return 'We could not send the reset email. Please try again in a moment.';
        case 'verify-email':
          return 'We could not verify your email. Please try again in a moment.';
        case 'sign-in':
        default:
          return 'Sign-in did not complete. Please try again in a moment.';
      }
  }
}
