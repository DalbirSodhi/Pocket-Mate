export function getFinanceErrorMessage(error, fallback, duplicateMessage) {
  if (error?.code === '23505') {
    return duplicateMessage || 'This record already exists.';
  }

  if (error?.code === '23503') {
    return 'This category is no longer available. Choose another one.';
  }

  return error?.message || fallback;
}
