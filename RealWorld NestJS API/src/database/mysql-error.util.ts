const DUPLICATE_KEY_CODE = 'ER_DUP_ENTRY';
const DEADLOCK_CODE = 'ER_LOCK_DEADLOCK';
const MISSING_FOREIGN_KEY_CODE = 'ER_NO_REFERENCED_ROW_2';

function hasDriverErrorCode(error: unknown, code: string): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error)
  ) {
    return false;
  }

  const driverError = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === code
  );
}

export function isDuplicateKeyError(error: unknown): boolean {
  return hasDriverErrorCode(error, DUPLICATE_KEY_CODE);
}

export function isDeadlockError(error: unknown): boolean {
  return hasDriverErrorCode(error, DEADLOCK_CODE);
}

export function isMissingForeignKeyError(error: unknown): boolean {
  return hasDriverErrorCode(error, MISSING_FOREIGN_KEY_CODE);
}
