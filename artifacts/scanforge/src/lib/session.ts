const STORAGE_KEY = 'scanforge-owner-id';
const EMAIL_KEY = 'scanforge-auth-email';

function getOwnerId() {
  if (typeof window === 'undefined') return 'anonymous';
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() ?? `sf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function getScanforgeHeaders(): Record<string, string> {
  const email = window.localStorage.getItem(EMAIL_KEY);
  return {
    'x-scanforge-owner': getOwnerId(),
    ...(email ? { 'x-scanforge-email': email } : {}),
  };
}

export function getSavedAuthEmail() {
  return window.localStorage.getItem(EMAIL_KEY) ?? '';
}

export function saveAuthEmail(email: string) {
  window.localStorage.setItem(EMAIL_KEY, email);
}

export function clearAuthEmail() {
  window.localStorage.removeItem(EMAIL_KEY);
}