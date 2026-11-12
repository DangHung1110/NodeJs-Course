export const AUTHORIZATION_SCHEME = 'Token ';
export const DUMMY_PASSWORD_HASH =
  '$2b$12$ev5QisFPq.GTr8lBXyrRn.AYekKD3dnwwJ124UMocd1YQFtkF49eC';
export const LOGIN_THROTTLE_TTL_MS = 60_000;
export const LOGIN_THROTTLE_LIMIT = 10;
export const OTP_UPPER_BOUND = 1_000_000;
export const REDIS_RETRY_STEP_MS = 100;
export const REDIS_RETRY_MAX_DELAY_MS = 2_000;

export const REGISTER_SUCCESS_MESSAGE =
  'Check your email for the verification code.';
export const RESEND_VERIFICATION_MESSAGE =
  'If the account can be verified, a code has been sent.';
export const FORGOT_PASSWORD_MESSAGE =
  'If the account exists, a password reset code has been sent.';
export const RESET_PASSWORD_SUCCESS_MESSAGE = 'Password reset successfully.';

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const normalizeEmailValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
