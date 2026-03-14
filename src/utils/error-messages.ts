import type { TFunction } from 'i18next';

type ErrorWithFields = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
};

export function getUserFriendlyError(error: unknown, t: TFunction): string {
  if (!error) return t('errors.error_generic');

  const err = error as ErrorWithFields;
  const message = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  const status = err.status;

  if (!navigator.onLine) return t('errors.network_offline');

  if (status === 401 || status === 403 || code === '42501') {
    return t('errors.permission_denied');
  }

  if (status === 404 || code === 'PGRST116') {
    return t('errors.not_found');
  }

  if (status === 409 || code === '23505') {
    return t('errors.already_exists');
  }

  if (status === 429 || message.includes('rate limit')) {
    return t('errors.rate_limited');
  }

  if (status === 413 || message.includes('too large')) {
    return t('errors.file_too_large');
  }

  if (
    message.includes('mime') ||
    message.includes('file type') ||
    message.includes('unsupported')
  ) {
    return t('errors.unsupported_file_type');
  }

  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  ) {
    return t('errors.network_issue');
  }

  if (
    message.includes('storage') &&
    (message.includes('quota') || message.includes('limit'))
  ) {
    return t('errors.storage_limit_reached');
  }

  if (message.includes('permission') || message.includes('not allowed')) {
    return t('errors.permission_denied');
  }

  return t('errors.error_generic');
}
