import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown for the OTP "Resend code" link. Firebase throttles repeated SMS
 * sends (auth/too-many-requests), so the link stays disabled for
 * `seconds` after every send.
 */
export function useResendCooldown(seconds = 30) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const start = useCallback(() => setSecondsLeft(seconds), [seconds]);
  const reset = useCallback(() => setSecondsLeft(0), []);

  return { secondsLeft, canResend: secondsLeft <= 0, start, reset };
}
