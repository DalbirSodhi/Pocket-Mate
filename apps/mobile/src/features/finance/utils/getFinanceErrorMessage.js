export function getFinanceErrorMessage(error, fallback) {
  if (error?.code === '23505') {
    return 'A category with this name already exists.';
  }

  if (error?.code === '23503') {
    return 'This category is no longer available. Choose another one.';
  }

  return error?.message || fallback;
}
