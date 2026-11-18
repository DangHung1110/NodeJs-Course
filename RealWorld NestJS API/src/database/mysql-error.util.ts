const DUPLICATE_KEY_CODE = 'ER_DUP_ENTRY';

export function isDuplicateKeyError(error: unknown): boolean {
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
    driverError.code === DUPLICATE_KEY_CODE
  );
}
